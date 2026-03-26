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

// 预生成任务
export interface Task extends BaseDocument {
  card_type: CardType
  dog_id?: string
  dog_name?: string           // 冗余
  litter_id?: string
  cycle_id?: string
  title: string
  description?: string
  due_date: number            // 应完成日期
  status: TaskStatus
  urgency: TaskUrgency
  source_type: string         // 来源类型（vaccination_next, deworming_next, weaning, etc.）
  source_record_id?: string   // 来源记录 ID
  completed_at?: number
  completed_by?: string
  postponed_count?: number    // 推迟次数
  postpone_reason?: string
  batch_key?: string          // 批量合并 key（如 deworming_2026-03-26）
}
