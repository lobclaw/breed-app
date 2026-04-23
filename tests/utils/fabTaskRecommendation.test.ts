import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import type { HomeCard, HomeTask } from '@/types/home-workbench'
import { buildFabTaskRecommendation } from '@/utils/fabTaskRecommendation'
import { useTaskStore } from '@/stores/taskStore'

const NOW = Date.parse('2026-04-23T04:00:00.000Z')
const DAY_MS = 86400000

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

describe('fabTaskRecommendation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
    })
  })

  it('繁育 milestone 应展示犬名、主动作和锁定录入 URL', () => {
    const card: HomeCard = {
      id: 'breed-card',
      cardType: 'dog',
      domain: 'breeding',
      sectionType: 'workflow',
      priority: 'today',
      dogId: 'dog-1',
      dogName: '4号',
      tasks: [
        makeTask({
          type: 'breeding_milestone',
          title: '4号 · 建议卵泡检查',
          cycle_id: 'cycle-1',
          details: {
            step_type: 'follicle_check',
            heat_date: NOW - 2 * DAY_MS,
            follicle_check_count: 1,
            follicle_result: '发育中',
            latest_follicle_check_date: NOW - DAY_MS,
          },
        }),
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      kind: 'task',
      category: 'suggestion',
      title: '4号 · 建议卵泡检查',
      subtitle: '发情第 3 天',
      tag: '建议',
      tagColor: 'amber',
      url: '/pages/record/breeding-follicle?dogId=dog-1&dogName=4%E5%8F%B7&taskId=task-1&cycleId=cycle-1&locked=true',
    })
    expect(rec?.context).toBe('')
  })

  it('单犬健康待办应展示具体项目而不是只显示犬名', () => {
    const card: HomeCard = {
      id: 'health-card',
      cardType: 'dog',
      domain: 'health',
      sectionType: 'reminders',
      priority: 'today',
      dogId: 'dog-2',
      dogName: '奶糖',
      tasks: [
        makeTask({
          type: 'vaccination',
          title: '疫苗',
          display_title: '疫苗 · 六联',
          details: { vaccine_type: '六联' },
        }),
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      category: 'todo',
      title: '奶糖 · 疫苗记录',
      subtitle: '疫苗 · 六联',
      context: '',
      tagColor: 'blue',
    })
  })

  it('批量卡应展示待处理数量并保持两行信息', () => {
    const card: HomeCard = {
      id: 'batch-card',
      cardType: 'batch',
      domain: 'health',
      sectionType: 'reminders',
      priority: 'today',
      dogs: [
        { dogId: 'dog-a', dogName: '泡泡' },
        { dogId: 'dog-b', dogName: '豆豆' },
        { dogId: 'dog-c', dogName: '团子' },
      ],
      tasks: [
        makeTask({
          type: 'vaccination',
          title: '疫苗',
          display_title: '疫苗 · 六联',
          details: { vaccine_type: '六联' },
        }),
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      category: 'todo',
      title: '批量处理 · 疫苗 · 六联',
      subtitle: '3只待处理',
      context: '',
    })
  })

  it('今日用药聚合卡应归入待办并生成整卡摘要', () => {
    const card: HomeCard = {
      id: 'med-card',
      cardType: 'medication',
      domain: 'medication',
      sectionType: 'therapy',
      priority: 'today',
      groupTitle: '今日用药',
      dogs: [
        {
          dogId: 'dog-a',
          dogName: '泡泡',
          illnessNames: '肠胃炎',
          drugName: '益生菌',
          completed: false,
        },
        {
          dogId: 'dog-b',
          dogName: '豆豆',
          illnessNames: '皮肤炎',
          drugName: '软膏',
          completed: false,
        },
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      category: 'todo',
      title: '今日用药 · 2只犬',
      subtitle: '2只待用药',
      context: '',
      homeFocusTarget: 'medication',
      tagColor: 'plum',
      url: '/pages/home/index',
    })
  })

  it('单只今日用药才展示疾病和药名', () => {
    const card: HomeCard = {
      id: 'med-card-single',
      cardType: 'medication',
      domain: 'medication',
      sectionType: 'therapy',
      priority: 'today',
      groupTitle: '今日用药',
      dogs: [
        {
          dogId: 'dog-a',
          dogName: '泡泡',
          illnessNames: '肠胃炎',
          drugName: '益生菌',
          completed: false,
        },
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      title: '今日用药 · 1只犬',
      subtitle: '肠胃炎 · 益生菌',
    })
  })

  it('疾病观察聚合卡应归入待办并生成整卡摘要', () => {
    const card: HomeCard = {
      id: 'sick-card',
      cardType: 'sick_observation',
      domain: 'health',
      sectionType: 'reminders',
      priority: 'today',
      groupTitle: '疾病观察',
      dogs: [
        {
          dogId: 'dog-a',
          dogName: '泡泡',
          illness: '咳嗽',
          treatmentStatus: '观察中',
        },
        {
          dogId: 'dog-b',
          dogName: '豆豆',
          illness: '软便',
          treatmentStatus: '观察中',
        },
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      category: 'todo',
      title: '疾病观察 · 2项',
      subtitle: '咳嗽 · 观察中',
      context: '',
      homeFocusTarget: 'sick_observation',
      tagColor: 'blue',
      url: '/pages/home/index',
    })
  })

  it('逾期待办应显示逾期态文案与红色标签', () => {
    const card: HomeCard = {
      id: 'overdue-card',
      cardType: 'dog',
      domain: 'health',
      sectionType: 'reminders',
      priority: 'overdue',
      overdueDays: 3,
      dogId: 'dog-3',
      dogName: '可乐',
      tasks: [
        makeTask({
          type: 'illness',
          title: '皮肤炎',
          details: { condition: '皮肤炎' },
        }),
      ],
    }

    const rec = buildFabTaskRecommendation(card, NOW)

    expect(rec).toMatchObject({
      category: 'todo',
      title: '可乐 · 疾病记录',
      subtitle: '皮肤炎',
      context: '',
      tag: '逾期',
      tagColor: 'red',
    })
  })

  it('同时存在待办与繁育 milestone 时应输出待办 → 建议 → 常用', () => {
    const store = useTaskStore()
    store.cards = [
      {
        id: 'health-card',
        cardType: 'dog',
        domain: 'health',
        sectionType: 'reminders',
        priority: 'today',
        dogId: 'dog-2',
        dogName: '奶糖',
        tasks: [
          makeTask({
            type: 'vaccination',
            title: '疫苗',
            display_title: '疫苗 · 六联',
            details: { vaccine_type: '六联' },
          }),
        ],
      },
      {
        id: 'breed-card',
        cardType: 'dog',
        domain: 'breeding',
        sectionType: 'workflow',
        priority: 'today',
        dogId: 'dog-1',
        dogName: '4号',
        tasks: [
          makeTask({
            _id: 'breed-task',
            type: 'breeding_milestone',
            title: '4号 · 建议卵泡检查',
            cycle_id: 'cycle-1',
            details: {
              step_type: 'follicle_check',
              heat_date: NOW - 2 * DAY_MS,
              follicle_check_count: 1,
              follicle_result: '发育中',
              latest_follicle_check_date: NOW - DAY_MS,
            },
          }),
        ],
      },
    ] as any
    ;(store as any).getRecentActions = () => ['deworming']

    const recs = store.buildSmartRecommendations()

    expect(recs).toHaveLength(3)
    expect(recs[0]).toMatchObject({ category: 'todo', title: '奶糖 · 疫苗记录' })
    expect(recs[1]).toMatchObject({ category: 'suggestion', title: '4号 · 建议卵泡检查', tag: '建议' })
    expect(recs[2]).toMatchObject({ category: 'common', label: '驱虫记录', sub: '最近常用' })
  })

  it('只有繁育 milestone 时应由建议顶到首位', () => {
    const store = useTaskStore()
    store.cards = [{
      id: 'breed-card',
      cardType: 'dog',
      domain: 'breeding',
      sectionType: 'workflow',
      priority: 'today',
      dogId: 'dog-1',
      dogName: '4号',
      tasks: [
        makeTask({
          _id: 'breed-task',
          type: 'breeding_milestone',
          title: '4号 · 建议卵泡检查',
          cycle_id: 'cycle-1',
          details: {
            step_type: 'follicle_check',
            heat_date: NOW - 2 * DAY_MS,
          },
        }),
      ],
    }] as any
    ;(store as any).getRecentActions = () => ['deworming']

    const recs = store.buildSmartRecommendations()

    expect(recs[0]).toMatchObject({ category: 'suggestion', title: '4号 · 建议卵泡检查' })
    expect(recs[1]).toMatchObject({ category: 'common', label: '驱虫记录' })
  })

  it('存在今日用药与繁育 milestone 时应保留今日用药在待办位', () => {
    const store = useTaskStore()
    store.cards = [
      {
        id: 'breed-card',
        cardType: 'dog',
        domain: 'breeding',
        sectionType: 'workflow',
        priority: 'today',
        dogId: 'dog-1',
        dogName: '4号',
        tasks: [
          makeTask({
            _id: 'breed-task',
            type: 'breeding_milestone',
            title: '4号 · 建议卵泡检查',
            cycle_id: 'cycle-1',
            details: {
              step_type: 'follicle_check',
              heat_date: NOW - 2 * DAY_MS,
            },
          }),
        ],
      },
      {
        id: 'med-card',
        cardType: 'medication',
        domain: 'medication',
        sectionType: 'therapy',
        priority: 'today',
        dogs: [
          { dogId: 'dog-a', dogName: '泡泡', illnessNames: '肠胃炎', drugName: '益生菌', completed: false },
        ],
      },
    ] as any
    ;(store as any).getRecentActions = () => []

    const recs = store.buildSmartRecommendations()

    expect(recs[0]).toMatchObject({ category: 'todo', title: '今日用药 · 1只犬' })
    expect(recs[1]).toMatchObject({ category: 'suggestion', title: '4号 · 建议卵泡检查' })
  })

  it('breeding_extra_arrangement 仍归入待办而不是建议', () => {
    const store = useTaskStore()
    store.cards = [{
      id: 'extra-card',
      cardType: 'dog',
      domain: 'breeding',
      sectionType: 'workflow_extra',
      priority: 'today',
      dogId: 'dog-1',
      dogName: '4号',
      tasks: [
        makeTask({
          _id: 'extra-task',
          type: 'breeding_extra_arrangement',
          title: '联系医生',
          cycle_id: 'cycle-1',
          details: {
            kind: 'contact_doctor',
          },
        }),
      ],
    }] as any
    ;(store as any).getRecentActions = () => []

    const recs = store.buildSmartRecommendations()

    expect(recs[0]).toMatchObject({
      category: 'todo',
      title: '4号 · 联系医生',
      tag: '待办',
    })
  })

  it('recent 与 fallback 补位仍应与待办/建议 URL 去重', () => {
    const store = useTaskStore()
    store.cards = [{
      id: 'health-card',
      cardType: 'dog',
      domain: 'health',
      sectionType: 'reminders',
      priority: 'today',
      dogId: 'dog-2',
      dogName: '奶糖',
      tasks: [
        makeTask({
          type: 'vaccination',
          title: '疫苗',
          display_title: '疫苗 · 六联',
          details: { vaccine_type: '六联' },
        }),
      ],
    }] as any
    ;(store as any).getRecentActions = () => ['vaccination']

    const recs = store.buildSmartRecommendations()

    expect(recs).toHaveLength(3)
    expect(recs[0]).toMatchObject({ category: 'todo', title: '奶糖 · 疫苗记录' })
    expect(recs[1]).toMatchObject({ category: 'common', label: '支出录入', sub: '开始记账' })
    expect(recs[2]).toMatchObject({ category: 'common', label: '收入录入', sub: '记录收入' })
  })
})
