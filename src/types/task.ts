/**
 * 任务/首页卡片相关类型
 */
import type { BaseDocument } from './index'

// 卡片类型
export type CardType = 'breeding' | 'health' | 'medication' | 'care'

// 任务状态
export type TaskStatus = 'pending' | 'completed' | 'cancelled' | 'postponed'

// 任务紧急程度
export type TaskUrgency = 'normal' | 'urgent' | 'overdue'
export type TaskPriority = 'overdue' | 'today' | 'upcoming'

// 预生成任务
export interface Task extends BaseDocument {
  card_type: CardType | 'individual' | string
  dog_id?: string
  dog_name?: string           // 冗余
  litter_id?: string
  cycle_id?: string
  type?: string
  title?: string
  description?: string
  due_date?: number | string | null // 应完成日期
  next_reminder_date?: number | string | null
  status: TaskStatus
  urgency?: TaskUrgency
  priority?: TaskPriority
  source_type?: string | null // 来源类型（vaccination_next, deworming_next, weaning, etc.）
  source_collection?: string | null
  source_record_id?: string | null // 来源记录 ID
  completed_at?: number
  completed_by?: string
  postponed_count?: number    // 推迟次数（新字段兼容）
  postpone_count?: number     // 推迟次数（当前本地字段）
  postpone_reason?: string
  batch_key?: string          // 批量合并 key（如 deworming_2026-03-26）
  details?: Record<string, unknown> | null
}
