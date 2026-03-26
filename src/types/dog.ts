/**
 * 犬只档案相关类型
 */
import type { BaseDocument, SoftDeletable } from './index'

// 犬只性别
export type DogGender = '公' | '母'

// 犬只处置状态
export type DogDisposition = '在养' | '已故' | '已售' | '已领养' | '已赠送' | '已退休'

// 犬只档案
export interface Dog extends BaseDocument, SoftDeletable {
  name: string
  gender: DogGender
  birth_date: number | null     // timestamp 毫秒数
  color: string
  microchip_id?: string
  dam_id?: string               // 母犬
  dam_name?: string             // 冗余
  sire_id?: string              // 父犬
  sire_name?: string            // 冗余
  avatar?: string               // 云存储 fileID
  disposition: DogDisposition
  is_external_sire: boolean     // 外部种公标记
  owner_info?: string           // 外部种公主人信息
  disposition_date?: number
  disposition_notes?: string
}

// 犬只状态（实时派生，不存储）
export interface DogStatus {
  breeding?: string             // 如：发情中、怀孕中、已生产
  health?: string[]             // 如：用药中、待疫苗
  age?: string                  // 如：3月龄、2岁
  pregnancy_day?: number        // 如：孕期第58天
}

// 体重记录
export interface DogWeight extends BaseDocument {
  dog_id: string
  weight: number                // 克（g）
  measured_at: number
}
