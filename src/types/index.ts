/**
 * 通用类型定义
 */

// 云对象响应格式
export interface CloudResult<T = unknown> {
  code: number
  message?: string
  data?: T
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页结果
export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 软删除基础字段（仅支持软删除的集合使用）
export interface SoftDeletable {
  deleted_at: number | null
}

// 基础时间戳字段
export interface Timestamped {
  created_at: number
  updated_at: number
}

// 所有集合的基础字段
export interface BaseDocument extends Timestamped {
  _id: string
  family_id: string
}
