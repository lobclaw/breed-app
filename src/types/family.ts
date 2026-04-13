/**
 * 家庭/协作相关类型
 */
import type { Timestamped } from './index'

// 成员角色
export type MemberRole = 'creator' | 'admin' | 'helper'

// 成员状态
export type MemberStatus = 'active' | 'invited' | 'removed'

// 家庭成员
export interface FamilyMember {
  user_id: string
  role: MemberRole
  status: MemberStatus
  nickname?: string
  joined_at: number
}

// 护理规则
export interface CareRule {
  status_trigger: string
  task_description: string
  frequency: string
}

// 家庭设置
export interface FamilySettings {
  default_weaning_days: number
  default_vaccine_interval_puppy: number
  default_vaccine_interval_adult: number
  default_deworming_interval_puppy: number
  default_deworming_interval_adult: number
  morning_summary_time: string
  custom_vaccine_types: string[]
  custom_deworming_drugs: {
    internal: string[]
    external: string[]
    combo: string[]
  }
  custom_condition_types: string[]
  custom_breed_types: string[]
}

// 家庭
export interface Family extends Timestamped {
  _id: string
  name: string
  creator_id: string
  members: FamilyMember[]
  care_rules: CareRule[]
  settings: FamilySettings
}
