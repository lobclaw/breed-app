export const WORKBENCH_SECTION_ORDER = ['overdue', 'breeding', 'reminders', 'therapy'] as const

export type WorkbenchSectionKey = typeof WORKBENCH_SECTION_ORDER[number]

export type WorkbenchGroupKind =
  | 'overdue-domain'
  | 'breeding-step'
  | 'breeding-extra'
  | 'health-batch'
  | 'health-single'
  | 'health-illness'
  | 'medication-state'

export type WorkbenchRowKind = 'card' | 'task' | 'medication-dog'

export type MedicationRowState = 'pending' | 'partial' | 'done'

export interface HomeTask {
  id?: string
  _id?: string
  task_id?: string
  type?: string
  title?: string
  status?: string
  dog_id?: string
  dog_name?: string
  details?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface HomeWorkbenchDog {
  id?: string
  _id?: string
  dog_id?: string
  name?: string
  dog_name?: string
  status?: string
  doseStatus?: string
  medicationTaskId?: string
  medication_task_id?: string
  todayDoseStatus?: string
  progress?: {
    done?: number
    total?: number
  } | null
  [key: string]: unknown
}

export interface HomeCard {
  cardType: string
  id: string
  tasks?: HomeTask[]
  dogs?: HomeWorkbenchDog[]
  progress?: { done: number; total: number } | null
  sectionType?: string
  domain?: string
  priority?: string
  overdueDays?: number
  dogName?: string
  dogId?: string
  statusLabel?: string
  groupTitle?: string
  type?: string
  title?: string
  [key: string]: unknown
}

export interface WorkbenchRow {
  key: string
  kind: WorkbenchRowKind
  sectionKey: WorkbenchSectionKey
  groupKey: string
  title: string
  sortRank: number
  sourceCard: HomeCard
  sourceTask?: HomeTask
  sourceDog?: HomeWorkbenchDog
  taskId?: string
  medicationTaskId?: string
  medicationState?: MedicationRowState
}

export interface WorkbenchGroup {
  key: string
  kind: WorkbenchGroupKind
  title: string
  sectionKey: WorkbenchSectionKey
  rows: WorkbenchRow[]
  visibleRows: WorkbenchRow[]
  hiddenCount: number
  count: number
  sortRank: number
}

export interface WorkbenchSection {
  key: WorkbenchSectionKey
  title: string
  dotColor: string
  rows: WorkbenchRow[]
  visibleRows: WorkbenchRow[]
  hiddenCount: number
  count: number
  sortRank: number
  groups: WorkbenchGroup[]
}

export interface HomeWorkbenchModel {
  sectionOrder: readonly WorkbenchSectionKey[]
  sections: Record<WorkbenchSectionKey, WorkbenchSection>
  totalCount: number
}

export interface BuildHomeWorkbenchOptions {
  visibleRowLimit?: number
}

export type HomeWorkbenchEvent =
  | { type: 'complete'; taskId: string; mode?: boolean | string }
  | { type: 'postpone'; taskIds: string | string[]; title?: string }
  | { type: 'batch-complete'; payload: { taskIds: string[]; autoRecord?: boolean } | string[] }
  | { type: 'batch-skip'; taskIds: string[] }
  | { type: 'batch-complete-med'; medicationTaskIds: string[] }
  | { type: 'record-dose'; payload: { medicationTaskId: string } }
  | { type: 'action'; payload: { type: string; data: unknown } }
