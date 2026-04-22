/**
 * 主题语义映射
 * 统一首页分区、健康类型、犬只状态的颜色语义，避免页面各自维护分叉映射。
 */

import type { WorkbenchSectionKey } from '@/types/home-workbench'
import type { DeriveStatusType } from '@/types/dog'

export type SemanticColor = 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
export type SemanticVariant = 'default' | 'illness' | 'overdue'

export interface SemanticTone {
  color: SemanticColor
  variant: SemanticVariant
}

export function getWorkbenchSectionColor(sectionKey: WorkbenchSectionKey): SemanticColor {
  const map: Record<WorkbenchSectionKey, SemanticColor> = {
    overdue: 'red',
    breeding: 'amber',
    reminders: 'blue',
    therapy: 'plum',
  }
  return map[sectionKey]
}

export function getHealthTypeTone(type: string, priority?: string): SemanticTone {
  if (priority === 'overdue') return { color: 'red', variant: 'overdue' }

  const map: Record<string, SemanticTone> = {
    vaccination: { color: 'blue', variant: 'default' },
    deworming: { color: 'teal', variant: 'default' },
    illness: { color: 'red', variant: 'illness' },
    medication: { color: 'plum', variant: 'default' },
    health_attention: { color: 'plum', variant: 'default' },
  }

  return map[type] || { color: 'blue', variant: 'default' }
}

export function getDogStatusTone(statusType: DeriveStatusType | string, priority?: string): SemanticTone {
  if (priority === 'overdue') return { color: 'red', variant: 'overdue' }

  const map: Record<string, SemanticTone> = {
    '发情中': { color: 'amber', variant: 'default' },
    '怀孕中': { color: 'rose', variant: 'default' },
    '哺乳中': { color: 'amber', variant: 'default' },
    '生病中': { color: 'red', variant: 'illness' },
    '用药中': { color: 'plum', variant: 'default' },
  }

  return map[statusType] || { color: 'green', variant: 'default' }
}

export function isIllnessTaskType(type: string | undefined): boolean {
  return type === 'illness'
}
