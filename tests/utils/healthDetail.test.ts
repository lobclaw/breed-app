import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/record/health-detail.vue'), 'utf8')

describe('health-detail source contract', () => {
  it('编辑入口应按健康记录类型直达对应表单页', () => {
    expect(source).toContain('buildHealthRecordEditUrl(record.value.type, recordId)')
    expect(source).toContain('buildHealthRecordEditUrl(record.value?.type, recordId)')
    expect(source).toContain('当前记录暂不支持编辑')
    expect(source).not.toContain('/pages/record/health-edit')
  })
})
