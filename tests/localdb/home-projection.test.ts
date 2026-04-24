import { describe, expect, it } from 'vitest'
import { buildLocalDateCounts, buildLocalHomeCards } from '../../src/localdb/home-projection'

describe('local home projection', () => {
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
})

