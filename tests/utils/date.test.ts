import { describe, it, expect } from 'vitest'

// 示例测试 — 验证 vitest 配置正确
describe('日期工具函数', () => {
  it('timestamp 毫秒数应为正整数', () => {
    const now = Date.now()
    expect(now).toBeGreaterThan(0)
    expect(Number.isInteger(now)).toBe(true)
  })
})
