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
})
