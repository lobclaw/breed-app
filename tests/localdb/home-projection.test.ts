import { describe, expect, it } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { applyTouchedEntityVersions, buildLocalDateCounts, buildLocalHomeCards } from '../../src/localdb/home-projection'
import { buildHomeSnapshot, clearHomeEntitiesCache, materializeBreedingMilestonesForFamily } from '../../src/localdb/runtime/home-snapshot'

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

  it('按当前家庭过滤首页投影，避免切账号后混入其他家庭事项', () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const dueDate = new Date('2026-04-24T09:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [
        { _id: 'dog_1', family_id: 'family_1', name: '花花' },
        { _id: 'dog_2', family_id: 'family_2', name: '奶糖' },
      ],
      tasks: [
        {
          _id: 'task_fam_1',
          family_id: 'family_1',
          dog_id: 'dog_1',
          dog_name: '花花',
          type: 'vaccination',
          title: '疫苗',
          status: 'pending',
          due_date: dueDate,
          details: { vaccine_type: '卫佳10' },
        },
        {
          _id: 'task_fam_2',
          family_id: 'family_2',
          dog_id: 'dog_2',
          dog_name: '奶糖',
          type: 'deworming',
          title: '驱虫',
          status: 'pending',
          due_date: dueDate,
          details: { drug_name: '博来恩' },
        },
      ],
      health_records: [],
      medication_tasks: [],
    }, now, 'family_2')

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].tasks?.[0]?._id).toBe('task_fam_2')
    expect(result.cards[0].dogName || result.cards[0].dogs?.[0]?.dogName).toContain('奶糖')
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

  it('应从已物化的 tasks 读取本地待同步繁育里程碑', () => {
    const now = new Date('2026-04-30T15:00:00+08:00').getTime()
    const heatDate = new Date('2026-04-30T10:00:00+08:00').getTime()

    const result = buildLocalHomeCards({
      dogs: [{ _id: 'dog_1', name: '奶糖' }],
      tasks: [{
        _id: 'task_1',
        card_type: 'individual',
        dog_id: 'dog_1',
        dog_name: '奶糖',
        cycle_id: 'cycle_1',
        type: 'breeding_milestone',
        title: '奶糖 · 建议卵泡检查',
        due_date: heatDate,
        status: 'pending',
        family_id: 'family_1',
        source_record_id: 'record_1',
        source_collection: 'breeding_records',
        details: { step_type: 'follicle_check' },
        created_at: now,
        updated_at: now,
        _local_pending: true,
      }],
      health_records: [],
      medication_tasks: [],
    }, now)

    const breedingCard = result.cards.find(card => card.cardType === 'dog' && card.tasks?.[0]?.type === 'breeding_milestone')
    expect(breedingCard).toBeTruthy()
    expect(breedingCard?.tasks?.[0]?.details?.step_type).toBe('follicle_check')
    expect(result.counts.today).toBeGreaterThan(0)
  })

  it('繁育 milestone 物化应只新增缺失任务且重复执行不重复创建', async () => {
    const familyId = 'family_materialize_milestone'
    const now = new Date('2026-05-15T10:00:00+08:00').getTime()
    const heatDate = new Date('2026-05-10T10:00:00+08:00').getTime()

    await Promise.all([
      localDb.replaceTable('tasks', []),
      localDb.replaceTable('breeding_cycles', [{
        _id: 'cycle_materialize_1',
        family_id: familyId,
        dam_id: 'dog_materialize_1',
        dam_name: '奶糖',
        status: '发情中',
        start_date: heatDate,
        created_at: heatDate,
        updated_at: now,
      }]),
      localDb.replaceTable('breeding_records', [{
        _id: 'record_materialize_heat',
        family_id: familyId,
        cycle_id: 'cycle_materialize_1',
        dog_id: 'dog_materialize_1',
        dog_name: '奶糖',
        type: 'heat',
        date: heatDate,
        details: {},
        created_at: heatDate,
        updated_at: now,
      }]),
    ])

    const first = await materializeBreedingMilestonesForFamily(familyId)
    const second = await materializeBreedingMilestonesForFamily(familyId)
    const tasks = await localDb.getRowsByFamilyReadonly('tasks', familyId)

    expect(first).toHaveLength(1)
    expect(first[0]._id).toBe('synthetic_breeding_milestone:cycle_materialize_1:follicle_check')
    expect(first[0]._local_pending).toBe(true)
    expect(first[0].version).toBe(0)
    expect(second).toEqual([])
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      _id: 'synthetic_breeding_milestone:cycle_materialize_1:follicle_check',
      family_id: familyId,
      type: 'breeding_milestone',
      status: 'pending',
      cycle_id: 'cycle_materialize_1',
    })
  })

  it('首页 projection 不再扫描 breeding_cycles / breeding_records 合成繁育卡片', () => {
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
    expect(breedingCard).toBeFalsy()
  })

  it('首页 projection 不应污染输入任务行', () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const task = {
      _id: 'task_readonly_input',
      family_id: 'family_1',
      type: 'manual',
      status: 'pending',
      title: '检查',
      due_date: now,
      created_at: now,
      updated_at: now,
    }

    buildLocalHomeCards({
      dogs: [],
      tasks: [task],
      health_records: [],
      medication_tasks: [],
    }, now, 'family_1')

    expect(task).not.toHaveProperty('priority')
    expect(task).not.toHaveProperty('_completed')
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

  it('collection revision 未变化时应复用首页投影，相关集合变化后应失效', async () => {
    const familyId = 'family_home_memo'
    const otherFamilyId = 'family_home_memo_other'
    const now = new Date('2026-05-15T10:00:00+08:00').getTime()
    const tomorrow = new Date('2026-05-16T10:00:00+08:00').getTime()
    const nextWeek = new Date('2026-05-22T10:00:00+08:00').getTime()

    await Promise.all([
      localDb.replaceTable('dogs', []),
      localDb.replaceTable('tasks', []),
      localDb.replaceTable('health_records', []),
      localDb.replaceTable('medication_tasks', []),
    ])
    clearHomeEntitiesCache()

    await localDb.upsertRows('dogs', [
      { _id: 'dog_home_memo_1', family_id: familyId, name: '小满', updated_at: now },
      { _id: 'dog_home_memo_2', family_id: otherFamilyId, name: '奶糕', updated_at: now },
    ])
    await localDb.upsertRows('tasks', [
      {
        _id: 'task_home_memo_1',
        family_id: familyId,
        dog_id: 'dog_home_memo_1',
        dog_name: '小满',
        type: 'vaccination',
        title: '疫苗',
        status: 'pending',
        due_date: now,
        updated_at: now,
      },
      {
        _id: 'task_home_memo_other',
        family_id: otherFamilyId,
        dog_id: 'dog_home_memo_2',
        dog_name: '奶糕',
        type: 'deworming',
        title: '驱虫',
        status: 'pending',
        due_date: now,
        updated_at: now,
      },
    ])

    const input = {
      familyId,
      dateCountsStartDate: now,
      dateCountsEndDate: nextWeek,
      weekStartDate: now,
      weekEndDate: nextWeek,
      now,
    }
    const first = await buildHomeSnapshot(input)
    const second = await buildHomeSnapshot(input)

    expect(second.home).toBe(first.home)
    expect(second.dateCounts).toBe(first.dateCounts)
    expect(second.weekCards).toBe(first.weekCards)
    expect(first.home.cards.some(card => card.tasks?.some(task => task._id === 'task_home_memo_other'))).toBe(false)

    clearHomeEntitiesCache()
    const afterManualRefresh = await buildHomeSnapshot(input)
    expect(afterManualRefresh.home).not.toBe(first.home)
    expect(afterManualRefresh.dateCounts).not.toBe(first.dateCounts)
    expect(afterManualRefresh.weekCards).not.toBe(first.weekCards)

    const other = await buildHomeSnapshot({ ...input, familyId: otherFamilyId })
    expect(other.home).not.toBe(afterManualRefresh.home)
    expect(other.home.cards.some(card => card.tasks?.some(task => task._id === 'task_home_memo_other'))).toBe(true)

    const crossDay = await buildHomeSnapshot({ ...input, now: tomorrow })
    expect(crossDay.home).not.toBe(afterManualRefresh.home)
    expect(crossDay.weekCards).not.toBe(afterManualRefresh.weekCards)

    const anonymousFirst = await buildHomeSnapshot({ ...input, familyId: '' })
    const anonymousSecond = await buildHomeSnapshot({ ...input, familyId: '' })
    expect(anonymousSecond.home).not.toBe(anonymousFirst.home)
    expect(anonymousSecond.dateCounts).not.toBe(anonymousFirst.dateCounts)
    expect(anonymousSecond.weekCards).not.toBe(anonymousFirst.weekCards)

    await localDb.upsertRows('tasks', [{
      _id: 'task_home_memo_2',
      family_id: familyId,
      dog_id: 'dog_home_memo_1',
      dog_name: '小满',
      type: 'deworming',
      title: '驱虫',
      status: 'pending',
      due_date: now,
      updated_at: now + 1,
    }])

    const afterTaskChange = await buildHomeSnapshot(input)
    expect(afterTaskChange.home).not.toBe(afterManualRefresh.home)
    expect(afterTaskChange.dateCounts).not.toBe(afterManualRefresh.dateCounts)
    expect(afterTaskChange.weekCards).not.toBe(afterManualRefresh.weekCards)
  })
})
