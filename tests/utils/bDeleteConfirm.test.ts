import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/layout/BDeleteConfirm.vue'), 'utf8')

describe('BDeleteConfirm source contract', () => {
  it('应使用左右双按钮，并保持左取消右删除', () => {
    expect(source).toContain('<view class="b-delete-confirm__btn b-delete-confirm__btn--cancel" @click="cancel">')
    expect(source).toContain('<view class="b-delete-confirm__btn b-delete-confirm__btn--danger" @click="doConfirm">')
    expect(source.indexOf('b-delete-confirm__btn--cancel')).toBeLessThan(source.indexOf('b-delete-confirm__btn--danger'))
    expect(source).toContain('flex-direction: row;')
    expect(source).toContain('flex: 1;')
  })
})
