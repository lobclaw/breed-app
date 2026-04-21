import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

describe('home page sheet source contract', () => {
  it('应让首页底部表单/确认 Sheet 统一为左取消右确认', () => {
    expect(source).toContain(`        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showQuickComplete = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="confirmQuickComplete">`)
    expect(source).toContain(`        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showPostponeModal = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="doPostpone">`)
    expect(source).toContain(`        <view class="stop-confirm-actions">
          <view class="stop-confirm-btn stop-confirm-btn--cancel" @click="showStopConfirm = false">
            <text>继续用药</text>
          </view>
          <view class="stop-confirm-btn stop-confirm-btn--danger" @click="confirmStopMedication">`)
  })
})
