/**
 * 回收站相关类型
 */

export type RecycleItemType =
  | 'dog'
  | 'expense'
  | 'income'
  | 'agent'
  | 'medication_protocol'

export interface RecycleBinItem {
  _id: string
  type: RecycleItemType
  type_label: string
  name: string
  summary: string
  deleted_at: number
  days_remaining: number
}
