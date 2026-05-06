import { describe, expect, it } from 'vitest'

import { resolveBatchCardProgress } from '@/utils/batchCardProgress'

describe('resolveBatchCardProgress', () => {
  it('初始 2 只犬且勾选 1 只时返回 1/2', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-1', dogName: '泡泡' },
      { dogId: 'dog-2', dogName: '豆豆' },
    ], ['dog-1'])

    expect(state.doneCount).toBe(1)
    expect(state.totalDogs).toBe(2)
    expect(state.allDone).toBe(false)
    expect(Array.from(state.checkedDogIds)).toEqual(['dog-1'])
  })

  it('卡片收缩后会裁剪掉已移除犬只的本地勾选状态', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-2', dogName: '豆豆' },
    ], ['dog-1', 'dog-2'])

    expect(state.doneCount).toBe(1)
    expect(state.totalDogs).toBe(1)
    expect(state.allDone).toBe(true)
    expect(Array.from(state.checkedDogIds)).toEqual(['dog-2'])
  })

  it('当前剩余犬只未勾选时显示 0/1', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-2', dogName: '豆豆' },
    ], ['dog-1'])

    expect(state.doneCount).toBe(0)
    expect(state.totalDogs).toBe(1)
    expect(state.allDone).toBe(false)
    expect(Array.from(state.checkedDogIds)).toEqual([])
  })

  it('当前剩余犬只已勾选时显示 1/1', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-2', dogName: '豆豆' },
    ], ['dog-2'])

    expect(state.doneCount).toBe(1)
    expect(state.totalDogs).toBe(1)
    expect(state.allDone).toBe(true)
    expect(Array.from(state.checkedDogIds)).toEqual(['dog-2'])
  })

  it('兼容 dogId 和 dog_id 混用', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-1', dogName: '泡泡' },
      { dog_id: 'dog-2', dogName: '豆豆', completed: true },
    ], ['dog-1', 'dog-3'])

    expect(state.doneCount).toBe(2)
    expect(state.totalDogs).toBe(2)
    expect(state.allDone).toBe(true)
    expect(Array.from(state.activeDogIds)).toEqual(['dog-1', 'dog-2'])
    expect(Array.from(state.checkedDogIds)).toEqual(['dog-1'])
  })

  it('保留已完成犬只时仍按整张卡显示 1/2', () => {
    const state = resolveBatchCardProgress([
      { dogId: 'dog-1', dogName: '泡泡', completed: true },
      { dogId: 'dog-2', dogName: '豆豆', completed: false },
    ])

    expect(state.doneCount).toBe(1)
    expect(state.totalDogs).toBe(2)
    expect(state.allDone).toBe(false)
    expect(Array.from(state.checkedDogIds)).toEqual([])
  })
})
