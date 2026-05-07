import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const testDir = __dirname
const batchCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BatchCard.vue'), 'utf8')
const homeSource = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

describe('home batch card source contract', () => {
  it('批量健康卡应保留逐只勾选，并按犬只数量调整底部主按钮文案', () => {
    expect(batchCardSource).toContain("emit('complete', task._id, allDone ? 'batch-auto' : 'batch-auto-partial')")
    expect(batchCardSource).toContain('<text class="btn-text btn-text--white">{{ primaryActionLabel }}</text>')
    expect(batchCardSource).toContain("const primaryActionLabel = computed(() => totalDogs.value === 1 ? '完成' : '完成全部')")
  })

  it('首页应让批量卡部分完成只做局部承接，全部完成后再整卡退场', () => {
    expect(homeSource).toContain("if (mode === 'batch-auto') {")
    expect(homeSource).toContain('removeCardLocally(taskId, true)')
    expect(homeSource).toContain("if (mode === 'batch-auto-partial') {")
    expect(homeSource).toContain('removeCardLocally(taskId, false, false)')
    expect(homeSource).toContain('function applyLocalBatchCardProgress(card: any)')
    expect(homeSource).toContain('function markBatchDogCompleted(card: any, taskId: string)')
  })

  it('首页应把批量卡局部进度同步到持久缓存，刷新后继续显示 1/2', () => {
    expect(homeSource).toContain('const localBatchCardProgressMap = ref<Record<string, { dogs: any[]; completedDogIds: string[] }>>(taskStore.batchCardProgress || {})')
    expect(homeSource).toContain('function syncTaskStoreHomeCache()')
    expect(homeSource).toContain('function pruneLocalBatchCardProgress(cardList: any[] = [])')
    expect(homeSource).toContain('function restorePersistedHealthBatchCards(cardList: any[] = [])')
    expect(homeSource).toContain('return restorePersistedHealthBatchCards(cardList).map((card: any) => {')
    expect(homeSource).toContain('taskStore.batchCardProgress = { ...localBatchCardProgressMap.value }')
    expect(homeSource).toContain('localBatchCardProgressMap.value = { ...(taskStore.batchCardProgress || {}) }')
  })
})
