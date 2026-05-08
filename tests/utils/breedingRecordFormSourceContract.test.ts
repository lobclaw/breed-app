import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/record/BreedingRecordForm.vue'), 'utf8')

describe('breeding record form source contract', () => {
  it('本地合成的繁育 milestone 不应被当成真实待办完成', () => {
    expect(source).toContain('const prefillTaskIsPersisted = ref(false)')
    expect(source).toContain('prefillTaskIsPersisted.value = true')
    expect(source).toContain('if (prefillTaskId.value && prefillTaskIsPersisted.value)')
    expect(source).toContain('const completedTaskIds = prefillTaskId.value && prefillTaskIsPersisted.value ? [prefillTaskId.value] : []')
    expect(source).toContain('message: buildRecordFeedbackMessage(1, completedTaskIds.length)')
  })

  it('异常终止类型应按当前周期状态过滤放弃配种', () => {
    expect(source).toContain("const ABANDON_MATING_TERMINATION = '放弃配种'")
    expect(source).toContain("if (terminationCycleStatus.value === '发情中') return [ABANDON_MATING_TERMINATION]")
    expect(source).toContain('return pregnancyTerminationTypes')
    expect(source).toContain('visibleTerminationTypes.value.includes(details.termination_type)')
    expect(source).toContain('details.termination_type = \'\'')
  })
})
