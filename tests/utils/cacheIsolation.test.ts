import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))

function readSource(relativePath: string) {
  return readFileSync(resolve(testDir, '../../', relativePath), 'utf8')
}

describe('account session cache isolation contract', () => {
  it('提交反馈缓存应按当前家庭隔离，且不再写全局 key', () => {
    const source = readSource('src/composables/useSubmitFeedback.ts')
    expect(source).toContain("getWorkspaceCacheKey('submit-feedback', familyId)")
    expect(source).toContain('if (!nextPayload.targetRoute || !storageKey) return nextPayload')
    expect(source).toContain("if ((payload.familyId || '') !== familyId)")
    expect(source).toContain('uni.removeStorageSync(STORAGE_KEY)')
    expect(source).not.toContain('uni.setStorageSync(STORAGE_KEY')
    expect(source).not.toContain('uni.getStorageSync(STORAGE_KEY')
  })

  it('首页聚焦与疾病观察折叠缓存应按当前家庭隔离', () => {
    const focusSource = readSource('src/utils/homeCardFocus.ts')
    const sickCardSource = readSource('src/components/smart-card/SickObservationCard.vue')

    expect(focusSource).toContain("getWorkspaceCacheKey('home-card-focus', familyId)")
    expect(focusSource).toContain('if (!storageKey) return payload')
    expect(focusSource).toContain("if ((payload.familyId || '') !== familyId) return null")
    expect(focusSource).not.toContain('uni.setStorageSync(STORAGE_KEY')
    expect(focusSource).not.toContain('uni.getStorageSync(STORAGE_KEY')

    expect(sickCardSource).toContain("getWorkspaceCacheKey('sick-observation-collapse', familyId)")
    expect(sickCardSource).toContain('if (!storageKey) return')
    expect(sickCardSource).not.toContain('uni.setStorageSync(COLLAPSE_KEY')
    expect(sickCardSource).not.toContain('uni.getStorageSync(COLLAPSE_KEY')
  })

  it('最近操作缓存没有当前家庭时应跳过读写', () => {
    const source = readSource('src/stores/taskStore.ts')
    expect(source).toContain("return familyId ? getWorkspaceCacheKey('recent-actions', familyId) : ''")
    expect(source).toContain('if (!storageKey) return []')
    expect(source).toContain('if (!storageKey) return')
    expect(source).not.toContain("const STORAGE_KEY = 'recent_actions'")
  })

  it('家庭创建加入反馈应显式携带目标家庭，并在首页恢复家庭后消费', () => {
    const setupSource = readSource('src/pages/family/setup.vue')
    const joinSource = readSource('src/pages/family/join.vue')
    const homeSource = readSource('src/pages/home/index.vue')

    expect(setupSource).toContain("familyId: String((res as any)?.data?.familyId || '')")
    expect(setupSource).toContain('familyId,')
    expect(joinSource).toContain("familyId: String(res.data.familyId || '')")
    expect(homeSource.indexOf('const familyId = getCurrentFamilyId()')).toBeLessThan(homeSource.indexOf("const feedback = consumeSubmitFeedback('/pages/home/index')"))
  })
})
