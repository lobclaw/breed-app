/**
 * 繁育相关类型
 */
import type { BaseDocument } from './index'

// 繁育周期状态
export type CycleStatus = '发情中' | '怀孕中' | '已生产' | '失败' | '放弃'

// 繁育记录类型
export type BreedingRecordType =
  | 'heat'                // 发情
  | 'heat_observation'    // 发情观察
  | 'follicle_check'      // 卵泡检测
  | 'mating'              // 配种
  | 'pregnancy_check'     // 孕检
  | 'prenatal_check'      // 产前检查
  | 'pre_labor'           // 临产
  | 'birth'               // 生产
  | 'abnormal_termination' // 异常终止

// 繁育周期
export interface BreedingCycle extends BaseDocument {
  dam_id: string
  dam_name: string            // 冗余
  sire_id?: string
  sire_name?: string          // 冗余
  status: CycleStatus
  // cycle_number 动态计算，不存储
  cycle_number?: number
}

// 繁育记录
export interface BreedingRecord extends BaseDocument {
  type: BreedingRecordType
  cycle_id: string
  dog_id: string
  date: number                // timestamp 毫秒数
  cost?: number               // 费用（触发自动记账）
  images?: string[]           // 云存储 fileID
  notes?: string
  details?: Record<string, any>  // 类型特有字段
  created_by: string
}

// 窝
export interface Litter extends BaseDocument {
  cycle_id: string
  dam_id: string
  dam_name: string            // 冗余
  sire_id?: string
  sire_name?: string          // 冗余
  birth_date: number
  total_born: number
  born_alive: number
  born_dead: number
  birth_type: string          // 顺产 / 难产 / 剖腹产
  birth_notes?: string
  weaned_at?: number | null
  created_by: string
  // litter_number 动态计算，不存储
}

export interface BreedingCycleExpense extends BaseDocument {
  total_amount: number
  category?: string
  notes?: string
  date: number
  linked_cycle_id?: string | null
  source_type?: string | null
  source_record_id?: string | null
}

export interface BreedingCycleDetailResponse {
  cycle: BreedingCycle
  records: BreedingRecord[]
  litter: Litter | null
  expenses: BreedingCycleExpense[]
}
