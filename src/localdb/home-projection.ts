import type { SyncTouchedEntity } from '@/localdb/types'
import { getBeijingDateParts, getBeijingDayStart, getBeijingElapsedDays, getBeijingOrdinalDay } from '@/utils/date'

const DAY_MS = 86400000
const BREEDING_EXTRA_TYPES = new Set([
  'breeding_extra_arrangement',
  'heat',
  'follicle_check',
  'mating',
  'pregnancy_check',
  'prenatal_check',
  'pre_labor',
  'abnormal_termination',
])

type GenericRow = Record<string, any>

export interface HomeProjectionEntities {
  dogs: readonly GenericRow[]
  tasks: readonly GenericRow[]
  health_records: readonly GenericRow[]
  medication_tasks: readonly GenericRow[]
  breeding_cycles?: readonly GenericRow[]
  breeding_records?: readonly GenericRow[]
}

function rowBelongsToFamily(row: GenericRow, familyId: string) {
  if (!familyId) return true
  return row?.family_id === familyId || row?._id === familyId
}

function filterEntitiesByFamily(entities: HomeProjectionEntities, familyId = ''): HomeProjectionEntities {
  if (!familyId) return entities
  return {
    dogs: (entities.dogs || []).filter(row => rowBelongsToFamily(row, familyId)),
    tasks: (entities.tasks || []).filter(row => rowBelongsToFamily(row, familyId)),
    health_records: (entities.health_records || []).filter(row => rowBelongsToFamily(row, familyId)),
    medication_tasks: (entities.medication_tasks || []).filter(row => rowBelongsToFamily(row, familyId)),
  }
}

function getBeijingDayContext(now = Date.now()) {
  const parts = getBeijingDateParts(now)
  const start = getBeijingDayStart(now)

  return {
    currentTime: `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`,
    dayStart: start,
    dayEnd: start + DAY_MS - 1,
  }
}

function startOfDay(ts: number) {
  return getBeijingDayContext(ts).dayStart
}

function getMaxTimestamp(...values: Array<number | null | undefined>) {
  return values.reduce<number>((max, value) => {
    const next = Number(value || 0)
    return next > max ? next : max
  }, 0)
}

function getOverdueDays(dueDate?: number | null, now = Date.now()) {
  if (!dueDate) return 1
  const diff = getBeijingElapsedDays(dueDate, now)
  return Math.max(1, diff)
}

function normalizeIllnessCondition(condition: unknown) {
  return typeof condition === 'string' ? condition.trim() : ''
}

function getIllnessPrimaryCondition(source: Record<string, any> = {}) {
  return normalizeIllnessCondition(source.primary_condition || source.condition || '')
}

function getIllnessSymptomSummary(source: Record<string, any> = {}, limit = 2) {
  const tags = Array.isArray(source.symptom_tags)
    ? source.symptom_tags
      .map((item: unknown) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : []

  if (!tags.length) return ''
  if (tags.length <= limit) return tags.join(' / ')
  return `${tags.slice(0, limit).join(' / ')} 等${tags.length}项`
}

function isBreedingExtraTask(task: GenericRow) {
  return BREEDING_EXTRA_TYPES.has(task?.type)
}

function getTaskDomain(task: GenericRow) {
  if (!task) return 'health'
  if (task.type === 'medication') return 'medication'
  if (task.type === 'breeding_milestone' || task.type === 'care_group' || isBreedingExtraTask(task)) {
    return 'breeding'
  }
  return 'health'
}

function isAlwaysBatchHealthTask(task: GenericRow) {
  return task?.type === 'vaccination' || task?.type === 'deworming'
}

function getTaskVariantKey(task: GenericRow) {
  if (!task) return ''
  if (task.type === 'breeding_extra_arrangement') {
    return `breeding_extra_arrangement:${task.details?.kind || ''}:${task.details?.anchor_id || task.cycle_id || ''}:${task.due_date || ''}`
  }
  if (task.type === 'vaccination') {
    return `vaccination:${task.details?.vaccine_type || ''}`
  }
  if (task.type === 'deworming') {
    return `deworming:${task.details?.deworming_type || ''}:${task.details?.drug_name || ''}`
  }
  if (task.type === 'illness') {
    return `illness:${getIllnessPrimaryCondition(task.details || {})}`
  }
  return task.type || ''
}

function getTaskDisplayTitle(task: GenericRow) {
  if (!task) return ''
  if (task.type === 'breeding_extra_arrangement') {
    return task.title || '额外安排'
  }
  if (task.type === 'vaccination') {
    if (task.details?.vaccine_type) return `疫苗 · ${task.details.vaccine_type}`
    return task.title || '疫苗'
  }
  if (task.type === 'deworming') {
    const subtypeLabelMap: Record<string, string> = {
      internal: '内驱',
      external: '外驱',
      combo: '内外同驱',
    }
    if (task.details?.drug_name) return `驱虫 · ${task.details.drug_name}`
    if (task.details?.deworming_type) {
      return `驱虫 · ${subtypeLabelMap[task.details.deworming_type] || task.details.deworming_type}`
    }
    return task.title || '驱虫'
  }
  if (task.type === 'illness') {
    return getIllnessPrimaryCondition(task.details || {}) || task.title || '疾病'
  }
  return task.title || task.type || ''
}

function getTaskPriority(task: GenericRow, todayStartMs: number, todayEndMs: number) {
  if (!task) return 'upcoming'
  if (task.type === 'breeding_milestone') {
    return task.due_date <= todayEndMs ? 'today' : 'upcoming'
  }
  if (task.due_date < todayStartMs) return 'overdue'
  if (task.due_date <= todayEndMs) return 'today'
  return 'upcoming'
}

function getBreedingMilestoneIdentity(task: GenericRow) {
  if (task?.type !== 'breeding_milestone') return ''
  if (task.litter_id) return `breeding_milestone:litter:${task.litter_id}`
  if (task.cycle_id) return `breeding_milestone:cycle:${task.cycle_id}`
  return ''
}

function shouldPreferBreedingMilestone(candidate: GenericRow, current: GenericRow) {
  const candidateUpdated = candidate?.updated_at || candidate?.created_at || 0
  const currentUpdated = current?.updated_at || current?.created_at || 0
  if (candidateUpdated !== currentUpdated) return candidateUpdated > currentUpdated

  const candidateDueDate = candidate?.due_date || 0
  const currentDueDate = current?.due_date || 0
  if (candidateDueDate !== currentDueDate) return candidateDueDate > currentDueDate

  return `${candidate?._id || ''}` > `${current?._id || ''}`
}

function dedupeBreedingMilestones(tasks: GenericRow[]) {
  const deduped: GenericRow[] = []
  const indexMap = new Map<string, number>()

  for (const task of tasks) {
    const identity = getBreedingMilestoneIdentity(task)
    if (!identity) {
      deduped.push(task)
      continue
    }

    if (!indexMap.has(identity)) {
      indexMap.set(identity, deduped.length)
      deduped.push(task)
      continue
    }

    const existingIndex = indexMap.get(identity)!
    const existingTask = deduped[existingIndex]
    if (shouldPreferBreedingMilestone(task, existingTask)) {
      deduped[existingIndex] = task
    }
  }

  return deduped
}

function getLatestBreedingRecord(records: GenericRow[], type: string) {
  return records
    .filter(record => !record.deleted_at && record.type === type)
    .slice()
    .sort((left, right) => {
      const dateDiff = Number(right?.date || 0) - Number(left?.date || 0)
      if (dateDiff !== 0) return dateDiff
      const updatedDiff = Number(right?.updated_at || right?.created_at || 0) - Number(left?.updated_at || left?.created_at || 0)
      if (updatedDiff !== 0) return updatedDiff
      return `${right?._id || ''}`.localeCompare(`${left?._id || ''}`)
    })[0] || null
}

function getEarliestBreedingRecord(records: GenericRow[], type: string) {
  return records
    .filter(record => !record.deleted_at && record.type === type)
    .slice()
    .sort((left, right) => {
      const dateDiff = Number(left?.date || 0) - Number(right?.date || 0)
      if (dateDiff !== 0) return dateDiff
      const updatedDiff = Number(left?.updated_at || left?.created_at || 0) - Number(right?.updated_at || right?.created_at || 0)
      if (updatedDiff !== 0) return updatedDiff
      return `${left?._id || ''}`.localeCompare(`${right?._id || ''}`)
    })[0] || null
}

function countBreedingRecords(records: GenericRow[], type: string) {
  return records.filter(record => !record.deleted_at && record.type === type).length
}

function getFollicleResult(details: Record<string, any> = {}) {
  return typeof details?.result === 'string' ? details.result : ''
}

function isFollicleReady(details: Record<string, any> = {}) {
  return getFollicleResult(details) === '已成熟'
}

function isFollicleAbnormal(details: Record<string, any> = {}) {
  return getFollicleResult(details) === '发育不良'
}

function isPregnancyConfirmed(details: Record<string, any> = {}) {
  return details.confirmed === '是' || details.confirmed === true
}

function buildSyntheticBreedingMilestoneTask(
  cycle: GenericRow,
  familyId: string,
  stepType: string,
  title: string,
  dueDate: number,
  sourceRecordId: string | null,
  details: Record<string, any>,
  updatedAt: number,
) {
  const now = Date.now()
  return {
    _id: `synthetic_breeding_milestone:${cycle._id}:${stepType}`,
    card_type: 'individual',
    dog_id: cycle.dam_id,
    dog_name: cycle.dam_name || '',
    cycle_id: cycle._id,
    type: 'breeding_milestone',
    title,
    due_date: dueDate,
    status: 'pending',
    priority: dueDate <= now ? 'overdue' : 'upcoming',
    source_record_id: sourceRecordId,
    source_collection: 'breeding_records',
    family_id: familyId,
    postpone_count: 0,
    details,
    created_at: updatedAt,
    updated_at: updatedAt,
    _synthetic_local: true,
  }
}

export function buildPendingBreedingMilestones(entities: HomeProjectionEntities) {
  const cycles = (entities.breeding_cycles || []).filter(cycle => !cycle.deleted_at)
  const records = (entities.breeding_records || []).filter(record => !record.deleted_at)
  if (!cycles.length) return []

  const cyclesWithPendingTask = new Set(
    (entities.tasks || [])
      .filter(task => !task.deleted_at && task.type === 'breeding_milestone' && task.status === 'pending' && task.cycle_id)
      .map(task => String(task.cycle_id)),
  )

  const recordsByCycleId = new Map<string, GenericRow[]>()
  for (const record of records) {
    const cycleId = typeof record?.cycle_id === 'string' ? record.cycle_id : ''
    if (!cycleId) continue
    const bucket = recordsByCycleId.get(cycleId) || []
    bucket.push(record)
    recordsByCycleId.set(cycleId, bucket)
  }

  const syntheticTasks: GenericRow[] = []
  for (const cycle of cycles) {
    if (!cycle?._id || cyclesWithPendingTask.has(String(cycle._id))) continue

    const cycleRecords = recordsByCycleId.get(cycle._id) || []

    if (cycle.status === '发情中') {
      const latestMatingRecord = getLatestBreedingRecord(cycleRecords, 'mating')
      if (latestMatingRecord) continue

      const heatRecord = getEarliestBreedingRecord(cycleRecords, 'heat')
      const heatDate = Number(heatRecord?.date || cycle.start_date || cycle.created_at || 0)
      if (!heatDate) continue

      const latestFollicleRecord = getLatestBreedingRecord(cycleRecords, 'follicle_check')
      const follicleCheckCount = countBreedingRecords(cycleRecords, 'follicle_check')
      const updatedAt = getMaxTimestamp(
        cycle.updated_at,
        latestFollicleRecord?.updated_at,
        latestFollicleRecord?.created_at,
        heatRecord?.updated_at,
        heatRecord?.created_at,
      ) || Date.now()

      if (latestFollicleRecord) {
        const follicleResult = getFollicleResult(latestFollicleRecord.details || {})
        if (isFollicleReady(latestFollicleRecord.details || {})) {
          syntheticTasks.push(buildSyntheticBreedingMilestoneTask(
            cycle,
            cycle.family_id || latestFollicleRecord.family_id || '',
            'mating',
            `${cycle.dam_name || '母犬'} · 配种`,
            Number(latestFollicleRecord.date || updatedAt),
            latestFollicleRecord._id || null,
            {
              step_type: 'mating',
              follicle_check_date: latestFollicleRecord.date || null,
              heat_date: heatDate,
              follicle_result: follicleResult || null,
            },
            updatedAt,
          ))
          continue
        }

        syntheticTasks.push(buildSyntheticBreedingMilestoneTask(
          cycle,
          cycle.family_id || latestFollicleRecord.family_id || '',
          'follicle_check',
          `${cycle.dam_name || '母犬'} · 建议卵泡检查`,
          Number(latestFollicleRecord.date || updatedAt) + DAY_MS,
          latestFollicleRecord._id || null,
          {
            step_type: 'follicle_check',
            heat_date: heatDate,
            follicle_check_count: follicleCheckCount,
            follicle_result: follicleResult || null,
            latest_follicle_check_date: latestFollicleRecord.date || null,
            abnormal_result: isFollicleAbnormal(latestFollicleRecord.details || {}),
          },
          updatedAt,
        ))
        continue
      }

      syntheticTasks.push(buildSyntheticBreedingMilestoneTask(
        cycle,
        cycle.family_id || heatRecord?.family_id || '',
        'follicle_check',
        `${cycle.dam_name || '母犬'} · 建议卵泡检查`,
        heatDate + 10 * DAY_MS,
        heatRecord?._id || null,
        {
          step_type: 'follicle_check',
          heat_date: heatDate,
          follicle_check_count: 0,
          follicle_result: null,
          latest_follicle_check_date: null,
          abnormal_result: false,
        },
        updatedAt,
      ))
      continue
    }

    if (cycle.status === '怀孕中') {
      const latestMatingRecord = getLatestBreedingRecord(cycleRecords, 'mating')
      if (!latestMatingRecord?.date) continue

      const latestPregnancyRecord = getLatestBreedingRecord(cycleRecords, 'pregnancy_check')
      const updatedAt = getMaxTimestamp(
        cycle.updated_at,
        latestPregnancyRecord?.updated_at,
        latestPregnancyRecord?.created_at,
        latestMatingRecord?.updated_at,
        latestMatingRecord?.created_at,
      ) || Date.now()

      if (latestPregnancyRecord && isPregnancyConfirmed(latestPregnancyRecord.details || {})) {
        const expectedDueDate = Number(
          latestMatingRecord.details?.expected_due_date
          || (latestMatingRecord.date + 59 * DAY_MS),
        )
        syntheticTasks.push(buildSyntheticBreedingMilestoneTask(
          cycle,
          cycle.family_id || latestMatingRecord.family_id || '',
          'birth',
          `${cycle.dam_name || '母犬'} · 生产`,
          expectedDueDate,
          latestPregnancyRecord._id || latestMatingRecord._id || null,
          {
            step_type: 'birth',
            expected_due_date: expectedDueDate,
            mating_date: latestMatingRecord.date || null,
            mating_number: latestMatingRecord.details?.mating_number || null,
          },
          updatedAt,
        ))
        continue
      }

      const expectedCheckupDate = Number(
        latestMatingRecord.details?.expected_checkup_date
        || (latestMatingRecord.date + 25 * DAY_MS),
      )
      const expectedDueDate = Number(
        latestMatingRecord.details?.expected_due_date
        || (latestMatingRecord.date + 59 * DAY_MS),
      )
      syntheticTasks.push(buildSyntheticBreedingMilestoneTask(
        cycle,
        cycle.family_id || latestMatingRecord.family_id || '',
        'pregnancy_check',
        `${cycle.dam_name || '母犬'} · 建议孕检`,
        expectedCheckupDate,
        latestMatingRecord._id || null,
        {
          step_type: 'pregnancy_check',
          expected_due_date: expectedDueDate,
          expected_checkup_date: expectedCheckupDate,
          mating_number: latestMatingRecord.details?.mating_number || null,
        },
        updatedAt,
      ))
    }
  }

  return syntheticTasks
}

function getPendingHomeTasks(entities: HomeProjectionEntities) {
  return [
    ...((entities.tasks || []).filter(task => !task.deleted_at && task.status === 'pending')),
  ]
}

function highestPriority(tasks: GenericRow[]) {
  const order: Record<string, number> = { overdue: 1, today: 2, upcoming: 3 }
  let best = 'upcoming'
  for (const task of tasks) {
    if ((order[task.priority] || 3) < (order[best] || 3)) {
      best = task.priority
    }
  }
  return best
}

function computeMedItemsForBeijingDay(activeMedications: GenericRow[], targetDate: number) {
  const targetDayStart = getBeijingDayContext(targetDate).dayStart
  return (activeMedications || [])
    .map((med) => {
      const startDayStart = getBeijingDayContext(med.actual_start_date || med.start_date || med.created_at || targetDate).dayStart
      const currentDay = getBeijingOrdinalDay(startDayStart, targetDayStart) || 0
      if (currentDay < 1 || currentDay > (med.duration_days || 1)) return null
      const frequency = med.frequency || 1
      const todayDoses = med.daily_doses?.[String(currentDay)] || 0
      return {
        ...med,
        currentDay,
        todayDoses,
        isDoneToday: todayDoses >= frequency,
      }
    })
    .filter(Boolean)
}

function toLegacyMedItem(task: GenericRow) {
  const frequency = task.details?.frequency || 1
  const todayDoses = task.doses_given || 0
  return {
    _id: task._id,
    dog_id: task.dog_id,
    dog_name: task.dog_name,
    drug_name: task.details?.drug_name || '用药',
    dosage: task.details?.dosage || null,
    dosage_unit: task.details?.dosage_unit || null,
    method: task.details?.method || '口服',
    frequency,
    duration_days: task.details?.total_days || 1,
    actual_start_date: task.due_date || Date.now(),
    currentDay: task.details?.day || 1,
    todayDoses,
    isDoneToday: todayDoses >= frequency || task.status === 'completed',
    created_at: task.created_at || task.due_date || Date.now(),
    source_record_id: task.source_record_id || null,
  }
}

function computeMedItemsForDay(activeMedications: GenericRow[], targetDate: number) {
  return computeMedItemsForBeijingDay(activeMedications || [], targetDate)
}

function mergeTasks(tasks: GenericRow[], todayCompleted: GenericRow[] = [], activeIllnesses: GenericRow[] = [], medItems: GenericRow[] = [], now = Date.now()) {
  const cards: GenericRow[] = []
  const consumed = new Set<string>()
  const completedConsumed = new Set<string>()
  const todayDayStart = startOfDay(now)

  for (const task of [...tasks, ...todayCompleted]) {
    task.display_title = getTaskDisplayTitle(task)
  }

  const oldMedTasks = tasks.filter(task => task.type === 'medication')
  oldMedTasks.forEach(task => consumed.add(task._id))
  const mergedMedItems = [...medItems, ...oldMedTasks.map(toLegacyMedItem)]

  const medByDog = new Map<string, GenericRow[]>()
  for (const med of mergedMedItems) {
    if (!medByDog.has(med.dog_id)) medByDog.set(med.dog_id, [])
    medByDog.get(med.dog_id)!.push(med)
  }

  const illnessesByDog = new Map<string, GenericRow[]>()
  const illnessesById = new Map<string, GenericRow>()
  for (const illness of activeIllnesses) {
    const status = illness.details?.treatment_status || '观察中'
    const dogId = illness.dog_id
    const normalizedIllness = {
      dogId,
      dogName: illness.dog_name || '',
      illness: getIllnessPrimaryCondition(illness.details || {}) || '生病',
      symptomSummary: getIllnessSymptomSummary(illness.details || {}),
      severity: illness.details?.severity || '轻微',
      illnessId: illness._id,
      daysSick: getBeijingOrdinalDay(illness.date || illness.created_at || now, todayDayStart) || 1,
      treatmentStatus: status,
      _createdAt: illness.date || illness.created_at || 0,
    }

    if (!illnessesByDog.has(dogId)) illnessesByDog.set(dogId, [])
    illnessesByDog.get(dogId)!.push(normalizedIllness)
    illnessesById.set(illness._id, normalizedIllness)
  }

  const sickObserveDogs = activeIllnesses
    .map((illness) => {
      const status = illness.details?.treatment_status || '观察中'
      const dogMedications = medByDog.get(illness.dog_id) || []
      const explicitLinkedMedication = dogMedications.find(med => med.source_record_id && med.source_record_id === illness._id) || null
      const hasExplicitLinkedMedication = !!explicitLinkedMedication
      const hasFallbackMedication = dogMedications.some(med => !med.source_record_id)
      if (status === '治疗中' && (hasExplicitLinkedMedication || hasFallbackMedication)) return null

      const illnessStart = startOfDay(illness.date || illness.created_at || now)
      return {
        dogId: illness.dog_id,
        dogName: illness.dog_name || '',
        state: 'sick_only',
        illness: getIllnessPrimaryCondition(illness.details || {}) || '生病',
        symptomSummary: getIllnessSymptomSummary(illness.details || {}),
        severity: illness.details?.severity || '轻微',
        illnessId: illness._id,
        linkedMedicationTaskId: explicitLinkedMedication?._id || '',
        relationType: hasExplicitLinkedMedication ? 'linked' : (hasFallbackMedication ? 'fallback' : 'standalone'),
        daysSick: getBeijingOrdinalDay(illnessStart, todayDayStart) || 1,
        treatmentStatus: status,
        _createdAt: illness.date || illness.created_at || 0,
      }
    })
    .filter(Boolean) as GenericRow[]

  sickObserveDogs.sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0))

  const unitMap: Record<string, string> = { ml: 'ml', mg: 'mg', tablet: '片' }
  const hasPendingMed = mergedMedItems.some(med => !med.isDoneToday)
  const dogMap = new Map<string, GenericRow>()

  for (const [dogId, meds] of medByDog.entries()) {
    const uniqueDrugs = [...new Set(meds.map(med => med.drug_name).filter(Boolean))]
    const isMultiDrug = uniqueDrugs.length > 1
    const primary = meds[0]
    const dogIllnesses = illnessesByDog.get(dogId) || []
    const explicitlyLinkedIllnesses = meds
      .map(med => (med.source_record_id ? illnessesById.get(med.source_record_id) : null))
      .filter(Boolean) as GenericRow[]
    const medicatedIllnesses = explicitlyLinkedIllnesses.length > 0
      ? explicitlyLinkedIllnesses
      : dogIllnesses.filter(illness => illness.treatmentStatus === '治疗中')

    const medicatedIllnessNames = [...new Set(medicatedIllnesses.map(illness => illness.illness).filter(Boolean))]
    const medicatedSymptomSummaries = [...new Set(medicatedIllnesses.map(illness => illness.symptomSummary).filter(Boolean))]
    const relationType = explicitlyLinkedIllnesses.length > 0
      ? 'linked'
      : (medicatedIllnesses.length > 0 ? 'fallback' : 'standalone')

    const allMedTasksForDog = meds.map(med => ({
      _id: med._id,
      dog_id: med.dog_id,
      currentDay: med.currentDay,
      status: med.isDoneToday ? 'completed' : 'pending',
      doses_given: med.todayDoses,
      details: { drug_name: med.drug_name || '用药', frequency: med.frequency || 1 },
      dosageStr: med.dosage ? `${med.dosage}${unitMap[med.dosage_unit] || med.dosage_unit || 'mg'}` : '',
      progress: `第${med.currentDay}/${med.duration_days}天`,
      methodFreq: (med.frequency || 1) > 1 ? `${med.method || '口服'} 日${med.frequency}次` : (med.method || '口服'),
    }))

    dogMap.set(dogId, {
      dogId,
      dogName: primary.dog_name || '',
      state: medicatedIllnessNames.length > 0 ? 'sick_with_med' : 'med_only',
      illness: medicatedIllnessNames[0] || '',
      illnessNames: medicatedIllnessNames.join('/'),
      symptomSummary: medicatedSymptomSummaries[0] || '',
      illnessId: medicatedIllnesses.length === 1 ? medicatedIllnesses[0].illnessId : '',
      illnessIds: [...new Set(medicatedIllnesses.map(illness => illness.illnessId).filter(Boolean))],
      relationType,
      treatmentStatus: medicatedIllnessNames.length > 0 ? '治疗中' : '',
      drugName: isMultiDrug ? `${uniqueDrugs.length}种用药` : (primary.drug_name || '用药'),
      dosageStr: isMultiDrug ? '' : (primary.dosage ? `${primary.dosage}${unitMap[primary.dosage_unit] || primary.dosage_unit || 'mg'}` : ''),
      progress: isMultiDrug ? '' : `${primary.currentDay}/${primary.duration_days}天`,
      methodFreq: isMultiDrug ? '' : ((primary.frequency || 1) > 1 ? `${primary.method || '口服'} 日${primary.frequency}次` : (primary.method || '口服')),
      completed: meds.every(med => med.isDoneToday),
      allMedTasks: allMedTasksForDog,
      _createdAt: primary.created_at || 0,
    })
  }

  const medDogs = Array.from(dogMap.values())
    .filter(dog => dog.state !== 'sick_only')
    .sort((a, b) => {
      const order: Record<string, number> = { sick_with_med: 0, med_only: 1 }
      const aOrder = order[a.state] ?? 1
      const bOrder = order[b.state] ?? 1
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a._createdAt || 0) - (b._createdAt || 0)
    })

  const activeMedTaskIds = mergedMedItems.filter(med => !med.isDoneToday).map(med => med._id)
  if (medDogs.length > 0 && hasPendingMed) {
    cards.push({
      cardType: 'medication',
      id: 'medication',
      domain: 'medication',
      priority: 'today',
      groupTitle: '今日用药',
      dogs: medDogs,
      tasks: [],
      medicationTaskIds: activeMedTaskIds,
      progress: null,
    })
  }

  if (sickObserveDogs.length > 0) {
    cards.push({
      cardType: 'sick_observation',
      id: 'sick-observation',
      domain: 'health',
      priority: 'today',
      groupTitle: '疾病观察',
      dogs: sickObserveDogs,
      tasks: [],
    })
  }

  const careTasks = tasks.filter(task => task.type === 'care_group' && !consumed.has(task._id))
  if (careTasks.length > 0) {
    const groupMap = new Map<string, GenericRow[]>()
    for (const task of careTasks) {
      const key = task.title
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(task)
    }

    for (const [title, group] of groupMap.entries()) {
      group.forEach(task => consumed.add(task._id))
      const dogs = [...new Map(group.map(task => [task.dog_id, { dogId: task.dog_id, dogName: task.dog_name, statusLabel: '' }])).values()]
      cards.push({
        cardType: 'care_group',
        id: `care-${title}`,
        domain: 'breeding',
        priority: highestPriority(group),
        groupTitle: title,
        dogs,
        tasks: group,
      })
    }
  }

  const litterTasks = tasks.filter(task => task.litter_id && !consumed.has(task._id) && task.type !== 'breeding_milestone' && !isBreedingExtraTask(task))
  const litterGroups = new Map<string, GenericRow[]>()
  for (const task of litterTasks) {
    const key = `${task.litter_id}__${getTaskVariantKey(task)}`
    if (!litterGroups.has(key)) litterGroups.set(key, [])
    litterGroups.get(key)!.push(task)
  }

  for (const group of litterGroups.values()) {
    if (group.length < 2) continue
    group.forEach(task => consumed.add(task._id))
    const dogs = [...new Map(group.map(task => [task.dog_id, { dogId: task.dog_id, dogName: task.dog_name, completed: false }])).values()]
    cards.push({
      cardType: 'batch',
      id: `litter-${group[0].litter_id}-${getTaskVariantKey(group[0])}`,
      domain: getTaskDomain(group[0]),
      priority: highestPriority(group),
      groupTitle: `${group[0].dog_name || ''}窝 · ${group[0].display_title || group[0].title}`,
      dogs,
      tasks: group,
      progress: { done: 0, total: dogs.length },
    })
  }

  const remaining = tasks.filter(task => !consumed.has(task._id))
  const allForBatch = [
    ...remaining.filter(task => task.type !== 'breeding_milestone' && !isBreedingExtraTask(task)),
    ...todayCompleted.filter(task => !completedConsumed.has(task._id) && task.type !== 'breeding_milestone' && !isBreedingExtraTask(task)),
  ]
  const batchGroups = new Map<string, GenericRow[]>()
  for (const task of allForBatch) {
    const key = `${getTaskVariantKey(task)}__${startOfDay(task.due_date)}`
    if (!batchGroups.has(key)) batchGroups.set(key, [])
    batchGroups.get(key)!.push(task)
  }

  for (const group of batchGroups.values()) {
    const dogIds = new Set(group.map(task => task.dog_id))
    const pendingInGroup = group.filter(task => !task._completed)
    const shouldBuildBatch = pendingInGroup.length > 0
      && (dogIds.size >= 2 || isAlwaysBatchHealthTask(group[0]))
    if (!shouldBuildBatch) continue
    group.forEach((task) => {
      if (task._completed) completedConsumed.add(task._id)
      else consumed.add(task._id)
    })
    const dogs = [...new Map(pendingInGroup.map(task => [task.dog_id, { dogId: task.dog_id, dogName: task.dog_name, completed: false, taskId: task._id }])).values()]
    cards.push({
      cardType: 'batch',
      id: `batch-${getTaskVariantKey(group[0])}-${group[0].due_date}`,
      domain: getTaskDomain(group[0]),
      priority: highestPriority(pendingInGroup),
      groupTitle: `${group[0].display_title || group[0].title}`,
      dogs,
      tasks: pendingInGroup,
      progress: { done: 0, total: dogs.length },
    })
  }

  const leftover = tasks.filter(task => !consumed.has(task._id))
  const breedingStandaloneTasks = leftover.filter(task => task.type === 'breeding_milestone' || isBreedingExtraTask(task))
  for (const task of breedingStandaloneTasks) {
    consumed.add(task._id)
    cards.push({
      cardType: 'dog',
      id: `dog-${task._id}`,
      domain: getTaskDomain(task),
      priority: task.priority,
      dogName: task.dog_name,
      dogId: task.dog_id,
      statusLabel: '',
      tasks: [task],
    })
  }

  const plainLeftover = tasks.filter(task => !consumed.has(task._id))
  const dogGroups = new Map<string, GenericRow[]>()
  for (const task of plainLeftover) {
    const key = task.dog_id || task._id
    if (!dogGroups.has(key)) dogGroups.set(key, [])
    dogGroups.get(key)!.push(task)
  }

  for (const [dogId, group] of dogGroups.entries()) {
    cards.push({
      cardType: 'dog',
      id: `dog-${dogId}`,
      domain: getTaskDomain(group[0]),
      priority: highestPriority(group),
      dogName: group[0].dog_name,
      dogId: group[0].dog_id,
      statusLabel: '',
      tasks: group,
    })
  }

  return cards
}

function buildSectionedCards(pendingTasks: GenericRow[], todayCompletedTasks: GenericRow[], activeIllnesses: GenericRow[], medItems: GenericRow[], now = Date.now()) {
  const workflowPendingTasks = pendingTasks.filter(task => task.type === 'breeding_milestone')
  const workflowCompletedTasks = todayCompletedTasks.filter(task => task.type === 'breeding_milestone')
  const breedingExtraPendingTasks = pendingTasks.filter(task => isBreedingExtraTask(task))
  const breedingExtraCompletedTasks = todayCompletedTasks.filter(task => isBreedingExtraTask(task))
  const reminderPendingTasks = pendingTasks.filter(task => task.type !== 'breeding_milestone' && task.type !== 'medication' && !isBreedingExtraTask(task))
  const reminderCompletedTasks = todayCompletedTasks.filter(task => task.type !== 'breeding_milestone' && task.type !== 'medication' && !isBreedingExtraTask(task))

  const workflowCards = mergeTasks(workflowPendingTasks, workflowCompletedTasks, [], [], now)
  const breedingExtraCards = mergeTasks(breedingExtraPendingTasks, breedingExtraCompletedTasks, [], [], now)
  const reminderCards = mergeTasks(reminderPendingTasks, reminderCompletedTasks, [], [], now)
  const attentionCards = mergeTasks([], [], activeIllnesses, medItems, now)
  const therapyCards = attentionCards.filter(card => card.cardType === 'medication' || card.cardType === 'health_attention')
  const healthObservationCards = attentionCards.filter(card => card.cardType === 'sick_observation')

  const annotateOverdue = (cardList: GenericRow[]) => {
    const overdueCards = cardList.filter(card => card.priority === 'overdue')
    for (const card of overdueCards) {
      const oldestDue = card.tasks?.reduce((min: number, task: GenericRow) => Math.min(min, task.due_date || Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY)
      card.overdueDays = oldestDue < Number.POSITIVE_INFINITY ? getOverdueDays(oldestDue, now) : 1
    }
    overdueCards.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
    const todayCards = cardList.filter(card => card.priority === 'today')
    const upcomingCards = cardList.filter(card => card.priority === 'upcoming')
    return [...overdueCards, ...todayCards, ...upcomingCards]
  }

  const workflow = annotateOverdue(workflowCards).map(card => ({ ...card, sectionType: 'workflow', domain: 'breeding' }))
  const extra_arrangements = annotateOverdue(breedingExtraCards).map(card => ({ ...card, sectionType: 'workflow_extra', domain: 'breeding' }))
  const reminders = annotateOverdue([...reminderCards, ...healthObservationCards]).map(card => ({ ...card, sectionType: 'reminders', domain: 'health' }))
  const therapy = annotateOverdue(therapyCards).map(card => ({ ...card, sectionType: 'therapy', domain: 'medication' }))

  return {
    workflow,
    extra_arrangements,
    reminders,
    therapy,
    cards: [...workflow, ...extra_arrangements, ...therapy, ...reminders],
  }
}

function getActiveIllnesses(entities: HomeProjectionEntities): GenericRow[] {
  const dogNameMap = new Map(
    (entities.dogs || [])
      .filter(dog => !dog.deleted_at)
      .map(dog => [dog._id, dog.name]),
  )

  return ((entities.health_records || [])
    .filter(record => !record.deleted_at && record.type === 'illness' && (record.details?.treatment_status || '观察中') !== '已康复')
    .map((record) => ({
      ...record,
      dog_name: record.dog_name || dogNameMap.get(record.dog_id) || '',
    }))
    .sort((a: any, b: any) => (Number(b.date || b.created_at || 0)) - (Number(a.date || a.created_at || 0)))) as GenericRow[]
}

function getActiveMedicationTasks(entities: HomeProjectionEntities) {
  return (entities.medication_tasks || [])
    .filter(task => !task.deleted_at && task.status === '进行中')
}

function getPendingTasksForToday(entities: HomeProjectionEntities, now = Date.now()) {
  const todayContext = getBeijingDayContext(now)
  const todayStartTs = todayContext.dayStart
  const todayEndTs = todayContext.dayEnd
  const allPendingTasks = getPendingHomeTasks(entities)
  const pendingTasks = allPendingTasks.filter(task => task.due_date <= todayEndTs)
  const workflowTasks = allPendingTasks.filter(task => task.type === 'breeding_milestone')

  const mergedTasks = [...pendingTasks]
  const existingTaskIds = new Set(mergedTasks.map(task => task._id))
  for (const task of workflowTasks) {
    if (!existingTaskIds.has(task._id)) {
      mergedTasks.push(task)
      existingTaskIds.add(task._id)
    }
  }

  const normalizedPendingTasks = dedupeBreedingMilestones(mergedTasks).map(task => ({ ...task }))
  normalizedPendingTasks.forEach((task) => {
    task.priority = getTaskPriority(task, todayStartTs, todayEndTs)
    task._completed = false
  })

  const todayCompletedTasks = (entities.tasks || [])
    .filter(task => !task.deleted_at && task.status === 'completed' && task.completed_at >= todayStartTs && task.completed_at <= todayEndTs)
    .map((task) => ({
      ...task,
      priority: 'today',
      _completed: true,
    }))

  return { normalizedPendingTasks, todayCompletedTasks, todayStartTs, todayEndTs }
}

export function buildLocalHomeCards(entities: HomeProjectionEntities, now = Date.now(), familyId = '') {
  const scopedEntities = filterEntitiesByFamily(entities, familyId)
  const { normalizedPendingTasks, todayCompletedTasks, todayStartTs } = getPendingTasksForToday(scopedEntities, now)
  const activeIllnesses = getActiveIllnesses(scopedEntities)
  const activeMedications = getActiveMedicationTasks(scopedEntities)
  const medItems = computeMedItemsForDay(activeMedications, now) as GenericRow[]
  const sectioned: any = buildSectionedCards(normalizedPendingTasks, todayCompletedTasks, activeIllnesses, medItems, now)

  const dayOfWeek = getBeijingDateParts(todayStartTs).weekday
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const sundayEndTs = todayStartTs + (daysToSunday * DAY_MS) + DAY_MS - 1
  const day30EndTs = todayStartTs + (30 * DAY_MS) + DAY_MS - 1

  const pendingTasks = dedupeBreedingMilestones(getPendingHomeTasks(scopedEntities))
  const weekCount = pendingTasks.filter(task => task.due_date <= sundayEndTs).length
  const month30Count = pendingTasks.filter(task => task.due_date <= day30EndTs).length

  return {
    cards: sectioned.cards,
    sections: {
      workflow: sectioned.workflow,
      extra_arrangements: sectioned.extra_arrangements,
      reminders: sectioned.reminders,
      therapy: sectioned.therapy,
    },
    counts: {
      today: sectioned.cards.length,
      week: weekCount + sectioned.therapy.length,
      month30: month30Count + sectioned.therapy.length,
      hasOverdue: sectioned.cards.some((card: any) => card.priority === 'overdue'),
    },
  }
}

export function buildLocalDateCounts(entities: HomeProjectionEntities, startDate: number, endDate: number, familyId = '') {
  const scopedEntities = filterEntitiesByFamily(entities, familyId)
  const tasks = dedupeBreedingMilestones(
    getPendingHomeTasks(scopedEntities)
      .filter(task => task.due_date >= startDate && task.due_date <= endDate),
  )
  const activeMedications = getActiveMedicationTasks(scopedEntities)

  const counts: Record<number, number> = {}
  for (const task of tasks) {
    const key = startOfDay(task.due_date)
    counts[key] = (counts[key] || 0) + 1
  }

  const seenMedicationDays = new Set<number>()
  for (let key = startOfDay(startDate); key <= endDate; key += DAY_MS) {
    const dayMedItems = computeMedItemsForDay(activeMedications, key)
    if (dayMedItems.length > 0 && !seenMedicationDays.has(key)) {
      counts[key] = Math.max(counts[key] || 0, 1)
      seenMedicationDays.add(key)
    }
  }

  return counts
}

export function buildLocalWeekCards(entities: HomeProjectionEntities, startDate: number, endDate: number, now = Date.now(), familyId = '') {
  const scopedEntities = filterEntitiesByFamily(entities, familyId)
  const tasks = dedupeBreedingMilestones(
    getPendingHomeTasks(scopedEntities)
      .filter(task => task.due_date >= startDate && task.due_date <= endDate),
  )
  const activeIllnesses = getActiveIllnesses(scopedEntities)
  const activeMedications = getActiveMedicationTasks(scopedEntities)

  const realTodayStart = startOfDay(now)
  const realTodayEnd = realTodayStart + DAY_MS - 1
  const dayGroups = new Map<number, GenericRow[]>()
  for (const task of tasks) {
    const key = startOfDay(task.due_date)
    if (!dayGroups.has(key)) dayGroups.set(key, [])
    dayGroups.get(key)!.push({
      ...task,
      priority: getTaskPriority(task, realTodayStart, realTodayEnd),
      _completed: false,
    })
  }

  const result: Record<number, GenericRow> = {}
  for (const [dayTs, dayTasks] of dayGroups.entries()) {
    const dayMedItems = computeMedItemsForDay(activeMedications, dayTs) as GenericRow[]
    const medDogIds = new Set(dayMedItems.map(item => item.dog_id))
    const filteredIllnesses = dayTs < realTodayStart
      ? []
      : (medDogIds.size > 0 ? activeIllnesses.filter(illness => medDogIds.has(illness.dog_id)) : [])
    const sectioned: any = buildSectionedCards(dayTasks, [], filteredIllnesses, dayMedItems, now)
    result[dayTs] = {
      cards: sectioned.cards,
      sections: {
        workflow: sectioned.workflow,
        extra_arrangements: sectioned.extra_arrangements,
        reminders: sectioned.reminders,
        therapy: sectioned.therapy,
      },
    }
  }

  for (let key = startOfDay(startDate); key <= endDate; key += DAY_MS) {
    if (result[key]) continue
    const dayMedItems = computeMedItemsForDay(activeMedications, key) as GenericRow[]
    if (!dayMedItems.length) continue
    const medDogIds = new Set(dayMedItems.map(item => item.dog_id))
    const filteredIllnesses = medDogIds.size > 0
      ? activeIllnesses.filter(illness => medDogIds.has(illness.dog_id))
      : []
    const sectioned: any = buildSectionedCards([], [], filteredIllnesses, dayMedItems, now)
    result[key] = {
      cards: sectioned.cards,
      sections: {
        workflow: sectioned.workflow,
        extra_arrangements: sectioned.extra_arrangements,
        reminders: sectioned.reminders,
        therapy: sectioned.therapy,
      },
    }
  }

  return result
}

export function applyTouchedEntityVersions(entities: GenericRow[], touchedEntities: SyncTouchedEntity[], collection: string) {
  if (!touchedEntities.length) return entities
  const touchedMap = new Map(
    touchedEntities
      .filter(item => item.collection === collection)
      .map(item => [item.id, item]),
  )
  if (!touchedMap.size) return entities

  return entities.map((entity) => {
    const touched = touchedMap.get(entity._id)
    if (!touched) return entity
    return {
      ...entity,
      version: touched.version,
      updated_at: touched.updatedAt,
      deleted_at: touched.deletedAt ?? entity.deleted_at ?? null,
      _local_pending: false,
    }
  })
}
