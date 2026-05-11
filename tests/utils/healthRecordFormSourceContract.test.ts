import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/record/HealthRecordForm.vue'), 'utf8')

describe('health record form source contract', () => {
  it('健康记录编辑页应使用具体类型标题并隐藏记录类型展示块', () => {
    expect(source).toContain("return (isEdit.value ? currentRecord.value?.type || props.type : props.type) || ''")
    expect(source).toContain('if (isEdit.value && resolvedType.value) return `编辑${typeLabels[resolvedType.value]}记录`')
    expect(source).not.toContain('记录类型')
    expect(source).not.toContain('type-display')
  })
})
