/**
 * 健康管理相关类型
 */
import type { BaseDocument } from './index'

// 健康记录类型
export type HealthRecordType = 'vaccination' | 'deworming' | 'illness'

// 驱虫类型
export type DewormingType = 'internal' | 'external' | 'combo'

// 健康记录
export interface HealthRecord extends BaseDocument {
  type: HealthRecordType
  dog_id: string
  dog_name: string            // 冗余
  date: number
  cost?: number               // 费用（触发自动记账）
  images?: string[]
  notes?: string
  details?: Record<string, any>  // 类型特有字段
  created_by: string
}

// 用药任务状态
export type MedicationTaskStatus = '进行中' | '已完成' | '已取消'

// 用药任务
export interface MedicationTask extends BaseDocument {
  dog_id: string
  dog_name: string            // 冗余
  source_record_id: string    // 关联的疾病记录
  drug_name: string
  dosage: string
  frequency: number           // 每日次数
  start_date: number
  end_date: number
  status: MedicationTaskStatus
  notes?: string
}

// 用药方案
export interface MedicationProtocol extends BaseDocument {
  name: string
  target_condition: string
  weight_range?: string
  drugs: MedicationProtocolDrug[]
  duration_days?: number
  notes?: string
}

export interface MedicationProtocolDrug {
  drug_name: string
  dosage_per_kg?: number
  dosage_fixed?: number
  frequency: number
  unit: string
}
