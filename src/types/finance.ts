/**
 * 财务相关类型
 */
import type { BaseDocument, SoftDeletable } from './index'
import type { AutoIncomeType, ExpenseCategoryGroupKey, LegacyIncomeType, ManualIncomeType } from '@/constants/financeCategories'
export type {
  AutoIncomeType,
  ExpenseCategoryGroupKey,
  LegacyIncomeType,
  ManualIncomeType,
} from '@/constants/financeCategories'

// 费用来源类型
export type ExpenseSourceType = 'manual' | 'auto'

// 费用
export interface Expense extends BaseDocument, SoftDeletable {
  total_amount: number
  category: string
  category_group_label?: string
  date: number
  linked_cycle_id?: string | null
  linked_litter_id?: string | null
  linked_dog_ids?: string[]
  source_type: ExpenseSourceType
  source_record_id?: string | null
  images?: string[]
  dam_name?: string | null    // 冗余
  dog_names?: string[]        // 冗余
  litter_number?: number | null // 冗余
  notes?: string | null
  created_by: string | null
  created_by_name?: string
}

// 收入类型
// 当前写入口径：销售 / 定金保留 / 领养 / 其他 / 退款
// 历史兼容读取：定金 / 领养费 / 配种费收入
export type IncomeType = ManualIncomeType | AutoIncomeType | LegacyIncomeType

// 收入
export interface Income extends BaseDocument, SoftDeletable {
  type: IncomeType
  amount: number
  date: number
  sale_record_id?: string | null
  source_sale_id?: string | null
  source_type?: string | null
  source_record_id?: string | null
  dog_id?: string | null
  dog_name?: string | null    // 冗余
  notes?: string | null
  images?: string[]
  created_by: string | null
  created_by_name?: string
}

// 销售记录
export interface SaleRecord extends BaseDocument, SoftDeletable {
  dog_id: string
  dog_name: string            // 冗余
  family_id: string
  status: '待售' | '已预定' | '已成交' | '已退款' | '定金取消'
  sale_mode?: '自售' | '代理' | '代卖' | null // null 表示待定
  settlement_status?: '未结算' | '部分结算' | '已结算' | null
  floor_price?: number | null
  deposit_amount?: number | null
  deposit_date?: number | null
  agreed_price?: number | null
  received_amount?: number | null
  seller_agent_id?: string | null
  seller_agent_name?: string | null
  platform?: string | null
  date?: number | null
  delivery_date?: number | null
  buyer_info?: string | null
  refund_amount?: number | null
  refund_reason?: string | null
  refund_date?: number | null
  deposit_kept_amount?: number | null
  can_restart_sale?: boolean
  notes?: string | null
  created_by: string
}

// 代理人
export interface Agent extends BaseDocument, SoftDeletable {
  name: string
  phone?: string
  wechat?: string
  commission_rate?: number
  notes?: string
}

export interface ExpenseCategory {
  name: string
  parent_group: ExpenseCategoryGroupKey
  is_default?: boolean
}

export interface ExpenseCategoryGroup {
  key: ExpenseCategoryGroupKey
  label: string
  is_default?: boolean
}
