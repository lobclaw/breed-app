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
  linked_cycle_id?: string
  linked_litter_id?: string
  linked_dog_ids?: string[]
  source_type: ExpenseSourceType
  source_record_id?: string
  images?: string[]
  dam_name?: string           // 冗余
  dog_names?: string[]        // 冗余
  litter_number?: number      // 冗余
  notes?: string
  created_by: string
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
  sale_record_id?: string
  dog_id?: string
  dog_name?: string           // 冗余
  notes?: string
  created_by: string
  created_by_name?: string
}

// 销售记录
export interface SaleRecord extends BaseDocument, SoftDeletable {
  dog_id: string
  dog_name: string            // 冗余
  buyer_name: string
  buyer_phone?: string
  sale_price: number
  deposit_amount?: number
  status: '待付款' | '已付定金' | '已完成' | '已取消'
  notes?: string
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
