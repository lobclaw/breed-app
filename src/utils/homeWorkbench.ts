import {
  WORKBENCH_SECTION_ORDER,
  type BuildHomeWorkbenchOptions,
  type HomeCard,
  type HomeTask,
  type HomeWorkbenchDog,
  type HomeWorkbenchModel,
  type MedicationRowState,
  type WorkbenchGroup,
  type WorkbenchGroupKind,
  type WorkbenchRow,
  type WorkbenchSection,
  type WorkbenchSectionKey,
} from '@/types/home-workbench'
import { getWorkbenchSectionColor } from '@/utils/themeSemantics'

export const WORKBENCH_SECTION_META: Record<WorkbenchSectionKey, { title: string; dotColor: string }> = {
  overdue: { title: '逾期待处理', dotColor: `var(--${getWorkbenchSectionColor('overdue')})` },
  breeding: { title: '繁育流程', dotColor: `var(--${getWorkbenchSectionColor('breeding')})` },
  reminders: { title: '健康提醒', dotColor: `var(--${getWorkbenchSectionColor('reminders')})` },
  therapy: { title: '今日用药', dotColor: `var(--${getWorkbenchSectionColor('therapy')})` },
}

const DEFAULT_VISIBLE_ROW_LIMIT = 4

const BREEDING_STEP_TITLES: Record<string, string> = {
  follicle_check: '建议卵泡检查',
  mating: '建议配种',
  pregnancy_check: '建议孕检',
  birth: '待产',
  weaning_confirm: '待断奶',
}

const MEDICATION_STATE_TITLES: Record<MedicationRowState, string> = {
  pending: '未完成',
  partial: '部分完成',
  done: '已完成',
}

const MEDICATION_STATE_RANK: Record<MedicationRowState, number> = {
  pending: 0,
  partial: 1,
  done: 2,
}

const MEDICATION_STATE_GROUP_KEYS: Record<MedicationRowState, string> = {
  pending: 'medication-state:pending',
  partial: 'medication-state:partial',
  done: 'medication-state:done',
}

export function buildHomeWorkbench(
  cards: readonly HomeCard[],
  options: BuildHomeWorkbenchOptions = {},
): HomeWorkbenchModel {
  const visibleRowLimit = options.visibleRowLimit ?? DEFAULT_VISIBLE_ROW_LIMIT
  const builders = createSectionBuilders()
  let rowRank = 0

  for (const card of cards) {
    const sectionKey = resolveSectionKey(card)
    const rows = buildRowsForCard(card, sectionKey, rowRank)
    rowRank += rows.length

    for (const row of rows) {
      builders[row.sectionKey].addRow(row)
    }
  }

  const sections = WORKBENCH_SECTION_ORDER.reduce((acc, key, index) => {
    acc[key] = builders[key].toSection(index, visibleRowLimit)
    return acc
  }, {} as Record<WorkbenchSectionKey, WorkbenchSection>)

  return {
    sectionOrder: WORKBENCH_SECTION_ORDER,
    sections,
    totalCount: WORKBENCH_SECTION_ORDER.reduce((sum, key) => sum + sections[key].count, 0),
  }
}

export function getHomeCardSectionKey(card: HomeCard): WorkbenchSectionKey {
  return resolveSectionKey(card)
}

export function getHomeCardGroupKey(card: HomeCard): string {
  const sectionKey = resolveSectionKey(card)
  return resolveCardGroupKey(card, sectionKey)
}

function createSectionBuilders(): Record<WorkbenchSectionKey, ReturnType<typeof createSectionBuilder>> {
  return WORKBENCH_SECTION_ORDER.reduce((acc, key) => {
    acc[key] = createSectionBuilder(key)
    return acc
  }, {} as Record<WorkbenchSectionKey, ReturnType<typeof createSectionBuilder>>)
}

function createSectionBuilder(sectionKey: WorkbenchSectionKey) {
  const groups = new Map<string, WorkbenchGroup>()

  return {
    addRow(row: WorkbenchRow) {
      const group = groups.get(row.groupKey) || createGroup(row)
      group.rows.push(row)
      group.count = group.rows.length
      groups.set(row.groupKey, group)
    },
    toSection(sortRank: number, visibleRowLimit: number): WorkbenchSection {
      const sortedGroups = Array.from(groups.values()).sort((a, b) => a.sortRank - b.sortRank)
      const finalizedGroups = sortedGroups.map(group => finalizeGroup(group, visibleRowLimit))
      const rows = finalizedGroups.flatMap(group => group.rows)
      const meta = WORKBENCH_SECTION_META[sectionKey]

      return {
        key: sectionKey,
        title: meta.title,
        dotColor: meta.dotColor,
        rows,
        visibleRows: limitRows(rows, visibleRowLimit),
        hiddenCount: getHiddenCount(rows, visibleRowLimit),
        count: rows.length,
        sortRank,
        groups: finalizedGroups,
      }
    },
  }
}

function createGroup(row: WorkbenchRow): WorkbenchGroup {
  return {
    key: row.groupKey,
    kind: resolveGroupKind(row.groupKey),
    title: resolveGroupTitle(row),
    sectionKey: row.sectionKey,
    rows: [],
    visibleRows: [],
    hiddenCount: 0,
    count: 0,
    sortRank: row.sortRank,
  }
}

function finalizeGroup(group: WorkbenchGroup, visibleRowLimit: number): WorkbenchGroup {
  return {
    ...group,
    visibleRows: limitRows(group.rows, visibleRowLimit),
    hiddenCount: getHiddenCount(group.rows, visibleRowLimit),
    count: group.rows.length,
  }
}

function limitRows(rows: WorkbenchRow[], visibleRowLimit: number): WorkbenchRow[] {
  return rows.slice(0, Math.max(0, visibleRowLimit))
}

function getHiddenCount(rows: WorkbenchRow[], visibleRowLimit: number): number {
  return Math.max(0, rows.length - Math.max(0, visibleRowLimit))
}

function buildRowsForCard(card: HomeCard, sectionKey: WorkbenchSectionKey, baseSortRank: number): WorkbenchRow[] {
  if (sectionKey === 'therapy') {
    return buildMedicationRows(card, baseSortRank)
  }

  if (sectionKey === 'breeding' && isBreedingWorkflowCard(card)) {
    return buildTaskRows(card, sectionKey, baseSortRank)
  }

  return [buildCardRow(card, sectionKey, baseSortRank)]
}

function buildTaskRows(card: HomeCard, sectionKey: WorkbenchSectionKey, baseSortRank: number): WorkbenchRow[] {
  const tasks = card.tasks || []
  if (tasks.length === 0) {
    return [buildCardRow(card, sectionKey, baseSortRank)]
  }

  return tasks.map((task, index) => {
    const groupKey = isBreedingExtraTask(task) || card.sectionType === 'workflow_extra'
      ? `breeding-extra:${getBreedingExtraKind(task)}`
      : `breeding-step:${getBreedingStepType(task)}`

    return {
      key: `${card.id}:${getTaskId(task) || index}`,
      kind: 'task',
      sectionKey,
      groupKey,
      title: getTaskTitle(task, card),
      sortRank: baseSortRank + index,
      sourceCard: card,
      sourceTask: task,
      taskId: getTaskId(task),
    }
  })
}

function buildCardRow(card: HomeCard, sectionKey: WorkbenchSectionKey, sortRank: number): WorkbenchRow {
  const firstTask = card.tasks?.[0]
  return {
    key: card.id,
    kind: 'card',
    sectionKey,
    groupKey: resolveCardGroupKey(card, sectionKey),
    title: getTaskTitle(firstTask, card),
    sortRank,
    sourceCard: card,
    sourceTask: firstTask,
    taskId: firstTask ? getTaskId(firstTask) : undefined,
  }
}

function buildMedicationRows(card: HomeCard, baseSortRank: number): WorkbenchRow[] {
  const dogs = card.dogs || []
  return dogs
    .map((dog, index) => {
      const state = getMedicationRowState(dog)
      const sourceTask = getDogMedicationTasks(dog)[0]
      return {
        key: `${card.id}:${getDogId(dog) || index}`,
        kind: 'medication-dog',
        sectionKey: 'therapy',
        groupKey: MEDICATION_STATE_GROUP_KEYS[state],
        title: getDogName(dog) || card.groupTitle || '今日用药',
        sortRank: baseSortRank + MEDICATION_STATE_RANK[state] * 1000 + index,
        sourceCard: card,
        sourceTask,
        sourceDog: dog,
        medicationTaskId: getMedicationTaskId(dog, sourceTask),
        medicationState: state,
      } satisfies WorkbenchRow
    })
    .sort((a, b) => a.sortRank - b.sortRank)
}

function resolveSectionKey(card: HomeCard): WorkbenchSectionKey {
  if (card.priority === 'overdue') return 'overdue'
  if (card.sectionType === 'workflow' || card.sectionType === 'workflow_extra' || card.domain === 'breeding') return 'breeding'
  if (card.sectionType === 'therapy' || card.domain === 'medication' || card.cardType === 'medication' || card.cardType === 'health_attention') return 'therapy'
  return 'reminders'
}

function resolveCardGroupKey(card: HomeCard, sectionKey: WorkbenchSectionKey): string {
  if (sectionKey === 'overdue') return `overdue-domain:${card.domain || card.sectionType || 'other'}`
  if (sectionKey === 'breeding') {
    const firstTask = card.tasks?.[0]
    if (firstTask && (isBreedingExtraTask(firstTask) || card.sectionType === 'workflow_extra')) {
      return `breeding-extra:${getBreedingExtraKind(firstTask)}`
    }
    return `breeding-step:${firstTask ? getBreedingStepType(firstTask) : 'other'}`
  }
  if (sectionKey === 'therapy') return 'medication-state:pending'
  if (card.cardType === 'sick_observation') return 'health-illness:observation'

  const kind = card.cardType === 'batch' ? 'health-batch' : 'health-single'
  return `${kind}:${getHealthSubtypeKey(card)}`
}

function resolveGroupKind(groupKey: string): WorkbenchGroupKind {
  if (groupKey.startsWith('overdue-domain:')) return 'overdue-domain'
  if (groupKey.startsWith('breeding-step:')) return 'breeding-step'
  if (groupKey.startsWith('breeding-extra:')) return 'breeding-extra'
  if (groupKey.startsWith('health-batch:')) return 'health-batch'
  if (groupKey.startsWith('health-illness:')) return 'health-illness'
  if (groupKey.startsWith('medication-state:')) return 'medication-state'
  return 'health-single'
}

function resolveGroupTitle(row: WorkbenchRow): string {
  if (row.groupKey.startsWith('breeding-step:')) {
    const stepType = row.groupKey.replace('breeding-step:', '')
    return BREEDING_STEP_TITLES[stepType] || row.sourceTask?.title || row.sourceCard.groupTitle || '繁育流程'
  }
  if (row.groupKey.startsWith('breeding-extra:')) return row.sourceCard.groupTitle || '额外安排'
  if (row.groupKey.startsWith('overdue-domain:')) return getOverdueGroupTitle(row.sourceCard)
  if (row.groupKey.startsWith('medication-state:')) {
    const state = row.groupKey.replace('medication-state:', '') as MedicationRowState
    return MEDICATION_STATE_TITLES[state] || '今日用药'
  }
  return row.sourceCard.groupTitle || row.sourceTask?.title || WORKBENCH_SECTION_META[row.sectionKey].title
}

function getOverdueGroupTitle(card: HomeCard): string {
  if (card.domain === 'breeding') return '繁育逾期'
  if (card.domain === 'medication') return '用药逾期'
  if (card.domain === 'health') return '健康逾期'
  return '逾期待处理'
}

function isBreedingWorkflowCard(card: HomeCard): boolean {
  return card.sectionType === 'workflow'
    || card.sectionType === 'workflow_extra'
    || (card.tasks || []).some(task => getString(task, 'type') === 'breeding_milestone' || isBreedingExtraTask(task))
}

function isBreedingExtraTask(task: HomeTask): boolean {
  return getString(task, 'type') === 'breeding_extra_arrangement'
}

function getBreedingStepType(task: HomeTask): string {
  return getDetailsString(task, 'step_type') || getString(task, 'type') || 'other'
}

function getBreedingExtraKind(task: HomeTask): string {
  return getDetailsString(task, 'kind') || 'other'
}

function getHealthSubtypeKey(card: HomeCard): string {
  const task = card.tasks?.[0]
  const taskType = getString(task, 'type') || getString(card, 'type') || card.cardType

  if (taskType === 'vaccination') {
    return `vaccination:${getDetailsString(task, 'vaccine_type') || 'unknown'}`
  }
  if (taskType === 'deworming') {
    return `deworming:${getDetailsString(task, 'deworming_type') || 'unknown'}:${getDetailsString(task, 'drug_name') || 'unknown'}`
  }
  if (taskType === 'illness') {
    return `illness:${getDetailsString(task, 'condition') || 'other'}`
  }
  return taskType || 'other'
}

function getMedicationRowState(dog: HomeWorkbenchDog): MedicationRowState {
  const tasks = getDogMedicationTasks(dog)
  if (tasks.length === 0) return getBoolean(dog, 'completed') ? 'done' : 'pending'

  const doneCount = tasks.filter(isMedicationTaskDone).length
  if (doneCount === 0) return 'pending'
  if (doneCount === tasks.length) return 'done'
  return 'partial'
}

function isMedicationTaskDone(task: HomeTask): boolean {
  if (getString(task, 'status') === 'completed') return true
  const dosesGiven = getNumber(task, 'doses_given') || 0
  const frequency = getDetailsNumber(task, 'frequency') || 1
  return dosesGiven >= frequency
}

function getDogMedicationTasks(dog: HomeWorkbenchDog): HomeTask[] {
  const tasks = dog.allMedTasks
  return Array.isArray(tasks) ? tasks as HomeTask[] : []
}

function getMedicationTaskId(dog: HomeWorkbenchDog, task?: HomeTask): string | undefined {
  return getString(dog, 'medicationTaskId')
    || getString(dog, 'medication_task_id')
    || (task ? getTaskId(task) : undefined)
}

function getTaskTitle(task: HomeTask | undefined, card: HomeCard): string {
  return task?.title || card.title || card.groupTitle || card.dogName || card.id
}

function getTaskId(task: HomeTask): string | undefined {
  return getString(task, '_id') || getString(task, 'id') || getString(task, 'task_id')
}

function getDogId(dog: HomeWorkbenchDog): string | undefined {
  return getString(dog, 'dogId') || getString(dog, 'dog_id') || getString(dog, 'id') || getString(dog, '_id')
}

function getDogName(dog: HomeWorkbenchDog): string | undefined {
  return getString(dog, 'dogName') || getString(dog, 'dog_name') || getString(dog, 'name')
}

function getDetailsString(source: HomeTask | undefined, key: string): string | undefined {
  const details = source?.details
  if (!details || typeof details !== 'object') return undefined
  const value = details[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getDetailsNumber(source: HomeTask | undefined, key: string): number | undefined {
  const details = source?.details
  if (!details || typeof details !== 'object') return undefined
  const value = details[key]
  return typeof value === 'number' ? value : undefined
}

function getString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = source?.[key]
  return typeof value === 'number' ? value : undefined
}

function getBoolean(source: Record<string, unknown> | undefined, key: string): boolean | undefined {
  const value = source?.[key]
  return typeof value === 'boolean' ? value : undefined
}
