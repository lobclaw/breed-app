import { getBeijingDayStart } from '@/utils/date'
import { getExtraArrangementTitle } from '@/utils/breedingExtraArrangement'
import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'
import {
  buildHomeBreedingProcessUrl,
  getHomeBreedingPrimaryAction,
  type HomeBreedingCardLike,
} from '@/utils/homeBreedingActions'
import type { HomeCardFocusTarget } from '@/utils/homeCardFocus'
import { buildMedicationDetailUrl } from '@/utils/dogDetailNavigation'
import type { IconTone } from '@/utils/iconRegistry'
import type { HomeCard, HomeTask, HomeWorkbenchDog } from '@/types/home-workbench'

const DAY_MS = 86400000

type RecommendationTagTone = 'red' | 'amber' | 'green' | 'plum' | 'blue'
export type FabRecommendationCategory = 'todo' | 'suggestion' | 'common'

export interface FabTaskRecommendation {
  kind: 'task'
  category: 'todo' | 'suggestion'
  materialIcon: string
  iconColor: IconTone
  title: string
  subtitle: string
  context: string
  tag: string
  tagColor: RecommendationTagTone
  url: string
  homeFocusTarget?: HomeCardFocusTarget
}

export function buildFabTaskRecommendation(card: HomeCard, now = Date.now()): FabTaskRecommendation | null {
  const task = getPrimaryTask(card)
  if (!task && !['care_group', 'medication', 'sick_observation'].includes(card.cardType)) return null

  if (getTaskType(task) === 'breeding_milestone') {
    return buildBreedingMilestoneRecommendation(card, task!, now)
  }

  if (getTaskType(task) === 'breeding_extra_arrangement') {
    return buildBreedingExtraRecommendation(card, task!, now)
  }

  if (card.cardType === 'batch') {
    return buildBatchRecommendation(card, task!, now)
  }

  if (card.cardType === 'care_group') {
    return buildCareGroupRecommendation(card, now)
  }

  if (card.cardType === 'medication') {
    return buildMedicationCardRecommendation(card, now)
  }

  if (card.cardType === 'sick_observation') {
    return buildSickObservationRecommendation(card, now)
  }

  if (isHealthTask(task)) {
    return buildHealthRecommendation(card, task!, now)
  }

  const url = buildFabTaskUrl(card)
  if (!url) return null

  return {
    kind: 'task',
    category: 'todo',
    materialIcon: 'assignment_turned_in',
    iconColor: card.priority === 'overdue' ? 'red' : 'amber',
    title: card.groupTitle || card.title || card.dogName || '待处理任务',
    subtitle: getTaskDisplayTitle(task) || '点击处理当前待办',
    context: buildDueContext(card, task, now),
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url,
  }
}

export function buildFabTaskUrl(card: HomeCard): string {
  const task = getPrimaryTask(card)
  const taskType = getTaskType(task)

  if (card.cardType === 'medication' || card.cardType === 'sick_observation') {
    return '/pages/home/index'
  }

  if (taskType === 'breeding_milestone') {
    return buildHomeBreedingProcessUrl(toBreedingCardLike(card))
  }

  if (card.cardType === 'batch' && task) {
    const dogs = getPendingDogs(card)
      .map(dog => ({ _id: getDogId(dog), name: getDogName(dog) }))
      .filter(dog => dog._id && dog.name)
    const dogsParam = encodeURIComponent(JSON.stringify(dogs))
    const taskIds = (card.tasks || [])
      .filter(item => getTaskStatus(item) === 'pending' || !getTaskStatus(item))
      .map(item => getTaskId(item))
      .filter(Boolean)
      .join(',')
    const detailsParam = task?.details
      ? `&details=${encodeURIComponent(JSON.stringify(task.details))}`
      : ''
    const typePageMap: Record<string, string> = {
      vaccination: '/pages/record/health-vaccination',
      deworming: '/pages/record/health-deworming',
      illness: '/pages/record/health-illness',
    }
    const page = typePageMap[taskType] || '/pages/record/health-vaccination'
    return `${page}?batchDogs=${dogsParam}&taskIds=${taskIds}${detailsParam}`
  }

  if (card.cardType === 'care_group') {
    const taskIds = (card.tasks || []).map(item => getTaskId(item)).filter(Boolean).join(',')
    return `/pages/home/batch-process?taskIds=${taskIds}`
  }

  if (!task) return '/pages/record/health-vaccination'

  if (taskType === 'medication') {
    const medicationTaskId = getString(task, 'medication_task_id')
      || getString(task, 'medicationTaskId')
      || getTaskId(task)
      || getString(task, 'source_record_id')
    return medicationTaskId ? buildMedicationDetailUrl(medicationTaskId) : '/pages/record/medication-detail'
  }

  const params: string[] = []
  const dogId = card.dogId || getString(task, 'dog_id')
  const dogName = card.dogName || getString(task, 'dog_name')
  const cycleId = getString(task, 'cycle_id')
  const taskId = getTaskId(task)

  if (dogId) params.push(`dogId=${encodeURIComponent(dogId)}`)
  if (dogName) params.push(`dogName=${encodeURIComponent(dogName)}`)
  if (taskId) params.push(`taskId=${encodeURIComponent(taskId)}`)
  if (cycleId) params.push(`cycleId=${encodeURIComponent(cycleId)}`)

  const query = params.length > 0 ? `?${params.join('&')}` : ''

  switch (taskType) {
    case 'vaccination':
      return `/pages/record/health-vaccination${query}`
    case 'deworming':
      return `/pages/record/health-deworming${query}`
    case 'illness':
      return `/pages/record/health-illness${query}`
    case 'breeding_extra_arrangement':
      return cycleId ? `/pages/breeding/cycle?id=${encodeURIComponent(cycleId)}` : '/pages/record/breeding-heat'
    default:
      return `/pages/record/health-vaccination${query}`
  }
}

function buildBreedingMilestoneRecommendation(
  card: HomeCard,
  task: HomeTask,
  now: number,
): FabTaskRecommendation | null {
  const action = getHomeBreedingPrimaryAction(toBreedingCardLike(card))
  const url = buildFabTaskUrl(card)
  if (!action || !url) return null
  const compactCopy = getCompactBreedingCopy(task, now)

  return {
    kind: 'task',
    category: 'suggestion',
    materialIcon: action.icon,
    iconColor: mapBreedingToneToFabColor(action.tone),
    title: `${card.dogName || getString(task, 'dog_name') || '当前犬只'} · ${compactCopy.title}`,
    subtitle: compactCopy.subtitle,
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url,
  }
}

function buildBreedingExtraRecommendation(
  card: HomeCard,
  task: HomeTask,
  now: number,
): FabTaskRecommendation {
  const notes = getString(task, 'notes') || getDetailsString(task, 'notes')
  const kindLabel = getExtraArrangementTitle(getDetailsString(task, 'kind'))
  return {
    kind: 'task',
    category: 'todo',
    materialIcon: 'event_note',
    iconColor: card.priority === 'overdue' ? 'red' : 'amber',
    title: `${card.dogName || getString(task, 'dog_name') || '当前犬只'} · ${task.title || '额外安排'}`,
    subtitle: notes || kindLabel || buildDueContext(card, task, now),
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
    homeFocusTarget: 'medication',
  }
}

function buildHealthRecommendation(card: HomeCard, task: HomeTask, now: number): FabTaskRecommendation {
  const taskType = getTaskType(task)
  const metaMap: Record<string, { icon: string; color: IconTone; actionLabel: string }> = {
    vaccination: { icon: 'vaccines', color: 'blue', actionLabel: '疫苗记录' },
    deworming: { icon: 'shield', color: 'teal', actionLabel: '驱虫记录' },
    illness: { icon: 'sick', color: 'red', actionLabel: '疾病记录' },
  }
  const meta = metaMap[taskType] || { icon: 'assignment_turned_in', color: 'amber', actionLabel: '待办处理' }

  return {
    kind: 'task',
    category: 'todo',
    materialIcon: meta.icon,
    iconColor: card.priority === 'overdue' ? 'red' : meta.color,
    title: `${card.dogName || getString(task, 'dog_name') || '当前犬只'} · ${meta.actionLabel}`,
    subtitle: getHealthSubtitle(task),
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
  }
}

function buildBatchRecommendation(card: HomeCard, task: HomeTask, now: number): FabTaskRecommendation {
  const pendingDogs = getPendingDogs(card)
  const { icon, color } = getTaskIconMeta(getTaskType(task), card.priority === 'overdue')
  return {
    kind: 'task',
    category: 'todo',
    materialIcon: icon,
    iconColor: color,
    title: `批量处理 · ${getTaskDisplayTitle(task) || card.groupTitle || '批量待办'}`,
    subtitle: `${pendingDogs.length || getDogCount(card)}只待处理`,
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
  }
}

function buildCareGroupRecommendation(card: HomeCard, now: number): FabTaskRecommendation {
  const task = getPrimaryTask(card)
  return {
    kind: 'task',
    category: 'todo',
    materialIcon: 'assignment_turned_in',
    iconColor: card.priority === 'overdue' ? 'red' : 'amber',
    title: `护理组 · ${card.groupTitle || '状态群组'}`,
    subtitle: buildDueContext(card, task, now),
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
  }
}

function buildMedicationCardRecommendation(card: HomeCard, now: number): FabTaskRecommendation {
  const dogs = Array.isArray(card.dogs) ? card.dogs : []
  const total = dogs.length
  const doneCount = dogs.filter(dog => getBoolean(dog, 'completed')).length

  return {
    kind: 'task',
    category: 'todo',
    materialIcon: 'medication',
    iconColor: card.priority === 'overdue' ? 'red' : 'plum',
    title: `今日用药 · ${total}只犬`,
    subtitle: buildMedicationSubtitle(dogs, doneCount),
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
    homeFocusTarget: 'medication',
  }
}

function buildMedicationSubtitle(dogs: HomeWorkbenchDog[], doneCount: number): string {
  const total = dogs.length
  if (total === 1) {
    const dog = dogs[0]
    const detail = [getString(dog, 'illnessNames') || getString(dog, 'illness'), getString(dog, 'drugName')]
      .filter(Boolean)
      .join(' · ')
    return detail || '待完成今日用药'
  }
  if (doneCount > 0) return `已完成 ${doneCount}/${total} 只`
  return `${total}只待用药`
}

function buildSickObservationRecommendation(card: HomeCard, now: number): FabTaskRecommendation {
  const dogs = Array.isArray(card.dogs) ? card.dogs : []
  const total = dogs.length
  const firstDog = dogs[0]
  const firstDetail = firstDog
    ? [getString(firstDog, 'illness'), getString(firstDog, 'treatmentStatus') || '观察中']
      .filter(Boolean)
      .join(' · ')
    : ''

  return {
    kind: 'task',
    category: 'todo',
    materialIcon: 'sick',
    iconColor: card.priority === 'overdue' ? 'red' : 'red',
    title: `疾病观察 · ${total}项`,
    subtitle: firstDetail || `观察中 ${total} 项`,
    context: '',
    tag: buildTaskTag(card),
    tagColor: buildTaskTagColor(card),
    url: buildFabTaskUrl(card),
    homeFocusTarget: 'sick_observation',
  }
}

function getCompactBreedingCopy(task: HomeTask, now: number): { title: string; subtitle: string } {
  const stepType = getDetailsString(task, 'step_type')
  const milestone = deriveBreedingMilestoneViewModel({
    title: task.title,
    due_date: getNumber(task, 'due_date'),
    details: task.details,
  }, now)
  const summary = buildBreedingMilestoneSummary(milestone)
  const compactMap: Record<string, { title: string; subtitle: string }> = {
    heat: { title: '记录发情', subtitle: summary.primaryLabel || '发情时间待确认' },
    follicle_check: { title: '建议卵泡检查', subtitle: summary.primaryLabel || '发情时间待确认' },
    mating: { title: '建议配种', subtitle: summary.primaryLabel || '发情时间待确认' },
    pregnancy_check: { title: '建议孕检', subtitle: summary.primaryLabel || '配种时间待确认' },
    birth: { title: '待产处理', subtitle: summary.primaryLabel || '待产时间待确认' },
    weaning_confirm: { title: '确认断奶', subtitle: summary.primaryLabel || '断奶时间待确认' },
  }
  return compactMap[stepType] || {
    title: task.title || '流程处理',
    subtitle: summary.primaryLabel || '当前流程',
  }
}

function buildDueContext(card: HomeCard, task: HomeTask | undefined, now: number): string {
  if (card.priority === 'overdue') {
    const overdueDays = typeof card.overdueDays === 'number' && card.overdueDays > 0
      ? card.overdueDays
      : getOverdueDays(getNumber(task, 'due_date'), now)
    return overdueDays > 0 ? `已逾期 ${overdueDays} 天` : '已逾期待处理'
  }
  if (card.priority === 'today') return '今日待办'
  return '后续待办'
}

function getHealthSubtitle(task: HomeTask): string {
  const taskType = getTaskType(task)
  if (taskType === 'illness') {
    return getDetailsString(task, 'condition')
      || getTaskDisplayTitle(task)
      || task.title
      || '疾病待处理'
  }
  return getTaskDisplayTitle(task) || task.title || '待处理'
}

function getTaskIconMeta(taskType: string, isOverdue = false): { icon: string; color: IconTone } {
  if (isOverdue) {
    return { icon: 'assignment_late', color: 'red' }
  }
  if (taskType === 'vaccination') return { icon: 'vaccines', color: 'blue' }
  if (taskType === 'deworming') return { icon: 'shield', color: 'teal' }
  if (taskType === 'illness') return { icon: 'sick', color: 'red' }
  return { icon: 'assignment_turned_in', color: 'amber' }
}

function buildTaskTag(card: HomeCard) {
  if (hasBreedingMilestoneTask(card)) return '建议'
  return card.priority === 'overdue' ? '逾期' : '待办'
}

function buildTaskTagColor(card: HomeCard): RecommendationTagTone {
  if (hasBreedingMilestoneTask(card)) return 'amber'
  if (card.priority === 'overdue') return 'red'

  const task = getPrimaryTask(card)
  const taskType = getTaskType(task)

  if (card.cardType === 'medication' || taskType === 'medication' || card.domain === 'medication') {
    return 'plum'
  }

  if (taskType === 'breeding_extra_arrangement' || card.domain === 'breeding') {
    return 'amber'
  }

  return 'blue'
}

export function hasBreedingMilestoneTask(card: HomeCard): boolean {
  return getTaskType(getPrimaryTask(card)) === 'breeding_milestone'
}

function mapBreedingToneToFabColor(tone: string): IconTone {
  if (tone === 'rose') return 'rose'
  if (tone === 'blue') return 'blue'
  if (tone === 'green') return 'green'
  return 'amber'
}

function toBreedingCardLike(card: HomeCard): HomeBreedingCardLike {
  return {
    dogId: card.dogId,
    dogName: card.dogName,
    tasks: (card.tasks || []).map(task => ({
      _id: getTaskId(task),
      type: getTaskType(task),
      cycle_id: getString(task, 'cycle_id'),
      litter_id: getString(task, 'litter_id'),
      details: task.details || null,
    })),
  }
}

function isHealthTask(task: HomeTask | undefined): boolean {
  const taskType = getTaskType(task)
  return taskType === 'vaccination' || taskType === 'deworming' || taskType === 'illness'
}

function getPrimaryTask(card: HomeCard): HomeTask | undefined {
  return Array.isArray(card.tasks) && card.tasks.length > 0 ? card.tasks[0] : undefined
}

function getPendingDogs(card: HomeCard): HomeWorkbenchDog[] {
  const dogs = Array.isArray(card.dogs) ? card.dogs : []
  return dogs.filter(dog => !getBoolean(dog, 'completed'))
}

function getDogCount(card: HomeCard): number {
  return Array.isArray(card.dogs) ? card.dogs.length : 0
}

function getTaskDisplayTitle(task: HomeTask | undefined): string {
  return getString(task, 'display_title') || task?.title || ''
}

function getTaskType(task: HomeTask | undefined): string {
  return task?.type || ''
}

function getTaskId(task: HomeTask | undefined): string | undefined {
  return getString(task, '_id') || getString(task, 'id') || getString(task, 'task_id')
}

function getTaskStatus(task: HomeTask | undefined): string {
  return getString(task, 'status') || ''
}

function getDogId(dog: HomeWorkbenchDog): string | undefined {
  return getString(dog, 'dogId') || getString(dog, 'dog_id') || getString(dog, 'id') || getString(dog, '_id')
}

function getDogName(dog: HomeWorkbenchDog): string | undefined {
  return getString(dog, 'dogName') || getString(dog, 'dog_name') || getString(dog, 'name')
}

function getOverdueDays(dueDate: number | undefined, now = Date.now()): number {
  if (!dueDate) return 0
  const diff = Math.floor((getBeijingDayStart(now) - getBeijingDayStart(dueDate)) / DAY_MS)
  return diff > 0 ? diff : 0
}

function getDetailsString(task: HomeTask | undefined, key: string): string {
  const details = task?.details
  if (!details || typeof details !== 'object') return ''
  const value = details[key]
  return typeof value === 'string' ? value : ''
}

function getString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = source?.[key]
  return typeof value === 'number' ? value : undefined
}

function getBoolean(source: Record<string, unknown> | undefined, key: string): boolean {
  return source?.[key] === true
}
