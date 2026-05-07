import { describe, expect, it } from 'vitest'
import { applyTouchedEntityVersions, buildLocalDateCounts, buildLocalHomeCards } from '../../src/localdb/home-projection'

describe('local home projection', () => {
  it('应将单只犬的疫苗和驱虫提醒也投影为健康批量卡', () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const dueDate = new Date('2026-04-24T09:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [{ _id: 'dog_1', name: '妮蔻' }],
      tasks: [
        {
          _id: 'task_vac_1',
          family_id: 'family_1',
          dog_id: 'dog_1',
          dog_name: '妮蔻',
          type: 'vaccination',
          title: '疫苗',
          status: 'pending',
          due_date: dueDate,
          details: { vaccine_type: '卫佳10' },
        },
        {
          _id: 'task_dew_1',
          family_id: 'family_1',
          dog_id: 'dog_1',
          dog_name: '妮蔻',
          type: 'deworming',
          title: '驱虫',
          status: 'pending',
          due_date: dueDate,
          details: { deworming_type: 'external', drug_name: '博来恩' },
        },
      ],
      health_records: [],
      medication_tasks: [],
    }, now)

    const healthCards = result.cards.filter(card => card.domain === 'health')

    expect(healthCards).toHaveLength(2)
    expect(healthCards.every(card => card.cardType === 'batch')).toBe(true)
    expect(healthCards.map(card => card.tasks?.[0]?.type)).toEqual(['vaccination', 'deworming'])
    expect(healthCards.every(card => card.dogs?.length === 1)).toBe(true)
    expect(result.cards.some(card => card.cardType === 'dog' && card.domain === 'health')).toBe(false)
  })

  it('应从本地实体投影出今日用药与疾病观察卡', () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const startDate = new Date('2026-04-23T09:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [{ _id: 'dog_1', name: '花花' }],
      tasks: [],
      health_records: [{
        _id: 'ill_1',
        type: 'illness',
        dog_id: 'dog_1',
        family_id: 'family_1',
        date: now - 86400000,
        details: {
          primary_condition: '感冒',
          condition: '感冒',
          treatment_status: '观察中',
          symptom_tags: ['咳嗽'],
        },
      }],
      medication_tasks: [{
        _id: 'med_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: 'family_1',
        source_record_id: null,
        drug_name: '头孢',
        frequency: 2,
        duration_days: 3,
        actual_start_date: startDate,
        status: '进行中',
        daily_doses: { 2: 1 },
      }],
    }, now)

    expect(result.cards.some(card => card.cardType === 'medication')).toBe(true)
    expect(result.cards.some(card => card.cardType === 'sick_observation')).toBe(true)
    expect(result.counts.today).toBeGreaterThan(0)
  })

  it('应按本地实体对重复繁育里程碑去重并给未来用药天数打点', () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const targetDay = new Date('2026-04-26T10:00:00+08:00').getTime()

    const counts = buildLocalDateCounts({
      dogs: [],
      tasks: [
        {
          _id: 'flow_old',
          family_id: 'family_1',
          type: 'breeding_milestone',
          cycle_id: 'cycle_1',
          status: 'pending',
          due_date: targetDay,
          updated_at: now - 1000,
        },
        {
          _id: 'flow_new',
          family_id: 'family_1',
          type: 'breeding_milestone',
          cycle_id: 'cycle_1',
          status: 'pending',
          due_date: targetDay,
          updated_at: now,
        },
      ],
      health_records: [],
      medication_tasks: [{
        _id: 'med_future',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: 'family_1',
        drug_name: '益生菌',
        frequency: 1,
        duration_days: 5,
        actual_start_date: new Date('2026-04-24T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: {},
      }],
    }, now, targetDay)

    expect(counts).toBeTruthy()
    expect(Object.values(counts).some(value => value === 1)).toBe(true)
  })

  it('应为本地待同步的发情记录即时投影首页繁育卡片', () => {
    const now = new Date('2026-04-30T15:00:00+08:00').getTime()
    const heatDate = new Date('2026-04-30T10:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [{ _id: 'dog_1', name: '奶糖' }],
      tasks: [],
      health_records: [],
      medication_tasks: [],
      breeding_cycles: [{
        _id: 'cycle_1',
        family_id: 'family_1',
        dam_id: 'dog_1',
        dam_name: '奶糖',
        status: '发情中',
        created_at: now,
        updated_at: now,
        _local_pending: true,
      }],
      breeding_records: [{
        _id: 'record_1',
        family_id: 'family_1',
        cycle_id: 'cycle_1',
        dog_id: 'dog_1',
        dog_name: '奶糖',
        type: 'heat',
        date: heatDate,
        details: {},
        created_at: now,
        updated_at: now,
        _local_pending: true,
      }],
    }, now)

    const breedingCard = result.cards.find(card => card.cardType === 'dog' && card.tasks?.[0]?.type === 'breeding_milestone')
    expect(breedingCard).toBeTruthy()
    expect(breedingCard?.tasks?.[0]?.details?.step_type).toBe('follicle_check')
    expect(result.counts.today).toBeGreaterThan(0)
  })

  it('应为缺少里程碑任务的已同步发情周期补首页繁育卡片', () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const heatDate = new Date('2026-05-01T10:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [{ _id: 'dog_1', name: '肉肉' }],
      tasks: [],
      health_records: [],
      medication_tasks: [],
      breeding_cycles: [{
        _id: 'cycle_1',
        family_id: 'family_1',
        dam_id: 'dog_1',
        dam_name: '肉肉',
        status: '发情中',
        start_date: heatDate,
        created_at: heatDate,
        updated_at: now,
      }],
      breeding_records: [{
        _id: 'record_1',
        family_id: 'family_1',
        cycle_id: 'cycle_1',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        type: 'heat',
        date: heatDate,
        details: {},
        created_at: heatDate,
        updated_at: now,
      }],
    }, now)

    const breedingCard = result.cards.find(card => card.cardType === 'dog' && card.tasks?.[0]?.type === 'breeding_milestone')
    expect(breedingCard).toBeTruthy()
    expect(breedingCard?.tasks?.[0]?.details?.step_type).toBe('follicle_check')
    expect(breedingCard?.tasks?.[0]?.dog_name).toBe('肉肉')
  })

  it('应在同步确认后清除本地 pending 标记', () => {
    const rows = applyTouchedEntityVersions(
      [{
        _id: 'record_1',
        version: 0,
        updated_at: 1,
        _local_pending: true,
      }],
      [{
        collection: 'breeding_records',
        id: 'record_1',
        version: 2,
        updatedAt: 100,
      }],
      'breeding_records',
    )

    expect(rows[0].version).toBe(2)
    expect(rows[0]._local_pending).toBe(false)
  })
})
