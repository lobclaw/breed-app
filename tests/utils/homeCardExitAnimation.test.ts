import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const testDir = __dirname
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')
const sickObservationCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/SickObservationCard.vue'), 'utf8')

describe('home card exit animation contract', () => {
  it('本地刷新前应等待首页卡片退场动画结束', () => {
    expect(source).toContain('const pendingCardExitPromises = new Set<Promise<void>>()')
    expect(source).toContain('function trackCardExit(promise: Promise<void>)')
    expect(source).toContain('async function waitForPendingCardExits()')
    expect(source).toContain('await waitForPendingCardExits()')
    expect(source).toContain('trackCardExit(new Promise((resolve) => {')
  })

  it('疾病观察单条应先淡出再从卡片中移除', () => {
    expect(source).toContain('const SICK_ROW_EXIT_MS = 350')
    expect(source).toContain('function removeSickDogLocally(dogId: string, illnessId?: string)')
    expect(source).toContain('return { ...dog, _removing: true }')
    expect(source).toContain('const remaining = (currentCard.dogs || []).filter((dog: any) => (')
    expect(sickObservationCardSource).toContain("'sick-row--removing': dog._removing")
    expect(sickObservationCardSource).toContain('&--removing')
  })
})
