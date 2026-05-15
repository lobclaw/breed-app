import { hasPendingUploadImages } from '@/localdb/runtime/attachments'

const EXTRA_ARRANGEMENT_TITLE_MAP: Record<string, string> = {
  contact_doctor: '联系医生',
  recheck_observe: '复测观察',
  preparation: '准备事项',
  other: '其他安排',
}

export function normalizeDogName(dog: Record<string, any> | null | undefined) {
  return dog?.name || dog?.dog_name || '未命名'
}

export function getHealthVariantKey(type: string, details: Record<string, any> = {}) {
  if (type === 'vaccination') {
    return `vaccination:${details.vaccine_type || ''}`
  }
  if (type === 'deworming') {
    return `deworming:${details.deworming_type || ''}:${details.drug_name || ''}`
  }
  if (type === 'illness') {
    return `illness:${details.primary_condition || details.condition || ''}`
  }
  return type || ''
}

export function shouldSkipDuplicateHealthRecord(type: string) {
  return type === 'vaccination' || type === 'deworming'
}

export function buildLocalTaskFromManualPayload(familyId: string, dog: Record<string, any>, data: Record<string, any>, taskId: string, now: number) {
  const title = data.title
    || (data.type === 'vaccination' ? (data.details?.vaccine_type ? `疫苗 · ${data.details.vaccine_type}` : '疫苗') : '')
    || (data.type === 'deworming' ? (data.details?.drug_name ? `驱虫 · ${data.details.drug_name}` : '驱虫') : '')
    || data.type

  return {
    _id: taskId,
    card_type: data.card_type || 'individual',
    dog_id: dog.dog_id || dog._id,
    dog_name: dog.dog_name || dog.name || '',
    type: data.type,
    title,
    due_date: data.due_date,
    status: 'pending',
    priority: data.due_date <= now ? 'overdue' : 'upcoming',
    next_reminder_date: data.next_reminder_date || null,
    details: data.details || null,
    source_record_id: null,
    source_collection: null,
    family_id: familyId,
    postpone_count: 0,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

export function buildLocalHealthRecord(familyId: string, dog: Record<string, any>, data: Record<string, any>, recordId: string, now: number, cost: number | null = null) {
  const pendingUpload = hasPendingUploadImages(data.details?.images || data.images)
  return {
    _id: recordId,
    type: data.type,
    dog_id: dog._id || dog.dog_id,
    dog_name: normalizeDogName(dog),
    family_id: familyId,
    date: data.date,
    cost,
    notes: data.notes || null,
    details: data.details || {},
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  }
}

export function buildLocalBreedingRecord(familyId: string, dog: Record<string, any>, data: Record<string, any>, recordId: string, cycleId: string, now: number) {
  const pendingUpload = hasPendingUploadImages(data.details?.images || data.images)
  return {
    _id: recordId,
    type: data.type,
    cycle_id: cycleId,
    dog_id: dog._id || data.dog_id,
    dog_name: normalizeDogName(dog),
    family_id: familyId,
    date: data.date,
    cost: data.cost || null,
    notes: data.notes || null,
    details: data.details || {},
    extra_arrangement: data.extra_arrangement || null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  }
}

export function isLocalPregnancyConfirmed(details: Record<string, any> = {}) {
  return details.confirmed === '是' || details.confirmed === true
}

export function isLocalPregnancyRejected(details: Record<string, any> = {}) {
  return details.confirmed === '否' || details.confirmed === false
}

export function isLocalAbandonMatingTermination(details: Record<string, any> = {}) {
  return details.termination_type === '放弃配种'
}

export function hasLocalPrenatalCheckContent(details: Record<string, any> = {}) {
  return !!String(details.results || '').trim()
    || (Array.isArray(details.images) && details.images.some(item => String(item || '').trim()))
}

export function shouldClearLocalBreedingMilestones(data: Record<string, any>) {
  if (['heat', 'follicle_check', 'mating', 'abnormal_termination'].includes(data.type)) return true
  if (data.type === 'pregnancy_check') {
    return isLocalPregnancyConfirmed(data.details || {}) || isLocalPregnancyRejected(data.details || {})
  }
  return false
}

export function getLatestLocalBreedingRecord(records: Record<string, any>[], type: string) {
  return records
    .filter(record => !record.deleted_at && record.type === type)
    .slice()
    .sort((left, right) => {
      const dateDiff = Number(right.date || 0) - Number(left.date || 0)
      if (dateDiff !== 0) return dateDiff
      const updatedDiff = Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0)
      if (updatedDiff !== 0) return updatedDiff
      return `${right._id || ''}`.localeCompare(`${left._id || ''}`)
    })[0] || null
}

export function buildLocalBreedingExtraTask(
  familyId: string,
  dog: Record<string, any>,
  cycleId: string,
  recordId: string,
  extraArrangement: Record<string, any>,
  taskId: string,
  now: number,
) {
  const title = EXTRA_ARRANGEMENT_TITLE_MAP[extraArrangement.kind] || EXTRA_ARRANGEMENT_TITLE_MAP.other
  const dueDate = Number(extraArrangement.due_date || 0)
  return {
    _id: taskId,
    card_type: 'individual',
    dog_id: dog._id,
    dog_name: normalizeDogName(dog),
    cycle_id: cycleId,
    type: 'breeding_extra_arrangement',
    title,
    due_date: dueDate,
    status: 'pending',
    priority: dueDate <= now ? 'overdue' : 'upcoming',
    source_record_id: recordId,
    source_collection: 'breeding_records',
    family_id: familyId,
    postpone_count: 0,
    details: {
      kind: extraArrangement.kind,
      notes: extraArrangement.notes || null,
      anchor_type: extraArrangement.anchor_type || 'cycle',
      anchor_id: cycleId,
      dog_id: dog._id,
      source_record_id: recordId,
      manual: true,
    },
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

export function buildLocalBreedingExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  cycleId: string,
  recordId: string,
  expenseId: string,
  now: number,
) {
  const sourceLabels: Record<string, string> = {
    heat: '发情',
    heat_observation: '发情观察',
    follicle_check: '卵泡检查',
    mating: '配种',
    pregnancy_check: '孕检',
    prenatal_check: '产检',
    pre_labor: '临产监测',
    birth: '生产',
    abnormal_termination: '异常终止',
  }
  const categoryMap: Record<string, string> = {
    follicle_check: '检查化验',
    mating: '配种费',
    pregnancy_check: '孕检产检',
    prenatal_check: '孕检产检',
    pre_labor: '孕检产检',
    birth: '生产育幼',
    abnormal_termination: '生产育幼',
  }
  const sourceLabel = sourceLabels[data.type] || '繁育'
  const category = categoryMap[data.type] || '其他'
  const noteText = typeof data.notes === 'string' ? data.notes.trim() : ''

  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: Number(data.cost),
    category,
    date: Number(data.date || now),
    linked_cycle_id: cycleId,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: recordId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: noteText
      ? (sourceLabel !== category ? `${sourceLabel} · ${noteText}` : noteText)
      : (sourceLabel !== category ? sourceLabel : null),
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function buildLocalDogPurchaseExpense(
  familyId: string,
  data: Record<string, any>,
  dogId: string,
  expenseId: string,
  now: number,
) {
  const dogName = String(data.name || '').trim()
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: Number(data.purchase_price),
    category: '购入',
    date: Number(data.purchase_date || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dogId],
    source_type: 'auto',
    source_record_id: dogId,
    images: [],
    dam_name: dogName || null,
    dog_names: [dogName],
    litter_number: null,
    notes: `购入${data.role === '外部种公' ? '外部种公' : '种犬'}：${dogName}`,
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function buildLocalDogPurchaseExpenseSnapshot(
  familyId: string,
  dog: Record<string, any>,
  amount: number,
  purchaseDate: number | null,
  expenseId: string,
  now: number,
  options: {
    version?: number
    createdAt?: number
  } = {},
) {
  const dogName = normalizeDogName(dog)
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category: '购入',
    date: Number(purchaseDate || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: dog._id,
    images: [],
    dam_name: dogName || null,
    dog_names: [dogName],
    litter_number: null,
    notes: `购入${dog.role === '外部种公' ? '外部种公' : '种犬'}：${dogName}`,
    created_by: null,
    deleted_at: null,
    version: Number(options.version || 0),
    created_at: Number(options.createdAt || now),
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function buildLocalHealthExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  recordId: string,
  amount: number,
  expenseId: string,
  now: number,
) {
  const sourceLabels: Record<string, string> = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '治疗',
  }
  const categoryMap: Record<string, string> = {
    vaccination: '疫苗驱虫',
    deworming: '疫苗驱虫',
    illness: '医疗',
  }
  const sourceLabel = sourceLabels[data.type] || '健康'
  const category = categoryMap[data.type] || '其他'
  const noteText = typeof data.notes === 'string' ? data.notes.trim() : ''

  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category,
    date: Number(data.date || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: recordId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: noteText
      ? (sourceLabel !== category ? `${sourceLabel} · ${noteText}` : noteText)
      : (sourceLabel !== category ? sourceLabel : null),
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function buildLocalMedicationExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  medicationTaskId: string,
  amount: number,
  durationDays: number,
  startDate: number,
  expenseId: string,
  now: number,
) {
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category: '医疗',
    date: startDate,
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: medicationTaskId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: `${data.drug_name} ${durationDays}天`,
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function parseAdoptionFeeAmount(data: Record<string, any>) {
  const directAmount = Number(data.adoption_fee ?? data.adoptionFee)
  if (Number.isFinite(directAmount) && directAmount > 0) return directAmount

  const notesText = String(data.disposition_notes || '').trim()
  const matchedAmount = notesText.match(/领养费用：¥\s*([0-9]+(?:\.[0-9]+)?)/)
  if (!matchedAmount?.[1]) return 0

  const parsedAmount = Number(matchedAmount[1])
  return Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0
}

export function buildLocalAdoptionIncome(
  familyId: string,
  dog: Record<string, any>,
  amount: number,
  date: number,
  notes: string | null,
  incomeId: string,
  now: number,
) {
  return {
    _id: incomeId,
    family_id: familyId,
    dog_id: dog._id,
    dog_name: normalizeDogName(dog),
    type: '领养',
    amount,
    date,
    source_sale_id: null,
    source_type: 'auto',
    source_record_id: dog._id,
    notes: notes || null,
    images: [],
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

export function buildLocalDog(familyId: string, data: Record<string, any>, dogId: string, now: number) {
  return {
    _id: dogId,
    name: data.name || '',
    gender: data.gender,
    role: data.role,
    disposition: data.disposition || '在养',
    species: data.species || '犬',
    breed: data.breed || '',
    birth_date: data.birth_date || null,
    purchase_date: data.purchase_date || null,
    purchase_price: data.purchase_price || null,
    latest_weight: data.latest_weight || null,
    family_id: familyId,
    origin_litter_id: data.origin_litter_id || null,
    owner_info: data.owner_info || null,
    disposition_date: null,
    disposition_notes: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}
