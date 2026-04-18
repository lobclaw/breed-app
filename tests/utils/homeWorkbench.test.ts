import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { HomeCard, HomeTask, HomeWorkbenchDog } from '@/types/home-workbench'
import { buildHomeWorkbench, WORKBENCH_SECTION_META } from '@/utils/homeWorkbench'

const testDir = dirname(fileURLToPath(import.meta.url))

function makeTask(overrides: Partial<HomeTask> = {}): HomeTask {
  return {
    _id: overrides._id || 'task-1',
    type: overrides.type || 'vaccination',
    title: overrides.title || '待处理任务',
    status: overrides.status || 'pending',
    details: overrides.details || {},
    ...overrides,
  }
}

function makeBreedingMilestoneCard(id: string, stepType: string, title = '繁育任务'): HomeCard {
  return {
    id,
    cardType: 'dog',
    domain: 'breeding',
    sectionType: 'workflow',
    priority: 'today',
    dogId: `${id}-dog`,
    dogName: `${id}犬`,
    tasks: [
      makeTask({
        _id: `${id}-task`,
        type: 'breeding_milestone',
        title,
        details: { step_type: stepType },
      }),
    ],
  }
}

function makeBreedingExtraCard(id: string, kind = 'exam'): HomeCard {
  return {
    id,
    cardType: 'dog',
    domain: 'breeding',
    sectionType: 'workflow_extra',
    priority: 'today',
    groupTitle: '额外安排',
    tasks: [
      makeTask({
        _id: `${id}-task`,
        type: 'breeding_extra_arrangement',
        title: '复查安排',
        details: { kind },
      }),
    ],
  }
}

function makeHealthBatchCard(id: string, taskType: 'vaccination' | 'deworming'): HomeCard {
  const details = taskType === 'vaccination'
    ? { vaccine_type: '六联' }
    : { deworming_type: 'internal', drug_name: '海乐妙' }
  return {
    id,
    cardType: 'batch',
    domain: 'health',
    sectionType: 'reminders',
    priority: 'today',
    groupTitle: taskType === 'vaccination' ? '六联疫苗' : '体内驱虫',
    tasks: [
      makeTask({ _id: `${id}-a`, type: taskType, details }),
      makeTask({ _id: `${id}-b`, type: taskType, details }),
    ],
    dogs: [
      { dogId: `${id}-dog-a`, dogName: '泡泡' },
      { dogId: `${id}-dog-b`, dogName: '豆豆' },
    ],
    progress: { done: 0, total: 2 },
  }
}

function makeHealthSingleCard(id: string, taskType: 'vaccination' | 'deworming'): HomeCard {
  const details = taskType === 'vaccination'
    ? { vaccine_type: '狂犬' }
    : { deworming_type: 'external', drug_name: '福来恩' }
  return {
    id,
    cardType: 'dog',
    domain: 'health',
    sectionType: 'reminders',
    priority: 'today',
    dogId: `${id}-dog`,
    dogName: '奶糖',
    tasks: [makeTask({ _id: `${id}-task`, type: taskType, details })],
  }
}

function makeMedicationDog(
  dogId: string,
  allMedTasks: Array<Partial<HomeTask> & { doses_given?: number }> = [],
): HomeWorkbenchDog {
  return {
    dogId,
    dogName: dogId,
    allMedTasks: allMedTasks.map((task, index) => ({
      _id: `${dogId}-med-${index}`,
      status: 'pending',
      doses_given: 0,
      details: { frequency: 1 },
      ...task,
    })),
  }
}

function makeMedicationCard(): HomeCard {
  return {
    id: 'med-card',
    cardType: 'medication',
    domain: 'medication',
    sectionType: 'therapy',
    priority: 'today',
    groupTitle: '今日用药',
    dogs: [
      makeMedicationDog('done', [{ status: 'completed' }]),
      makeMedicationDog('pending', [{ doses_given: 0, details: { frequency: 2 } }]),
      makeMedicationDog('partial', [
        { status: 'completed' },
        { status: 'pending', doses_given: 0, details: { frequency: 1 } },
      ]),
    ],
  }
}

function makeOverdueCard(id: string, domain: string): HomeCard {
  return {
    id,
    cardType: 'dog',
    domain,
    sectionType: domain === 'breeding' ? 'workflow' : 'reminders',
    priority: 'overdue',
    overdueDays: 2,
    groupTitle: `${domain} overdue`,
    tasks: [makeTask({ _id: `${id}-task`, type: domain === 'breeding' ? 'breeding_milestone' : 'vaccination' })],
  }
}

describe('buildHomeWorkbench', () => {
  it('生成固定四区块和首页元数据', () => {
    const workbench = buildHomeWorkbench([], { visibleRowLimit: 2 })

    expect(workbench.sectionOrder).toEqual(['overdue', 'breeding', 'reminders', 'therapy'])
    expect(workbench.sections.overdue.title).toBe('逾期待处理')
    expect(workbench.sections.breeding.dotColor).toBe('var(--amber)')
    expect(WORKBENCH_SECTION_META.therapy.title).toBe('今日用药')
  })

  it('逾期卡优先进入逾期区而不是业务区', () => {
    const workbench = buildHomeWorkbench([
      makeOverdueCard('overdue-breeding', 'breeding'),
      makeOverdueCard('overdue-health', 'health'),
      makeOverdueCard('overdue-medication', 'medication'),
    ])

    expect(workbench.sections.overdue.count).toBe(3)
    expect(workbench.sections.breeding.count).toBe(0)
    expect(workbench.sections.reminders.count).toBe(0)
    expect(workbench.sections.therapy.count).toBe(0)
  })

  it('按繁育步骤分组并保留单任务行', () => {
    const workbench = buildHomeWorkbench([
      makeBreedingMilestoneCard('follicle-a', 'follicle_check'),
      makeBreedingMilestoneCard('follicle-b', 'follicle_check'),
      makeBreedingMilestoneCard('mating-a', 'mating', '花花 · 配种'),
      makeBreedingMilestoneCard('unknown-a', 'custom_step', '自定义繁育'),
    ])
    const groups = workbench.sections.breeding.groups
    const follicleGroup = groups.find(group => group.key === 'breeding-step:follicle_check')
    const matingGroup = groups.find(group => group.key === 'breeding-step:mating')
    const unknownGroup = groups.find(group => group.key === 'breeding-step:custom_step')

    expect(follicleGroup?.title).toBe('建议卵泡检查')
    expect(follicleGroup?.rows).toHaveLength(2)
    expect(follicleGroup?.rows[0].taskId).toBe('follicle-a-task')
    expect(follicleGroup?.rows[0].sourceCard.id).toBe('follicle-a')
    expect(matingGroup?.title).toBe('配种')
    expect(unknownGroup?.title).toBe('自定义繁育')
  })

  it('繁育额外安排单独成组', () => {
    const workbench = buildHomeWorkbench([
      makeBreedingMilestoneCard('pregnancy-a', 'pregnancy_check'),
      makeBreedingExtraCard('extra-a', 'recheck'),
    ])

    expect(workbench.sections.breeding.groups.map(group => group.key)).toEqual([
      'breeding-step:pregnancy_check',
      'breeding-extra:recheck',
    ])
    expect(workbench.sections.breeding.groups[0].title).toBe('建议孕检')
    expect(workbench.sections.breeding.groups[1].kind).toBe('breeding-extra')
  })

  it('保留健康批量卡原始任务犬只和进度并区分子类型', () => {
    const vaccine = makeHealthBatchCard('vaccine-batch', 'vaccination')
    const deworming = makeHealthBatchCard('deworming-batch', 'deworming')
    const workbench = buildHomeWorkbench([vaccine, deworming])

    const vaccineGroup = workbench.sections.reminders.groups.find(group => group.key === 'health-batch:vaccination:六联')
    const dewormingGroup = workbench.sections.reminders.groups.find(group => group.key === 'health-batch:deworming:internal:海乐妙')

    expect(vaccineGroup?.rows[0].kind).toBe('card')
    expect(vaccineGroup?.rows[0].sourceCard.tasks).toBe(vaccine.tasks)
    expect(vaccineGroup?.rows[0].sourceCard.dogs).toBe(vaccine.dogs)
    expect(vaccineGroup?.rows[0].sourceCard.progress).toBe(vaccine.progress)
    expect(dewormingGroup?.count).toBe(1)
  })

  it('健康单犬提醒按子类型分组', () => {
    const workbench = buildHomeWorkbench([
      makeHealthSingleCard('single-vaccine', 'vaccination'),
      makeHealthSingleCard('single-deworming', 'deworming'),
    ])

    expect(workbench.sections.reminders.groups.map(group => group.key)).toEqual([
      'health-single:vaccination:狂犬',
      'health-single:deworming:external:福来恩',
    ])
  })

  it('用药犬只行按 medication-state:pending、partial、done 排序', () => {
    const workbench = buildHomeWorkbench([makeMedicationCard()])

    expect(workbench.sections.therapy.groups.map(group => group.key)).toEqual([
      'medication-state:pending',
      'medication-state:partial',
      'medication-state:done',
    ])
    expect(workbench.sections.therapy.rows.map(row => row.medicationState)).toEqual(['pending', 'partial', 'done'])
  })

  it('保留所有行并用 visibleRows 和 hiddenCount 表示折叠', () => {
    const workbench = buildHomeWorkbench([
      makeBreedingMilestoneCard('follicle-a', 'follicle_check'),
      makeBreedingMilestoneCard('follicle-b', 'follicle_check'),
      makeBreedingMilestoneCard('follicle-c', 'follicle_check'),
    ], { visibleRowLimit: 2 })
    const group = workbench.sections.breeding.groups.find(item => item.key === 'breeding-step:follicle_check')

    expect(group?.rows).toHaveLength(3)
    expect(group?.visibleRows).toHaveLength(2)
    expect(group?.hiddenCount).toBe(1)
    expect(workbench.sections.breeding.count).toBe(3)
    expect(workbench.sections.breeding.visibleRows).toHaveLength(2)
    expect(workbench.sections.breeding.hiddenCount).toBe(1)
    expect(workbench.totalCount).toBe(3)
  })

  it('不修改输入 cards', () => {
    const cards = [
      makeBreedingMilestoneCard('weaning-a', 'weaning_confirm'),
      makeHealthBatchCard('deworming-batch', 'deworming'),
      makeMedicationCard(),
    ]
    const before = JSON.stringify(cards)

    buildHomeWorkbench(cards, { visibleRowLimit: 2 })

    expect(JSON.stringify(cards)).toBe(before)
  })

  it('不引入首页副作用边界依赖', () => {
    const adapterSource = readFileSync(resolve(testDir, '../../src/utils/homeWorkbench.ts'), 'utf8')
    const forbiddenStrings = [
      'uniCloud',
      'useCloudCall',
      "from 'vue'",
      "from 'pinia'",
      'navigateTo',
      'showToast',
      'suppressedTaskMap',
      'dayCounts',
      'latestLoadToken',
      'weekCache',
    ]

    for (const forbidden of forbiddenStrings) {
      expect(adapterSource).not.toContain(forbidden)
    }
  })
})
