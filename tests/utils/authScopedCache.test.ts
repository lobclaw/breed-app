import { describe, expect, it } from 'vitest'
import { buildBeijingTimestampFromParts } from '@/utils/date'
import {
  getFamilyCacheKey,
  getTodayWorkspaceDayKey,
  getWorkspaceCacheKey,
  isFamilyAccessibleToUid,
  WORKSPACE_CACHE_VERSION,
} from '@/utils/authScopedCache'

describe('auth scoped cache', () => {
  it('家庭身份缓存按 uid 分桶，workspace 快照按 familyId 分桶', () => {
    expect(getFamilyCacheKey('user_a')).toBe('breed_family_cache:user_a')
    expect(getFamilyCacheKey('user_a')).not.toBe(getFamilyCacheKey('user_b'))

    expect(getWorkspaceCacheKey('tasks', 'fam_a')).toBe('breed_workspace_cache:tasks:fam_a')
    expect(getWorkspaceCacheKey('tasks', 'fam_a')).not.toBe(getWorkspaceCacheKey('tasks', 'fam_b'))
    expect(getWorkspaceCacheKey('tasks', 'fam_a')).not.toBe(getWorkspaceCacheKey('dogs', 'fam_a'))
    expect(WORKSPACE_CACHE_VERSION).toBe(1)
  })

  it('家庭缓存只允许当前 uid 可访问时恢复', () => {
    const family = {
      _id: 'fam_1',
      creator_id: 'creator_1',
      members: [
        { user_id: 'user_active', status: 'active' },
        { user_id: 'user_removed', status: 'removed' },
      ],
    } as any

    expect(isFamilyAccessibleToUid(family, 'creator_1')).toBe(true)
    expect(isFamilyAccessibleToUid(family, 'user_active')).toBe(true)
    expect(isFamilyAccessibleToUid(family, 'user_removed')).toBe(false)
    expect(isFamilyAccessibleToUid(family, 'user_other')).toBe(false)
  })

  it('首页 workspace dayKey 按北京时间日期变化', () => {
    const beforeMidnight = buildBeijingTimestampFromParts(2026, 4, 13, 23, 59)
    const afterMidnight = buildBeijingTimestampFromParts(2026, 4, 14, 0, 1)

    expect(getTodayWorkspaceDayKey(beforeMidnight)).toBe(String(buildBeijingTimestampFromParts(2026, 4, 13)))
    expect(getTodayWorkspaceDayKey(afterMidnight)).toBe(String(buildBeijingTimestampFromParts(2026, 4, 14)))
    expect(getTodayWorkspaceDayKey(beforeMidnight)).not.toBe(getTodayWorkspaceDayKey(afterMidnight))
  })
})
