/**
 * 家庭云对象
 * 管理家庭创建、成员管理、设置
 */
const { verifyAndGetFamily, requireAdmin, requireFamily } = require('breed-auth/auth')
let safeWriteOperationLog = async () => null
let isOperationLogCollectionMissingError = () => false
try {
  ;({ safeWriteOperationLog, isOperationLogCollectionMissingError } = require('breed-auth/operation-log'))
} catch (error) {
  ;({ safeWriteOperationLog, isOperationLogCollectionMissingError } = require('../common/breed-auth/operation-log'))
}
let syncUtils = null
try {
  syncUtils = require('breed-sync')
} catch (error) {
  syncUtils = require('../common/breed-sync')
}
let attachmentGc = null
try {
  attachmentGc = require('attachment-gc')
} catch (error) {
  attachmentGc = require('../common/attachment-gc')
}
const {
  getSyncMeta,
  buildTouchedEntity,
  buildSyncAck,
  buildConflictAck,
  findAppliedMutation,
  markMutationApplied,
  getBaseVersion,
  getServerVersion,
  buildVersionUpdate,
} = syncUtils
const {
  cleanupPendingAttachmentDeletions,
} = attachmentGc

const db = uniCloud.database()
const dbCmd = db.command

const DEFAULT_NOTIFICATION_TYPES = {
  breeding: true,
  vaccination: true,
  medication: true,
  care_group: true,
  overdue: true,
}

// 家庭设置默认值
const DEFAULT_SETTINGS = {
  default_weaning_days: 45,
  default_vaccine_interval_puppy: 21,
  default_vaccine_interval_adult: 365,
  default_deworming_interval_puppy: 14,
  default_deworming_interval_adult: 90,
  push_enabled: true,
  morning_summary_enabled: true,
  morning_summary_time: '09:00',
  notification_types: { ...DEFAULT_NOTIFICATION_TYPES },
  custom_vaccine_types: [],
  custom_deworming_drugs: { internal: [], external: [], combo: [] },
  custom_condition_types: [],
  custom_breed_types: [],
  auto_backup_enabled: false,
  last_backup_date: null,
  last_backup_file_id: '',
  backup_file_ids: [],
}

function mergeFamilySettings(settings = {}) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {}

  return {
    ...DEFAULT_SETTINGS,
    ...safeSettings,
    notification_types: {
      ...DEFAULT_NOTIFICATION_TYPES,
      ...(safeSettings.notification_types && typeof safeSettings.notification_types === 'object' ? safeSettings.notification_types : {}),
      overdue: true,
    },
    custom_deworming_drugs: {
      ...DEFAULT_SETTINGS.custom_deworming_drugs,
      ...(safeSettings.custom_deworming_drugs && typeof safeSettings.custom_deworming_drugs === 'object' ? safeSettings.custom_deworming_drugs : {}),
    },
  }
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

function normalizeNotificationTypes(input, currentSettings) {
  const base = {
    ...DEFAULT_NOTIFICATION_TYPES,
    ...(currentSettings?.notification_types || {}),
  }

  if (input === undefined) {
    return {
      ...base,
      overdue: true,
    }
  }

  if (!input || typeof input !== 'object') {
    throw new Error('提醒类型参数无效')
  }

  const normalized = { ...base }
  for (const key of Object.keys(DEFAULT_NOTIFICATION_TYPES)) {
    if (key === 'overdue') continue
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') {
        throw new Error('提醒类型参数无效')
      }
      normalized[key] = input[key]
    }
  }

  normalized.overdue = true
  return normalized
}

function getEntityConflict(syncMeta, collection, entity) {
  const baseVersion = getBaseVersion(syncMeta, entity?._id)
  if (baseVersion === null) return null
  const serverVersion = getServerVersion(entity)
  if (baseVersion === serverVersion) return null
  return buildConflictAck(syncMeta, {
    collection,
    entityId: entity._id,
    baseVersion,
    serverVersion,
  })
}

const RECYCLE_RETENTION_DAYS = 30
const BACKUP_FILE_RETENTION_LIMIT = 4
const SYSTEM_MANAGED_SETTING_KEYS = new Set(['last_backup_date', 'last_backup_file_id', 'backup_file_ids'])
const EXPORT_SCHEMA_VERSION = 1
const EXPORT_COLLECTIONS = [
  'dogs',
  'breeding_cycles',
  'litters',
  'breeding_records',
  'health_records',
  'medication_tasks',
  'tasks',
  'expenses',
  'incomes',
  'sale_records',
  'agents',
  'dog_weights',
  'medication_protocols',
  'attachment_deletions',
]
const SOFT_DELETE_REPAIR_COLLECTIONS = new Set([
  'dogs',
  'expenses',
  'incomes',
  'agents',
  'medication_protocols',
  'sale_records',
])
const DOG_GENDERS = new Set(['公', '母'])
const DOG_ROLES = new Set(['种狗', '幼崽', '外部种公'])
const DOG_DISPOSITIONS = new Set(['在养', '待售', '已预定', '已售', '已领养', '已赠送', '自留', '已退休', '已故'])
const LEGACY_INCOME_TYPE_MAP = {
  定金: '定金保留',
  领养费: '领养',
  配种费收入: '其他',
}
function formatDogRoleLabel(role) {
  if (role === '种狗') return '种犬'
  return role
}
const RECYCLE_SUPPORTED_TYPES = {
  dog: {
    collection: 'dogs',
    typeLabel: '犬只',
    name: item => item.name || '未命名犬只',
    summary: item => [item.breed, formatDogRoleLabel(item.role), item.disposition].filter(Boolean).join(' · '),
  },
  expense: {
    collection: 'expenses',
    typeLabel: '支出',
    name: item => item.category || '未命名支出',
    summary: item => [item.category, formatCurrency(item.amount)].filter(Boolean).join(' · '),
  },
  income: {
    collection: 'incomes',
    typeLabel: '收入',
    name: item => normalizeIncomeType(item.type) || '未命名收入',
    summary: item => [normalizeIncomeType(item.type), formatCurrency(item.amount)].filter(Boolean).join(' · '),
  },
  agent: {
    collection: 'agents',
    typeLabel: '代理人',
    name: item => item.name || '未命名代理人',
    summary: item => item.contact_info || '',
  },
  medication_protocol: {
    collection: 'medication_protocols',
    typeLabel: '用药方案',
    name: item => item.name || '未命名方案',
    summary: item => [item.drug_name, item.duration_days ? `${item.duration_days}天疗程` : ''].filter(Boolean).join(' · '),
  },
}

function formatCurrency(amount) {
  if (amount == null || amount === '') return ''
  const numericAmount = Number(amount)
  if (Number.isNaN(numericAmount)) return ''
  return `¥${numericAmount.toLocaleString()}`
}

function normalizeIncomeType(type) {
  const normalized = String(type || '').trim()
  if (!normalized) return '其他'
  return LEGACY_INCOME_TYPE_MAP[normalized] || normalized
}

function clampDaysRemaining(deletedAt) {
  if (!deletedAt) return 0
  const elapsedDays = Math.floor((Date.now() - deletedAt) / 86400000)
  return Math.max(0, RECYCLE_RETENTION_DAYS - elapsedDays)
}

function normalizeRecycleItem(type, item) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) return null

  return {
    _id: item._id,
    type,
    type_label: config.typeLabel,
    name: config.name(item),
    summary: config.summary(item),
    deleted_at: item.deleted_at,
    days_remaining: clampDaysRemaining(item.deleted_at),
  }
}

async function getDeletedDocsByType(familyId, type) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) return []

  const { data } = await db.collection(config.collection)
    .where({
      family_id: familyId,
      deleted_at: dbCmd.neq(null),
    })
    .get()

  return (data || [])
    .map(item => normalizeRecycleItem(type, item))
    .filter(Boolean)
}

async function getSoftDeletedDocByType(familyId, type, id) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) throw new Error('不支持的回收站类型')

  const { data } = await db.collection(config.collection)
    .where({
      _id: id,
      family_id: familyId,
      deleted_at: dbCmd.neq(null),
    })
    .limit(1)
    .get()

  return {
    config,
    doc: data && data.length > 0 ? data[0] : null,
  }
}

function parseRecycleItemInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('回收站参数无效')
  }

  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const type = typeof input.type === 'string' ? input.type.trim() : ''

  if (!id) throw new Error('缺少回收站项目 ID')
  if (!RECYCLE_SUPPORTED_TYPES[type]) throw new Error('不支持的回收站类型')

  return { id, type }
}

function normalizeOperationLogQuery(input = {}) {
  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20))
  const actorUserId = typeof input.actorUserId === 'string' ? input.actorUserId.trim() : ''
  const actorUserIds = Array.isArray(input.actorUserIds)
    ? input.actorUserIds.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const actionTypes = Array.isArray(input.actionTypes)
    ? input.actionTypes.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const normalizedActorUserIds = actorUserIds.length > 0
    ? Array.from(new Set(actorUserIds))
    : (actorUserId ? [actorUserId] : [])

  return {
    start: Number(input.start) || 0,
    end: Number(input.end) || Date.now(),
    page,
    pageSize,
    actorUserId,
    actorUserIds: normalizedActorUserIds,
    actionTypes,
  }
}

function isZeroEffectOperationLog(log) {
  if (!log || log.domain !== 'task' || log.target_type !== 'task_batch') return false
  const meta = log.meta && typeof log.meta === 'object' ? log.meta : {}
  if (Number(meta.created || 0) === 0 && Number(meta.skipped || 0) > 0) return true
  if (Number(meta.completed || 0) === 0 && Array.isArray(meta.completedTaskIds)) return true
  const summary = String(log.summary || '')
  return /批量创建了\s*0\s*个/.test(summary) || /批量完成了\s*0\s*个/.test(summary)
}

function normalizeExportInput(input = {}) {
  const format = String(input?.format || 'json').trim().toLowerCase()
  const mode = String(input?.mode || 'export').trim().toLowerCase()

  if (!['json', 'csv'].includes(format)) {
    throw new Error('导出格式无效')
  }
  if (!['backup', 'export'].includes(mode)) {
    throw new Error('导出模式无效')
  }

  return { format, mode }
}

function sanitizePathSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function escapeCsvCell(value) {
  if (value === undefined || value === null) return ''
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (!/[",\n\r]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

function buildCsv(rows = []) {
  const keys = []
  const seen = new Set()
  const addKey = (key) => {
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }

  addKey('_id')
  for (const row of rows) {
    Object.keys(row || {}).forEach(addKey)
  }

  const lines = [
    keys.map(escapeCsvCell).join(','),
    ...rows.map(row => keys.map(key => escapeCsvCell(row?.[key])).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

let crcTable = null
function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    crcTable[i] = c >>> 0
  }
  return crcTable
}

function crc32(buffer) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}

function createZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const { dosTime, dosDate } = getDosDateTime()

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name)
    const contentBuffer = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content || ''))
    const checksum = crc32(contentBuffer)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(contentBuffer.length, 18)
    localHeader.writeUInt32LE(contentBuffer.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBuffer, contentBuffer)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(contentBuffer.length, 20)
    centralHeader.writeUInt32LE(contentBuffer.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, nameBuffer)

    offset += localHeader.length + nameBuffer.length + contentBuffer.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(offset, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, endRecord])
}

async function collectFamilyArchive(familyId) {
  const { data: familyDocs } = await db.collection('families').doc(familyId).get()
  const family = familyDocs?.[0] || familyDocs || null
  if (!family) throw new Error('家庭不存在')

  const collections = {
    families: [{ ...family, settings: mergeFamilySettings(family.settings) }],
  }

  for (const collection of EXPORT_COLLECTIONS) {
    const { data } = await db.collection(collection)
      .where({ family_id: familyId })
      .get()
    collections[collection] = data || []
  }

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    familyId,
    collections,
  }
}

function buildArchiveContent(archive, format) {
  if (format === 'json') {
    return Buffer.from(JSON.stringify(archive, null, 2))
  }

  const entries = Object.entries(archive.collections).map(([collection, rows]) => ({
    name: `${collection}.csv`,
    content: buildCsv(rows),
  }))
  entries.unshift({
    name: 'metadata.csv',
    content: buildCsv([{
      schemaVersion: archive.schemaVersion,
      exportedAt: archive.exportedAt,
      familyId: archive.familyId,
    }]),
  })
  return createZip(entries)
}

async function resolveUploadedFileUrl(uploadResult) {
  const fileID = uploadResult?.fileID || uploadResult?.fileId || uploadResult?.url || ''
  if (uploadResult?.url) return { fileID, url: uploadResult.url }
  if (fileID && typeof uniCloud.getTempFileURL === 'function') {
    try {
      const tempResult = await uniCloud.getTempFileURL({ fileList: [fileID] })
      const first = tempResult?.fileList?.[0]
      const tempUrl = first?.tempFileURL || first?.url
      if (tempUrl) return { fileID, url: tempUrl }
    } catch (error) {
      console.warn('[backup] getTempFileURL failed', error)
    }
  }
  return { fileID, url: fileID }
}

function normalizeBackupFileIds(fileIds = []) {
  if (!Array.isArray(fileIds)) return []
  const result = []
  for (const fileId of fileIds) {
    const normalized = String(fileId || '').trim()
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
  }
  return result
}

async function deleteOldBackupFiles(fileIds = []) {
  const normalized = normalizeBackupFileIds(fileIds)
  if (!normalized.length || typeof uniCloud.deleteFile !== 'function') return
  try {
    await uniCloud.deleteFile({ fileList: normalized })
  } catch (error) {
    console.warn('[backup] delete old backup files failed', error)
  }
}

function buildRetainedBackupFileIds(previousFileIds = [], currentFileId = '') {
  const normalizedCurrentFileId = String(currentFileId || '').trim()
  const allFileIds = normalizeBackupFileIds([
    ...normalizeBackupFileIds(previousFileIds).filter(fileId => fileId !== normalizedCurrentFileId),
    normalizedCurrentFileId,
  ])
  const retainedFileIds = allFileIds.slice(-BACKUP_FILE_RETENTION_LIMIT)
  const deletedFileIds = allFileIds.slice(0, Math.max(0, allFileIds.length - BACKUP_FILE_RETENTION_LIMIT))
  return { retainedFileIds, deletedFileIds }
}

function getBackupCreatedAt(fileID = '') {
  const match = String(fileID || '').match(/backup-(\d+)\.json(?:$|\?)/)
  return match ? Number(match[1]) : 0
}

async function getFamilyBackupFileIds(familyId) {
  const { data } = await db.collection('families')
    .doc(familyId)
    .field({ settings: true })
    .get()
  const family = data?.[0] || data || {}
  const settings = mergeFamilySettings(family.settings)
  return normalizeBackupFileIds([
    ...normalizeBackupFileIds(settings.backup_file_ids),
    settings.last_backup_file_id,
  ]).slice(-BACKUP_FILE_RETENTION_LIMIT)
}

async function buildBackupHistory(familyId) {
  const fileIds = await getFamilyBackupFileIds(familyId)
  const files = []
  for (const fileID of fileIds.slice().reverse()) {
    const { url } = await resolveUploadedFileUrl({ fileID })
    const createdAt = getBackupCreatedAt(fileID)
    files.push({
      fileID,
      url,
      created_at: createdAt,
      name: createdAt ? `backup-${createdAt}.json` : 'backup.json',
    })
  }
  return files
}

async function readBackupArchive(fileID) {
  if (!fileID) throw new Error('缺少备份文件')
  if (typeof uniCloud.downloadFile !== 'function') {
    throw new Error('当前云环境不支持读取备份文件')
  }
  const result = await uniCloud.downloadFile({ fileID })
  const content = result?.fileContent || result?.data || result?.buffer || ''
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '')
  if (!text) throw new Error('备份文件为空')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('备份文件格式无效')
  }
}

function validateRestoreArchive(archive, familyId) {
  if (!archive || typeof archive !== 'object') throw new Error('备份文件格式无效')
  if (Number(archive.schemaVersion) !== EXPORT_SCHEMA_VERSION) throw new Error('备份版本不支持')
  if (archive.familyId !== familyId) throw new Error('备份文件不属于当前家庭')
  if (!archive.collections || typeof archive.collections !== 'object') throw new Error('备份文件缺少业务数据')

  const collections = {}
  for (const collection of EXPORT_COLLECTIONS) {
    const rows = Array.isArray(archive.collections[collection]) ? archive.collections[collection] : []
    for (const row of rows) {
      if (!row || typeof row !== 'object' || row.family_id !== familyId) {
        throw new Error(`备份文件包含无效的 ${collection} 数据`)
      }
    }
    collections[collection] = rows
  }
  return collections
}

async function restoreArchiveCollections(familyId, archive) {
  const collections = validateRestoreArchive(archive, familyId)
  const restoredCollections = []

  for (const collection of EXPORT_COLLECTIONS) {
    await db.collection(collection).where({ family_id: familyId }).remove()
    const rows = collections[collection]
    for (const row of rows) {
      await db.collection(collection).add({ ...row, family_id: familyId })
    }
    restoredCollections.push(collection)
  }

  return restoredCollections
}

async function createFamilyArchiveFile(familyId, options = {}) {
  const { format, mode } = normalizeExportInput(options)
  const now = Number(options.now) || Date.now()
  const archive = await collectFamilyArchive(familyId)
  archive.exportedAt = now
  const content = buildArchiveContent(archive, format)
  const extension = format === 'csv' ? 'zip' : 'json'
  const cloudPath = [
    'backups',
    sanitizePathSegment(familyId),
    `${mode}-${now}.${extension}`,
  ].join('/')

  const uploadResult = await uniCloud.uploadFile({
    cloudPath,
    fileContent: content,
  })
  const { fileID, url } = await resolveUploadedFileUrl(uploadResult)

  if (mode === 'backup') {
    const previousSettings = mergeFamilySettings(archive.collections.families?.[0]?.settings)
    const previousFileIds = normalizeBackupFileIds([
      ...normalizeBackupFileIds(previousSettings.backup_file_ids),
      previousSettings.last_backup_file_id,
    ])
    const { retainedFileIds, deletedFileIds } = buildRetainedBackupFileIds(previousFileIds, fileID)
    await db.collection('families').doc(familyId).update({
      'settings.last_backup_date': now,
      'settings.last_backup_file_id': fileID,
      'settings.backup_file_ids': retainedFileIds,
      ...buildVersionUpdate(dbCmd, now),
    })
    await deleteOldBackupFiles(deletedFileIds)
  }

  return {
    data: {
      url,
      fileID,
      format,
      mode,
      size: content.length,
      created_at: now,
    },
  }
}

function getFamilySettingsRepairPatch(settings = {}) {
  const current = settings && typeof settings === 'object' ? settings : {}
  const patch = {}
  const fields = []
  const setField = (key, value) => {
    patch[`settings.${key}`] = value
    fields.push(key)
  }
  const ensureNumber = (key, fallback) => {
    if (!Number.isFinite(Number(current[key]))) {
      setField(key, fallback)
    }
  }
  const ensureBoolean = (key, fallback) => {
    if (typeof current[key] !== 'boolean') {
      setField(key, fallback)
    }
  }
  const ensureArray = (key) => {
    if (!Array.isArray(current[key])) {
      setField(key, [])
    }
  }

  ensureNumber('default_weaning_days', DEFAULT_SETTINGS.default_weaning_days)
  ensureNumber('default_vaccine_interval_puppy', DEFAULT_SETTINGS.default_vaccine_interval_puppy)
  ensureNumber('default_vaccine_interval_adult', DEFAULT_SETTINGS.default_vaccine_interval_adult)
  ensureNumber('default_deworming_interval_puppy', DEFAULT_SETTINGS.default_deworming_interval_puppy)
  ensureNumber('default_deworming_interval_adult', DEFAULT_SETTINGS.default_deworming_interval_adult)
  ensureBoolean('push_enabled', DEFAULT_SETTINGS.push_enabled)
  ensureBoolean('morning_summary_enabled', DEFAULT_SETTINGS.morning_summary_enabled)
  ensureBoolean('auto_backup_enabled', DEFAULT_SETTINGS.auto_backup_enabled)

  if (!isValidTimeString(current.morning_summary_time)) {
    setField('morning_summary_time', DEFAULT_SETTINGS.morning_summary_time)
  }

  const notificationTypes = current.notification_types && typeof current.notification_types === 'object'
    ? current.notification_types
    : {}
  const nextNotificationTypes = { ...DEFAULT_NOTIFICATION_TYPES, ...notificationTypes, overdue: true }
  const notificationInvalid = Object.keys(DEFAULT_NOTIFICATION_TYPES).some((key) => (
    typeof notificationTypes[key] !== 'boolean' || notificationTypes[key] !== nextNotificationTypes[key]
  ))
  if (notificationInvalid) {
    setField('notification_types', nextNotificationTypes)
  }

  ensureArray('custom_vaccine_types')
  ensureArray('custom_condition_types')
  ensureArray('custom_breed_types')

  const deworming = current.custom_deworming_drugs && typeof current.custom_deworming_drugs === 'object'
    ? current.custom_deworming_drugs
    : {}
  const nextDeworming = {
    internal: Array.isArray(deworming.internal) ? deworming.internal : [],
    external: Array.isArray(deworming.external) ? deworming.external : [],
    combo: Array.isArray(deworming.combo) ? deworming.combo : [],
  }
  if (
    !current.custom_deworming_drugs
    || !Array.isArray(deworming.internal)
    || !Array.isArray(deworming.external)
    || !Array.isArray(deworming.combo)
  ) {
    setField('custom_deworming_drugs', nextDeworming)
  }

  if (!Object.prototype.hasOwnProperty.call(current, 'last_backup_date')) {
    setField('last_backup_date', DEFAULT_SETTINGS.last_backup_date)
  }
  if (current.last_backup_date !== null && current.last_backup_date !== undefined && !Number.isFinite(Number(current.last_backup_date))) {
    setField('last_backup_date', DEFAULT_SETTINGS.last_backup_date)
  }
  if (!Object.prototype.hasOwnProperty.call(current, 'last_backup_file_id')) {
    setField('last_backup_file_id', DEFAULT_SETTINGS.last_backup_file_id)
  }
  if (current.last_backup_file_id !== undefined && typeof current.last_backup_file_id !== 'string') {
    setField('last_backup_file_id', DEFAULT_SETTINGS.last_backup_file_id)
  }
  if (!Array.isArray(current.backup_file_ids)) {
    setField('backup_file_ids', DEFAULT_SETTINGS.backup_file_ids)
  }

  return { patch, fields }
}

async function repairFamilySettings(familyId, dryRun, now) {
  const { data } = await db.collection('families').doc(familyId).get()
  const family = data?.[0] || data
  if (!family) throw new Error('家庭不存在')

  const { patch, fields } = getFamilySettingsRepairPatch(family.settings)
  if (fields.length === 0) {
    return null
  }

  if (!dryRun) {
    await db.collection('families').doc(familyId).update({
      ...patch,
      ...buildVersionUpdate(dbCmd, now),
    })
  }

  return {
    collection: 'families',
    id: familyId,
    fields: fields.map(field => `settings.${field}`),
  }
}

async function repairCollectionTechnicalFields(familyId, collection, dryRun, now) {
  const { data } = await db.collection(collection).where({ family_id: familyId }).get()
  const details = []

  for (const row of data || []) {
    const patch = {}
    if (row.version === undefined || row.version === null || Number.isNaN(Number(row.version))) {
      patch.version = 1
    }
    if (row.updated_at === undefined || row.updated_at === null) {
      patch.updated_at = Number(row.created_at) || now
    }
    if (SOFT_DELETE_REPAIR_COLLECTIONS.has(collection) && row.deleted_at === undefined) {
      patch.deleted_at = null
    }
    if (Object.keys(patch).length === 0) continue
    if (patch.updated_at === undefined) {
      patch.updated_at = Number(row.updated_at) || Number(row.created_at) || now
    }

    if (!dryRun) {
      await db.collection(collection).doc(row._id).update(patch)
    }

    details.push({
      collection,
      id: row._id,
      fields: Object.keys(patch),
    })
  }

  return details
}

async function detectBusinessWarnings(familyId) {
  const [
    dogsResult,
    healthResult,
    medicationResult,
    saleResult,
  ] = await Promise.all([
    db.collection('dogs').where({ family_id: familyId }).get(),
    db.collection('health_records').where({ family_id: familyId }).get(),
    db.collection('medication_tasks').where({ family_id: familyId }).get(),
    db.collection('sale_records').where({ family_id: familyId }).get(),
  ])
  const dogs = dogsResult.data || []
  const dogIds = new Set(dogs.map(dog => dog._id))
  const warnings = []

  for (const dog of dogs) {
    if (dog.gender && !DOG_GENDERS.has(dog.gender)) {
      warnings.push({ collection: 'dogs', id: dog._id, type: 'invalid_enum', field: 'gender' })
    }
    if (dog.role && !DOG_ROLES.has(dog.role)) {
      warnings.push({ collection: 'dogs', id: dog._id, type: 'invalid_enum', field: 'role' })
    }
    if (dog.disposition && !DOG_DISPOSITIONS.has(dog.disposition)) {
      warnings.push({ collection: 'dogs', id: dog._id, type: 'invalid_enum', field: 'disposition' })
    }
  }

  for (const record of healthResult.data || []) {
    if (record.dog_id && !dogIds.has(record.dog_id)) {
      warnings.push({ collection: 'health_records', id: record._id, type: 'missing_dog', dog_id: record.dog_id })
    }
  }

  const activeMedicationKeys = new Map()
  for (const task of medicationResult.data || []) {
    if (task.dog_id && !dogIds.has(task.dog_id)) {
      warnings.push({ collection: 'medication_tasks', id: task._id, type: 'missing_dog', dog_id: task.dog_id })
    }
    if (task.status === '进行中') {
      const key = `${task.dog_id || ''}::${task.drug_name || task.medication_name || ''}`
      if (activeMedicationKeys.has(key)) {
        warnings.push({
          collection: 'medication_tasks',
          id: task._id,
          type: 'duplicate_active_medication',
          related_id: activeMedicationKeys.get(key),
        })
      } else {
        activeMedicationKeys.set(key, task._id)
      }
    }
  }

  for (const sale of saleResult.data || []) {
    if (sale.dog_id && !dogIds.has(sale.dog_id)) {
      warnings.push({ collection: 'sale_records', id: sale._id, type: 'missing_dog', dog_id: sale.dog_id })
    }
  }

  return warnings
}

async function repairFamilyData(familyId, input = {}) {
  const dryRun = !!input?.dryRun
  const now = Date.now()
  const checkedCollections = ['families', ...EXPORT_COLLECTIONS]
  const details = []
  const settingsRepair = await repairFamilySettings(familyId, dryRun, now)
  if (settingsRepair) details.push(settingsRepair)

  for (const collection of EXPORT_COLLECTIONS) {
    details.push(...await repairCollectionTechnicalFields(familyId, collection, dryRun, now))
  }

  const warnings = await detectBusinessWarnings(familyId)

  return {
    checkedCollections,
    repairedCount: details.length,
    warnings,
    details,
  }
}

module.exports = {
  _before: async function() {
    // _timing 方法不需要用户认证
    const methodName = this.getMethodName()
    if (methodName && methodName.startsWith('_timing')) return

    // createFamily 和 joinFamily 允许无家庭用户调用
    const skipFamilyCheck = ['createFamily', 'joinFamily', 'getFamilyInfo']
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())
    this.uid = uid
    this.familyId = familyId
    this.role = role

    if (!skipFamilyCheck.includes(methodName)) {
      requireFamily(familyId)
    }
  },

  _after: function(error, result) {
    if (error) {
      return { errCode: error.code || -1, errMsg: error.message }
    }
    return result
  },

  /**
   * 创建家庭
   * @param {string} name - 家庭/犬舍名称
   */
  async createFamily(name) {
    if (!name || !name.trim()) {
      throw new Error('请输入家庭名称')
    }

    // 检查用户是否已有家庭（单家庭模式）
    if (this.familyId) {
      throw new Error('您已有家庭，V1 版本暂不支持多家庭')
    }

    const now = Date.now()
    const familyData = {
      name: name.trim(),
      creator_id: this.uid,
      members: [{
        user_id: this.uid,
        role: 'creator',
        status: 'active',
        joined_at: now,
      }],
      care_rules: [],
      settings: { ...DEFAULT_SETTINGS },
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('families').add(familyData)
    await safeWriteOperationLog({
      familyId: id,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'family',
      targetType: 'family',
      targetId: id,
      targetName: familyData.name,
      summary: `创建了家庭 ${familyData.name}`,
      createdAt: now,
    })
    return { data: { familyId: id } }
  },

  /**
   * 获取当前用户的家庭信息
   */
  async getFamilyInfo() {
    // 用户可能还没有家庭（登录后首次检查）
    if (!this.familyId) {
      return { data: null }
    }

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .get()

    if (!data || data.length === 0) {
      throw new Error('家庭不存在')
    }

    const family = data[0] || data

    return {
      data: {
        ...family,
        settings: mergeFamilySettings(family.settings),
      },
    }
  },

  /**
   * 更新家庭设置
   * @param {object} settings - 要更新的设置字段
   */
  async updateSettings(settings) {
    requireAdmin(this.role)
    const syncMeta = getSyncMeta(settings)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    if (!settings || typeof settings !== 'object') {
      throw new Error('设置参数无效')
    }

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true })
      .get()

    const family = data[0] || data
    if (!family) {
      throw new Error('家庭不存在')
    }
    const conflict = getEntityConflict(syncMeta, 'families', { _id: this.familyId, ...family })
    if (conflict) return conflict

    const currentSettings = mergeFamilySettings(family.settings)

    // 只允许更新已知的设置字段
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updateData = {}
    for (const key of allowedKeys) {
      if (settings[key] !== undefined) {
        if (SYSTEM_MANAGED_SETTING_KEYS.has(key)) {
          continue
        }

        if (key === 'push_enabled' || key === 'morning_summary_enabled' || key === 'auto_backup_enabled') {
          if (typeof settings[key] !== 'boolean') {
            throw new Error('设置参数无效')
          }
          updateData[`settings.${key}`] = settings[key]
          continue
        }

        if (key === 'morning_summary_time') {
          if (!isValidTimeString(settings[key])) {
            throw new Error('推送时间格式无效')
          }
          updateData['settings.morning_summary_time'] = settings[key]
          continue
        }

        if (key === 'notification_types') {
          updateData['settings.notification_types'] = normalizeNotificationTypes(settings.notification_types, currentSettings)
          continue
        }

        updateData[`settings.${key}`] = settings[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('没有可更新的设置')
    }

    const now = Date.now()
    Object.assign(updateData, buildVersionUpdate(dbCmd, now))

    await db.collection('families')
      .doc(this.familyId)
      .update(updateData)

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      domain: 'family',
      targetType: 'settings',
      targetId: this.familyId,
      targetName: '家庭设置',
      summary: '更新了家庭设置',
      meta: {
        keys: Object.keys(updateData).filter(key => key !== 'updated_at'),
      },
    })

    const { data: updatedFamilies } = await db.collection('families')
      .doc(this.familyId)
      .get()
    const updatedFamily = updatedFamilies?.[0] || updatedFamilies
    const response = {
      message: '设置已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedFamily ? [buildTouchedEntity('families', updatedFamily)] : [],
        resyncScopes: ['families'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 更新家庭名称
   * @param {string} name - 新名称
   */
  async updateFamilyName(name) {
    requireAdmin(this.role)

    if (!name || !name.trim()) {
      throw new Error('请输入家庭名称')
    }

    const { data: families } = await db.collection('families')
      .doc(this.familyId)
      .field({ name: true })
      .get()
    const family = families?.[0] || families || {}
    const nextName = name.trim()

    await db.collection('families')
      .doc(this.familyId)
      .update({
        name: nextName,
        updated_at: Date.now(),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      domain: 'family',
      targetType: 'family',
      targetId: this.familyId,
      targetName: nextName,
      summary: `将家庭名称从 ${family.name || '未命名家庭'} 更新为 ${nextName}`,
    })

    return { message: '名称已更新' }
  },

  /**
   * 添加/更新护理规则
   * @param {object} rule - 护理规则 { status_trigger, task_description, frequency }
   */
  async addCareRule(rule) {
    requireAdmin(this.role)
    const syncMeta = getSyncMeta(rule)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    if (!rule || !rule.status_trigger || !rule.task_description || !rule.frequency) {
      throw new Error('请填写完整的护理规则')
    }

    const { data: families } = await db.collection('families')
      .doc(this.familyId)
      .field({ care_rules: true, version: true })
      .get()
    const family = families?.[0] || families
    if (!family) throw new Error('家庭不存在')
    const conflict = getEntityConflict(syncMeta, 'families', { _id: this.familyId, ...family })
    if (conflict) return conflict

    const careRule = {
      status_trigger: rule.status_trigger,
      task_description: rule.task_description,
      frequency: rule.frequency,
    }
    const now = Date.now()

    await db.collection('families')
      .doc(this.familyId)
      .update({
        care_rules: dbCmd.push(careRule),
        ...buildVersionUpdate(dbCmd, now),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'family',
      targetType: 'care_rule',
      targetId: `${this.familyId}:${careRule.status_trigger}:${careRule.task_description}`,
      targetName: careRule.task_description,
      summary: `添加了护理规则 ${careRule.task_description}`,
      meta: careRule,
    })

    const { data: updatedFamilies } = await db.collection('families')
      .doc(this.familyId)
      .get()
    const updatedFamily = updatedFamilies?.[0] || updatedFamilies
    const response = {
      message: '护理规则已添加',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedFamily ? [buildTouchedEntity('families', updatedFamily)] : [],
        resyncScopes: ['families'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 删除护理规则
   * @param {number} index - 规则在数组中的索引
   */
  async removeCareRule(input) {
    requireAdmin(this.role)
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const index = typeof input === 'object' ? Number(input?.index) : Number(input)

    if (typeof index !== 'number' || index < 0) {
      throw new Error('无效的规则索引')
    }

    // 先获取当前规则列表
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ care_rules: true })
      .get()

    const family = data[0] || data
    if (!family) throw new Error('家庭不存在')
    const conflict = getEntityConflict(syncMeta, 'families', { _id: this.familyId, ...family })
    if (conflict) return conflict
    if (!family.care_rules || index >= family.care_rules.length) {
      throw new Error('规则不存在')
    }

    const removedRule = family.care_rules[index]
    family.care_rules.splice(index, 1)
    const now = Date.now()

    await db.collection('families')
      .doc(this.familyId)
      .update({
        care_rules: family.care_rules,
        ...buildVersionUpdate(dbCmd, now),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'family',
      targetType: 'care_rule',
      targetId: `${this.familyId}:${index}`,
      targetName: removedRule.task_description || '护理规则',
      summary: `删除了护理规则 ${removedRule.task_description || ''}`.trim(),
      meta: removedRule,
    })

    const { data: updatedFamilies } = await db.collection('families')
      .doc(this.familyId)
      .get()
    const updatedFamily = updatedFamilies?.[0] || updatedFamilies
    const response = {
      message: '护理规则已删除',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedFamily ? [buildTouchedEntity('families', updatedFamily)] : [],
        resyncScopes: ['families'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  // ── 协作 ──

  /**
   * 生成邀请码（6位随机码，24小时有效）
   */
  async generateInviteLink() {
    requireAdmin(this.role)

    const crypto = require('crypto')
    const code = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase()
    const now = Date.now()
    const inviteExpires = now + 24 * 60 * 60 * 1000

    await db.collection('families')
      .doc(this.familyId)
      .update({
        invite_code: code,
        invite_expires: inviteExpires,
        updated_at: now,
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'invite',
      domain: 'family',
      targetType: 'invite_code',
      targetId: code,
      targetName: code,
      summary: `生成了邀请码 ${code}`,
      createdAt: now,
    })

    return { data: { code, invite_expires: inviteExpires } }
  },

  /**
   * 通过邀请码加入家庭
   */
  async joinFamily(inviteCode) {
    const normalizedInviteCode = typeof inviteCode === 'string'
      ? inviteCode.trim()
      : String(inviteCode?.invite_code || inviteCode?.code || '').trim()
    if (!normalizedInviteCode) throw new Error('请输入邀请码')
    if (this.familyId) throw new Error('您已加入家庭，V1 暂不支持多家庭')

    const now = Date.now()

    const { data: families } = await db.collection('families')
      .where({
        invite_code: normalizedInviteCode.toUpperCase(),
        invite_expires: dbCmd.gt(now),
      })
      .limit(1)
      .get()

    if (!families || families.length === 0) throw new Error('邀请码无效或已过期')

    const family = families[0]

    // 检查是否已是成员
    const existing = family.members.find(m => m.user_id === this.uid)
    if (existing) {
      if (existing.status === 'active') throw new Error('您已是该家庭成员')
      // 重新激活：需要 read-modify-write（修改现有数组元素）
      existing.status = 'active'
      existing.joined_at = now
      existing.removed_at = null
      await db.collection('families').doc(family._id).update({
        members: family.members,
        updated_at: now,
      })
    } else {
      // 新成员：使用 dbCmd.push 避免并发竞争
      await db.collection('families').doc(family._id).update({
        members: dbCmd.push({
          user_id: this.uid,
          role: 'helper',
          status: 'active',
          joined_at: now,
        }),
        updated_at: now,
      })
    }

    await safeWriteOperationLog({
      familyId: family._id,
      actorUserId: this.uid,
      actionType: 'join',
      domain: 'family',
      targetType: 'family_member',
      targetId: this.uid,
      targetName: family.name,
      summary: `加入了家庭 ${family.name}`,
      createdAt: now,
    })

    return { data: { familyId: family._id, familyName: family.name } }
  },

  /**
   * 获取成员列表
   */
  async getMemberList() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, name: true, creator_id: true })
      .get()

    const family = data[0] || data
    const activeMembers = (family.members || []).filter(m => m.status === 'active')

    return { data: activeMembers }
  },

  /**
   * 更新成员角色
   */
  async updateMemberRole(userId, newRole) {
    requireAdmin(this.role)
    if (!userId) throw new Error('缺少用户 ID')
    if (!['admin', 'helper'].includes(newRole)) throw new Error('无效角色')

    const now = Date.now()

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, creator_id: true })
      .get()

    const family = data[0] || data
    const member = family.members.find(m => m.user_id === userId && m.status === 'active')
    if (!member) throw new Error('成员不存在')
    if (member.role === 'creator') throw new Error('不能更改创建者角色')

    // 非创建者不能设置管理员
    if (newRole === 'admin' && this.role !== 'creator') {
      throw new Error('仅创建者可设置管理员')
    }

    const previousRole = member.role
    member.role = newRole

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: now,
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'role_change',
      domain: 'family',
      targetType: 'family_member',
      targetId: userId,
      targetName: member.nickname || userId,
      summary: `将成员 ${member.nickname || userId} 的角色从 ${previousRole} 改为 ${newRole}`,
      meta: { previousRole, newRole },
      createdAt: now,
    })

    return { message: '角色已更新' }
  },

  /**
   * 移除成员
   */
  async removeMember(userId) {
    requireAdmin(this.role)
    if (!userId) throw new Error('缺少用户 ID')
    if (userId === this.uid) throw new Error('不能移除自己')

    const now = Date.now()

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, creator_id: true })
      .get()

    const family = data[0] || data
    const member = family.members.find(m => m.user_id === userId && m.status === 'active')
    if (!member) throw new Error('成员不存在')
    if (member.role === 'creator') throw new Error('不能移除创建者')

    // 非创建者不能移除管理员
    if (member.role === 'admin' && this.role !== 'creator') {
      throw new Error('仅创建者可移除管理员')
    }

    member.status = 'removed'
    member.removed_at = now

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: now,
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'family',
      targetType: 'family_member',
      targetId: userId,
      targetName: member.nickname || userId,
      summary: `移除了成员 ${member.nickname || userId}`,
      createdAt: now,
    })

    return { message: '成员已移除' }
  },

  /**
   * 更新当前用户昵称
   * @param {string} nickname - 新昵称
   */
  async updateNickname(input) {
    const nickname = typeof input === 'object' ? input?.nickname : input
    if (!nickname || !nickname.trim()) {
      throw new Error('请输入昵称')
    }
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, version: true })
      .get()

    const family = data[0] || data
    if (!family) throw new Error('家庭不存在')
    const conflict = getEntityConflict(syncMeta, 'families', { _id: this.familyId, ...family })
    if (conflict) return conflict
    const member = family.members.find(m => m.user_id === this.uid && m.status === 'active')
    if (!member) throw new Error('成员不存在')

    const previousNickname = String(member.nickname || '').trim()
    const nextNickname = nickname.trim()
    member.nickname = nextNickname
    const now = Date.now()

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      ...buildVersionUpdate(dbCmd, now),
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actorName: previousNickname || this.uid,
      actionType: 'update',
      domain: 'family',
      targetType: 'family_member',
      targetId: this.uid,
      targetName: nextNickname,
      summary: previousNickname
        ? `将昵称从 ${previousNickname} 更新为 ${nextNickname}`
        : `将昵称更新为 ${nextNickname}`,
    })

    const { data: updatedFamilies } = await db.collection('families')
      .doc(this.familyId)
      .get()
    const updatedFamily = updatedFamilies?.[0] || updatedFamilies
    const response = {
      message: '昵称已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedFamily ? [buildTouchedEntity('families', updatedFamily)] : [],
        resyncScopes: ['families'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  // ── 操作日志 / 回收站 / 备份 / 护理规则 ──

  /**
   * 获取操作日志
   */
  async getOperationLogs(input = {}) {
    const query = normalizeOperationLogQuery(input)
    const where = {
      family_id: this.familyId,
      created_at: dbCmd.gte(query.start).and(dbCmd.lte(query.end)),
    }

    if (query.actorUserIds.length > 0) {
      where.actor_user_id = dbCmd.in(query.actorUserIds)
    }

    if (query.actionTypes.length > 0) {
      where.action_type = dbCmd.in(query.actionTypes)
    }

    let logs = []
    try {
      const result = await db.collection('operation_logs')
        .where(where)
        .orderBy('created_at', 'desc')
        .limit(1000)
        .get()
      logs = result.data || []
    } catch (error) {
      if (!isOperationLogCollectionMissingError(error)) {
        throw error
      }

      console.warn('[operation-log] collection missing, return empty logs')
      return {
        list: [],
        hasMore: false,
        total: 0,
      }
    }

    const visibleLogs = logs.filter(log => !isZeroEffectOperationLog(log))
    const sortedLogs = visibleLogs.sort((left, right) => (right.created_at || 0) - (left.created_at || 0))
    const total = sortedLogs.length
    const startIndex = (query.page - 1) * query.pageSize
    const list = sortedLogs.slice(startIndex, startIndex + query.pageSize)

    return {
      list,
      hasMore: startIndex + query.pageSize < total,
      total,
    }
  },

  /**
   * 获取已删除项目（回收站）
   */
  async getDeletedItems() {
    const lists = await Promise.all(
      Object.keys(RECYCLE_SUPPORTED_TYPES).map(type => getDeletedDocsByType(this.familyId, type)),
    )

    return {
      data: lists
        .flat()
        .sort((left, right) => (right.deleted_at || 0) - (left.deleted_at || 0)),
    }
  },

  /**
   * 恢复回收站项目
   * @param {{ id: string, type: string }} input
   */
  async restoreItem(input) {
    requireAdmin(this.role)

    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const { id, type } = parseRecycleItemInput(input)
    const { config, doc } = await getSoftDeletedDocByType(this.familyId, type, id)

    if (!doc) {
      throw new Error('回收站项目不存在')
    }

    const now = Date.now()
    await db.collection(config.collection).doc(id).update({
      deleted_at: null,
      ...buildVersionUpdate(dbCmd, now),
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'restore',
      domain: 'recycle',
      targetType: type,
      targetId: id,
      targetName: config.name(doc),
      summary: `恢复了回收站项目 ${config.typeLabel}：${config.name(doc)}`,
    })

    const restoredDoc = { ...doc, deleted_at: null, updated_at: now, version: Number(doc.version || 0) + 1 }
    const response = {
      message: '已恢复',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [buildTouchedEntity(config.collection, restoredDoc)],
        resyncScopes: [config.collection],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 永久删除回收站项目
   * @param {{ id: string, type: string }} input
   */
  async permanentDeleteItem(input) {
    requireAdmin(this.role)

    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const { id, type } = parseRecycleItemInput(input)
    const { config, doc } = await getSoftDeletedDocByType(this.familyId, type, id)

    if (!doc) {
      throw new Error('回收站项目不存在')
    }

    await db.collection(config.collection).doc(id).remove()

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'recycle',
      targetType: type,
      targetId: id,
      targetName: config.name(doc),
      summary: `永久删除了回收站项目 ${config.typeLabel}：${config.name(doc)}`,
    })

    const response = {
      message: '已永久删除',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [{
          collection: config.collection,
          id,
          version: Number(doc.version || 0),
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        }],
        resyncScopes: [config.collection],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取备份信息
   */
  async getBackupInfo() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true, created_at: true })
      .get()

    const family = data?.[0] || data || {}
    const settings = mergeFamilySettings(family.settings)
    const lastBackupDate = settings.last_backup_date || null
    const autoBackupEnabled = !!settings.auto_backup_enabled
    return {
      data: {
        last_backup: lastBackupDate,
        auto_backup: autoBackupEnabled,
        lastBackupDate,
        autoBackupEnabled,
      }
    }
  },

  /**
   * 导出或创建备份文件
   * @param {{ format?: 'json' | 'csv', mode?: 'backup' | 'export' }} input
   */
  async exportData(input = {}) {
    requireAdmin(this.role)
    const { format, mode } = normalizeExportInput(input)
    const result = await createFamilyArchiveFile(this.familyId, { format, mode })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'export',
      domain: 'family',
      targetType: 'backup',
      targetId: this.familyId,
      targetName: mode === 'backup' ? '数据备份' : '数据导出',
      summary: mode === 'backup' ? '创建了一份数据备份' : `导出了 ${format.toUpperCase()} 数据归档`,
      meta: {
        format,
        mode,
        size: result.data.size,
        created_at: result.data.created_at,
      },
    })

    return result
  },

  /**
   * 获取最近备份历史
   */
  async getBackupHistory() {
    requireAdmin(this.role)
    const files = await buildBackupHistory(this.familyId)
    return { data: { files } }
  },

  /**
   * 从最近备份恢复业务数据
   * @param {{ fileID?: string }} input
   */
  async restoreBackup(input = {}) {
    requireAdmin(this.role)
    const allowedFileIds = await getFamilyBackupFileIds(this.familyId)
    const fileID = String(input.fileID || allowedFileIds[allowedFileIds.length - 1] || '').trim()
    if (!fileID) throw new Error('暂无可恢复的备份')
    if (!allowedFileIds.includes(fileID)) throw new Error('备份文件不在最近备份列表中')

    const archive = await readBackupArchive(fileID)
    const preRestore = await createFamilyArchiveFile(this.familyId, { format: 'json', mode: 'backup' })
    const restoredCollections = await restoreArchiveCollections(this.familyId, archive)

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'restore',
      domain: 'family',
      targetType: 'backup',
      targetId: this.familyId,
      targetName: '数据恢复',
      summary: '从备份恢复了业务数据',
      meta: {
        restored_file_id: fileID,
        pre_restore_file_id: preRestore.data.fileID,
        restored_collections: restoredCollections,
      },
    })

    return {
      data: {
        restored: true,
        restored_file_id: fileID,
        pre_restore_file_id: preRestore.data.fileID,
        restored_collections: restoredCollections,
      },
    }
  },

  /**
   * 安全修复低风险技术一致性问题
   * @param {{ dryRun?: boolean }} input
   */
  async repairData(input = {}) {
    requireAdmin(this.role)
    const result = await repairFamilyData(this.familyId, input)

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'repair',
      domain: 'family',
      targetType: 'data',
      targetId: this.familyId,
      targetName: '数据修复',
      summary: `执行了数据修复，修复 ${result.repairedCount} 项`,
      meta: {
        repairedCount: result.repairedCount,
        warningCount: result.warnings.length,
        dryRun: !!input?.dryRun,
      },
    })

    return { data: result }
  },

  /**
   * 定时任务：每周自动备份已开启的家庭
   */
  async _timing_weeklyBackup() {
    const { data } = await db.collection('families').get()
    const now = Date.now()
    let created = 0
    let skipped = 0
    const failures = []

    for (const family of data || []) {
      const settings = mergeFamilySettings(family.settings)
      if (!settings.auto_backup_enabled) {
        skipped++
        continue
      }
      if (settings.last_backup_date && now - Number(settings.last_backup_date) < 7 * 86400000) {
        skipped++
        continue
      }

      try {
        await createFamilyArchiveFile(family._id, { format: 'json', mode: 'backup', now })
        created++
      } catch (error) {
        failures.push({
          family_id: family._id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return { data: { created, skipped, failures } }
  },

  /**
   * 定时任务：清理超过保留期且不再被引用的附件
   */
  async _timing_dailyCleanupAttachments(input = {}) {
    const limit = Number(input?.limit || 100)
    const data = await cleanupPendingAttachmentDeletions(db, {
      familyId: input?.familyId || '',
      now: Date.now(),
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100,
      dryRun: !!input?.dryRun,
    })
    return { data }
  },

  /**
   * 获取护理规则
   */
  async getCareRules() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ care_rules: true })
      .get()

    const family = data[0] || data
    return { data: family.care_rules || [] }
  },
}
