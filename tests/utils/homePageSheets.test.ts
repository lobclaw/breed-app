import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')
const sheetSource = readFileSync(resolve(testDir, '../../src/pages/home/components/HomeTaskSheets.vue'), 'utf8')
const suppressionSource = readFileSync(resolve(testDir, '../../src/pages/home/composables/useHomeSuppression.ts'), 'utf8')

describe('home page sheet source contract', () => {
  it('应让首页底部表单/确认 Sheet 统一为左取消右确认', () => {
    expect(sheetSource).toContain(`        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="quickCompleteVisible = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="$emit('confirm-quick-complete')">`)
    expect(sheetSource).toContain(`        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="postponeVisible = false"><text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text></view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="$emit('confirm-postpone')">`)
    expect(sheetSource).toContain(`        <view class="stop-confirm-actions">
          <view class="stop-confirm-btn stop-confirm-btn--cancel" @click="stopConfirmVisible = false"><text>继续用药</text></view>
          <view class="stop-confirm-btn stop-confirm-btn--danger" @click="$emit('confirm-stop-medication')">`)
  })

  it('今日用药卡的康复菜单应透传 illnessIds 与 medicationTaskIds', () => {
    expect(source).toContain('const rawIllnessIds: unknown[] = [')
    expect(source).toContain("...(Array.isArray(dog.illnessIds) ? dog.illnessIds : [])")
    expect(source).toContain('const medicationTaskIds = (dog.allMedTasks || [])')
    expect(source).toContain("removeMedicationDogsLocally(payload.data?.dogId ? [payload.data.dogId] : [])")
    expect(source).toContain("void recoverIllnesses({ illnessIds, medicationTaskIds })")
  })

  it('繁育主链记录返回首页时应保留卡片，由本地投影更新下一阶段', () => {
    expect(source).toContain("const shouldKeepBreedingCardInPlace = payload?.homeSection === 'breeding'")
    expect(source).toContain("payload.homeAnchorKey.startsWith('breeding-step:')")
    expect(source).toContain("if (payload?.completedTaskIds?.length && !shouldKeepBreedingCardInPlace)")
  })

  it('首页反馈 suppression 不应隐藏本地合成繁育 milestone', () => {
    expect(suppressionSource).toContain('function filterSuppressibleTaskIds(taskIds: string[] = [])')
    expect(suppressionSource).toContain("!taskId.startsWith('synthetic_breeding_milestone:')")
    expect(source).toContain('addSuppressedTasks(filterSuppressibleTaskIds(payload?.suppressTaskIds || payload?.completedTaskIds || []))')
  })
})
