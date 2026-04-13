/**
 * 犬只档案相关类型
 */
import type { BaseDocument, SoftDeletable } from './index'

// 犬只性别
export type DogGender = '公' | '母'

// 犬只角色
export type DogRole = '种狗' | '幼崽' | '外部种公'

// 犬只处置状态
export type DogDisposition = '在养' | '待售' | '已预定' | '已售' | '已领养' | '已赠送' | '自留' | '已退休' | '已故'

// 派生状态类型
export type DeriveStatusType = '发情中' | '怀孕中' | '哺乳中' | '生病中' | '用药中' | '正常'

// 犬只档案
export interface Dog extends BaseDocument, SoftDeletable {
  name: string
  gender: DogGender
  role: DogRole
  disposition: DogDisposition
  species: string
  breed: string
  birth_date?: number | null
  purchase_date?: number | null
  purchase_price?: number | null
  latest_weight?: number | null
  origin_litter_id?: string | null
  owner_info?: string | null
  avatar?: string
  disposition_date?: number | null
  disposition_notes?: string | null
  statuses?: DeriveStatus[]
}

// 实时派生状态
export interface DeriveStatus {
  type: DeriveStatusType
  cycleId?: string
  recordId?: string
  taskId?: string
  label?: string
  detail?: string
  progress?: { current: number; total: number }
  meta?: Array<{ icon: string; text: string }>
}

// 列表项（Dog + 派生状态）
export interface DogWithStatus extends Dog {
  statuses: DeriveStatus[]
}

// 体重记录
export interface DogWeight extends BaseDocument {
  dog_id: string
  weight: number
  measured_at: number
}
