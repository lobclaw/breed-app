import { describe, expect, it } from 'vitest'

import { createAllAddRecordGroups } from '@/utils/addRecordSheet'

describe('createAllAddRecordGroups', () => {
  it('幼崽模式下只返回健康和用药分组', () => {
    const groups = createAllAddRecordGroups({ allowBreeding: false })

    expect(groups.map(group => group.key)).toEqual(['health', 'medication'])
  })

  it('默认保留繁育、健康、用药三组', () => {
    const groups = createAllAddRecordGroups()

    expect(groups.map(group => group.key)).toEqual(['breeding', 'health', 'medication'])
  })
})
