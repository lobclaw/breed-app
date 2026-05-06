import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { localSyncRuntime } from '../../src/localdb/runtime'
import {
  findLocalDuplicateIllnesses,
  findLocalDuplicateMedicationTasks,
  getLocalBreedingCycleDetail,
  getLocalDogDetail,
  getLocalDogFinanceSummary,
  getLocalExpenseDetail,
  getLocalFinancialSummary,
  getLocalIncomeDetail,
  getLocalKennelDashboardStats,
  getLocalLitterProfit,
  getLocalProjectionParams,
  getLocalSaleDetail,
  getLocalTaskById,
  getLocalTransactionList,
  getLocalDamRoi,
  listLocalBreedingCycles,
  listLocalDogHealthHistory,
  listLocalDogMedicationHistory,
  listLocalDogWeights,
  listLocalDogsWithStatus,
  listLocalLittersByDam,
  listLocalLitters,
  listLocalMedicationProtocols,
  listLocalTasksByIds,
} from '../../src/localdb/domain-repository'

describe('local domain repository', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('应从本地集合投影出犬只状态', async () => {
    const now = Date.now()
    await localDb.replaceTable('dogs', [{
      _id: 'dog_1',
      family_id: 'fam_1',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_1',
      family_id: 'fam_1',
      dam_id: 'dog_1',
      status: '怀孕中',
      mated_at: now - (20 * 86400000),
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_1',
      family_id: 'fam_1',
      dog_id: 'dog_1',
      type: 'illness',
      date: now - 86400000,
      updated_at: now,
      details: {
        treatment_status: '观察中',
        primary_condition: '肠胃炎',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_1',
      family_id: 'fam_1',
      dog_id: 'dog_1',
      status: '进行中',
      drug_name: '益生菌',
      duration_days: 5,
      actual_start_date: now - 86400000,
      updated_at: now,
    }])
    await localDb.replaceTable('litters', [])

    const dogs = await listLocalDogsWithStatus('fam_1')
    expect(dogs).toHaveLength(1)
    expect(dogs[0].statuses.map(status => status.type)).toEqual(['生病中', '用药中', '怀孕中'])
  })

  it('犬只详情应逐条展示多个未康复疾病，列表仍保留摘要', async () => {
    const now = Date.now()
    await localDb.replaceTable('dogs', [{
      _id: 'dog_multi_illness_1',
      family_id: 'fam_multi_illness',
      name: '肉肉',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('litters', [])
    await localDb.replaceTable('health_records', [
      {
        _id: 'ill_multi_cold',
        family_id: 'fam_multi_illness',
        dog_id: 'dog_multi_illness_1',
        type: 'illness',
        date: now - 3 * 86400000,
        updated_at: now - 3000,
        details: {
          treatment_status: '治疗中',
          primary_condition: '感冒',
          symptom_tags: ['食欲差', '呕吐', '精神差'],
        },
      },
      {
        _id: 'ill_multi_diarrhea',
        family_id: 'fam_multi_illness',
        dog_id: 'dog_multi_illness_1',
        type: 'illness',
        date: now - 2 * 86400000,
        updated_at: now - 2000,
        details: {
          treatment_status: '治疗中',
          primary_condition: '腹泻',
        },
      },
      {
        _id: 'ill_multi_skin',
        family_id: 'fam_multi_illness',
        dog_id: 'dog_multi_illness_1',
        type: 'illness',
        date: now - 86400000,
        updated_at: now - 1000,
        details: {
          treatment_status: '观察中',
          primary_condition: '皮肤病',
        },
      },
    ])

    const dogs = await listLocalDogsWithStatus('fam_multi_illness')
    const listIllnessStatuses = dogs[0].statuses.filter(status => status.type === '生病中')
    expect(listIllnessStatuses).toHaveLength(1)
    expect(listIllnessStatuses[0]).toMatchObject({
      label: '皮肤病/腹泻等3项',
      count: 3,
    })
    expect(listIllnessStatuses[0].meta?.some(item => item.icon === 'schedule')).toBe(false)

    const detail = await getLocalDogDetail('fam_multi_illness', 'dog_multi_illness_1')
    const detailIllnessStatuses = detail?.statuses.filter(status => status.type === '生病中') || []
    expect(detailIllnessStatuses).toHaveLength(3)
    expect(detailIllnessStatuses.map(status => status.recordId)).toEqual([
      'ill_multi_skin',
      'ill_multi_diarrhea',
      'ill_multi_cold',
    ])
    expect(detailIllnessStatuses.map(status => status.label)).toEqual(['皮肤病', '腹泻', '感冒'])
    expect(detailIllnessStatuses[2].detail).toBe('食欲差 / 呕吐 等3项')
  })

  it('录入带费用的卵泡检查后应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const heatDate = now - 5 * 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dam_finance_1',
      family_id: 'fam_finance_1',
      name: '肉肉',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_finance_1',
      family_id: 'fam_finance_1',
      dam_id: 'dam_finance_1',
      dam_name: '肉肉',
      status: '发情中',
      created_at: heatDate,
      updated_at: now,
      version: 2,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'record_heat_finance_1',
      family_id: 'fam_finance_1',
      cycle_id: 'cycle_finance_1',
      dog_id: 'dam_finance_1',
      dog_name: '肉肉',
      type: 'heat',
      date: heatDate,
      details: {},
      created_at: heatDate,
      updated_at: heatDate,
    }])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const res = await localSyncRuntime.addBreedingRecordLocally('fam_finance_1', {
      type: 'follicle_check',
      dog_id: 'dam_finance_1',
      cycle_id: 'cycle_finance_1',
      date: now,
      cost: 188,
      notes: 'B超',
      details: {
        left_count: 2,
        right_count: 1,
        result: '发育中',
      },
    })

    const txList = await getLocalTransactionList('fam_finance_1', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(res.data.recordId).toBeTruthy()
    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category: '检查化验',
      total_amount: 188,
      notes: '卵泡检查 · B超',
      linked_cycle_id: 'cycle_finance_1',
    })
  })

  it('录入卵泡检查后首页应立即基于本地记录刷新繁育节点', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const heatDate = now - 6 * 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dam_home_follicle_1',
      family_id: 'fam_home_follicle',
      name: '妮蔻',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_home_follicle_1',
      family_id: 'fam_home_follicle',
      dam_id: 'dam_home_follicle_1',
      dam_name: '妮蔻',
      status: '发情中',
      created_at: heatDate,
      updated_at: now,
      version: 1,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'record_home_heat_1',
      family_id: 'fam_home_follicle',
      cycle_id: 'cycle_home_follicle_1',
      dog_id: 'dam_home_follicle_1',
      dog_name: '妮蔻',
      type: 'heat',
      date: heatDate,
      details: {},
      created_at: heatDate,
      updated_at: heatDate,
    }])
    await localDb.replaceTable('tasks', [{
      _id: 'task_old_follicle_1',
      family_id: 'fam_home_follicle',
      dog_id: 'dam_home_follicle_1',
      dog_name: '妮蔻',
      cycle_id: 'cycle_home_follicle_1',
      type: 'breeding_milestone',
      title: '妮蔻 · 建议卵泡检查',
      due_date: now,
      status: 'pending',
      details: { step_type: 'follicle_check' },
      version: 3,
      created_at: heatDate,
      updated_at: heatDate,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.addBreedingRecordLocally('fam_home_follicle', {
      type: 'follicle_check',
      dog_id: 'dam_home_follicle_1',
      cycle_id: 'cycle_home_follicle_1',
      date: now,
      details: {
        left_count: 2,
        right_count: 1,
        result: '发育中',
      },
    })

    const oldTask = await getLocalTaskById('fam_home_follicle', 'task_old_follicle_1')
    const home = await localSyncRuntime.getHomeCards()
    const breedingCard = home.cards.find((card: any) =>
      card.tasks?.[0]?.type === 'breeding_milestone'
      && card.tasks?.[0]?.cycle_id === 'cycle_home_follicle_1',
    )

    expect(oldTask?.status).toBe('cancelled')
    expect(breedingCard?.tasks?.[0]).toMatchObject({
      type: 'breeding_milestone',
      cycle_id: 'cycle_home_follicle_1',
      title: '妮蔻 · 建议卵泡检查',
      due_date: now + 86400000,
      details: {
        step_type: 'follicle_check',
        follicle_check_count: 1,
        follicle_result: '发育中',
        latest_follicle_check_date: now,
      },
    })
  })

  it('编辑最近一次卵泡检查后首页应立即重算繁育节点', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const heatDate = now - 6 * 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dam_home_follicle_edit',
      family_id: 'fam_home_follicle_edit',
      name: '花花',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_home_follicle_edit',
      family_id: 'fam_home_follicle_edit',
      dam_id: 'dam_home_follicle_edit',
      dam_name: '花花',
      status: '发情中',
      created_at: heatDate,
      updated_at: now,
      version: 1,
    }])
    await localDb.replaceTable('breeding_records', [
      {
        _id: 'record_home_heat_edit',
        family_id: 'fam_home_follicle_edit',
        cycle_id: 'cycle_home_follicle_edit',
        dog_id: 'dam_home_follicle_edit',
        dog_name: '花花',
        type: 'heat',
        date: heatDate,
        details: {},
        created_at: heatDate,
        updated_at: heatDate,
      },
      {
        _id: 'record_home_follicle_edit',
        family_id: 'fam_home_follicle_edit',
        cycle_id: 'cycle_home_follicle_edit',
        dog_id: 'dam_home_follicle_edit',
        dog_name: '花花',
        type: 'follicle_check',
        date: now - 86400000,
        details: { left_count: 2, right_count: 2, result: '已成熟' },
        created_at: now - 86400000,
        updated_at: now - 86400000,
      },
    ])
    await localDb.replaceTable('tasks', [{
      _id: 'task_old_mating_edit',
      family_id: 'fam_home_follicle_edit',
      dog_id: 'dam_home_follicle_edit',
      dog_name: '花花',
      cycle_id: 'cycle_home_follicle_edit',
      type: 'breeding_milestone',
      title: '花花 · 配种',
      due_date: now - 86400000,
      status: 'pending',
      details: { step_type: 'mating', follicle_check_date: now - 86400000 },
      version: 2,
      created_at: now - 86400000,
      updated_at: now - 86400000,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.updateBreedingRecordLocally('fam_home_follicle_edit', {
      id: 'record_home_follicle_edit',
      details: { left_count: 2, right_count: 2, result: '发育中' },
    })

    const oldTask = await getLocalTaskById('fam_home_follicle_edit', 'task_old_mating_edit')
    const home = await localSyncRuntime.getHomeCards()
    const breedingCard = home.cards.find((card: any) =>
      card.tasks?.[0]?.type === 'breeding_milestone'
      && card.tasks?.[0]?.cycle_id === 'cycle_home_follicle_edit',
    )

    expect(oldTask?.status).toBe('cancelled')
    expect(breedingCard?.tasks?.[0]).toMatchObject({
      title: '花花 · 建议卵泡检查',
      due_date: now,
      details: {
        step_type: 'follicle_check',
        follicle_check_count: 1,
        follicle_result: '发育中',
        latest_follicle_check_date: now - 86400000,
      },
    })
  })

  it('孕检未孕后首页应立即移除繁育待办并关闭周期', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const matingDate = now - 25 * 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dam_home_pregnancy_rejected',
      family_id: 'fam_home_pregnancy_rejected',
      name: '奶茶',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_home_pregnancy_rejected',
      family_id: 'fam_home_pregnancy_rejected',
      dam_id: 'dam_home_pregnancy_rejected',
      dam_name: '奶茶',
      status: '怀孕中',
      created_at: matingDate,
      updated_at: now - 1000,
      version: 2,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'record_home_mating_rejected',
      family_id: 'fam_home_pregnancy_rejected',
      cycle_id: 'cycle_home_pregnancy_rejected',
      dog_id: 'dam_home_pregnancy_rejected',
      dog_name: '奶茶',
      type: 'mating',
      date: matingDate,
      details: {
        expected_checkup_date: now,
        expected_due_date: now + 34 * 86400000,
      },
      created_at: matingDate,
      updated_at: matingDate,
    }])
    await localDb.replaceTable('tasks', [{
      _id: 'task_old_pregnancy_rejected',
      family_id: 'fam_home_pregnancy_rejected',
      dog_id: 'dam_home_pregnancy_rejected',
      dog_name: '奶茶',
      cycle_id: 'cycle_home_pregnancy_rejected',
      type: 'breeding_milestone',
      title: '奶茶 · 建议孕检',
      due_date: now,
      status: 'pending',
      details: { step_type: 'pregnancy_check' },
      version: 4,
      created_at: matingDate,
      updated_at: matingDate,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.addBreedingRecordLocally('fam_home_pregnancy_rejected', {
      type: 'pregnancy_check',
      dog_id: 'dam_home_pregnancy_rejected',
      cycle_id: 'cycle_home_pregnancy_rejected',
      date: now,
      details: { confirmed: '否' },
    })

    const cycles = await localDb.getTable<any>('breeding_cycles')
    const oldTask = await getLocalTaskById('fam_home_pregnancy_rejected', 'task_old_pregnancy_rejected')
    const home = await localSyncRuntime.getHomeCards()
    const breedingCard = home.cards.find((card: any) =>
      card.tasks?.[0]?.type === 'breeding_milestone'
      && card.tasks?.[0]?.cycle_id === 'cycle_home_pregnancy_rejected',
    )

    expect(cycles.find(item => item._id === 'cycle_home_pregnancy_rejected')?.status).toBe('失败')
    expect(oldTask?.status).toBe('cancelled')
    expect(breedingCard).toBeUndefined()
  })

  it('购入犬只后应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const res = await localSyncRuntime.createDogLocally('fam_finance_2', {
      name: '豆豆',
      gender: '公',
      role: '种狗',
      purchase_price: 5200,
      purchase_date: now,
    })

    const txList = await getLocalTransactionList('fam_finance_2', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(res.data._id).toBeTruthy()
    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category: '购入',
      total_amount: 5200,
      source_record_id: res.data._id,
    })
  })

  it('编辑犬只购入价后应同步更新本地财务账单，清空时应移除账单', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const nextDate = new Date('2026-05-08T09:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_purchase_edit_1',
      family_id: 'fam_finance_2b',
      name: '豆豆',
      gender: '公',
      role: '种狗',
      disposition: '在养',
      purchase_date: now,
      purchase_price: 3200,
      version: 0,
      updated_at: now,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_purchase_edit_1',
      family_id: 'fam_finance_2b',
      total_amount: 3200,
      category: '购入',
      date: now,
      linked_dog_ids: ['dog_purchase_edit_1'],
      dog_names: ['豆豆'],
      source_type: 'auto',
      source_record_id: 'dog_purchase_edit_1',
      version: 0,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.updateDogLocally('fam_finance_2b', 'dog_purchase_edit_1', {
      purchase_price: 4500,
      purchase_date: nextDate,
    })

    let txList = await getLocalTransactionList('fam_finance_2b', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      _id: 'expense_purchase_edit_1',
      total_amount: 4500,
      date: nextDate,
    })

    await localSyncRuntime.updateDogLocally('fam_finance_2b', 'dog_purchase_edit_1', {
      purchase_price: null,
    })

    txList = await getLocalTransactionList('fam_finance_2b', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(txList).toHaveLength(0)
  })

  it('犬只改名后应同步更新财务、销售与记录冗余犬名', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_rename_finance_1',
      family_id: 'fam_rename_1',
      name: '旧名',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      version: 0,
      updated_at: now,
    }])
    await localDb.replaceTable('tasks', [{ _id: 'task_rename_1', family_id: 'fam_rename_1', dog_id: 'dog_rename_finance_1', dog_name: '旧名' }])
    await localDb.replaceTable('health_records', [{ _id: 'health_rename_1', family_id: 'fam_rename_1', dog_id: 'dog_rename_finance_1', dog_name: '旧名' }])
    await localDb.replaceTable('medication_tasks', [{ _id: 'med_rename_1', family_id: 'fam_rename_1', dog_id: 'dog_rename_finance_1', dog_name: '旧名' }])
    await localDb.replaceTable('breeding_records', [{ _id: 'breed_rename_1', family_id: 'fam_rename_1', dog_id: 'dog_rename_finance_1', dog_name: '旧名' }])
    await localDb.replaceTable('breeding_cycles', [{ _id: 'cycle_rename_1', family_id: 'fam_rename_1', dam_id: 'dog_rename_finance_1', dam_name: '旧名' }])
    await localDb.replaceTable('litters', [{ _id: 'litter_rename_1', family_id: 'fam_rename_1', dam_id: 'dog_rename_finance_1', dam_name: '旧名' }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_rename_1',
      family_id: 'fam_rename_1',
      total_amount: 100,
      category: '医疗',
      linked_dog_ids: ['dog_rename_finance_1'],
      dog_names: ['旧名'],
      dam_name: '旧名',
      deleted_at: null,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_rename_1',
      family_id: 'fam_rename_1',
      dog_id: 'dog_rename_finance_1',
      dog_name: '旧名',
      amount: 200,
      deleted_at: null,
    }])
    await localDb.replaceTable('sale_records', [{
      _id: 'sale_rename_1',
      family_id: 'fam_rename_1',
      dog_id: 'dog_rename_finance_1',
      dog_name: '旧名',
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.updateDogNameLocally('fam_rename_1', 'dog_rename_finance_1', '新名')

    await expect(localDb.findById<any>('expenses', 'expense_rename_1')).resolves.toMatchObject({ dog_names: ['新名'], dam_name: '新名' })
    await expect(localDb.findById<any>('incomes', 'income_rename_1')).resolves.toMatchObject({ dog_name: '新名' })
    await expect(localDb.findById<any>('sale_records', 'sale_rename_1')).resolves.toMatchObject({ dog_name: '新名' })
    await expect(localDb.findById<any>('health_records', 'health_rename_1')).resolves.toMatchObject({ dog_name: '新名' })
    await expect(localDb.findById<any>('medication_tasks', 'med_rename_1')).resolves.toMatchObject({ dog_name: '新名' })
    await expect(localDb.findById<any>('breeding_records', 'breed_rename_1')).resolves.toMatchObject({ dog_name: '新名' })

    const outbox = await localDb.getTable<any>('outbox_mutations')
    expect(outbox[0].collection_scope).toEqual(expect.arrayContaining(['expenses', 'incomes', 'sale_records', 'health_records', 'medication_tasks', 'breeding_records']))
  })

  it('录入带费用的健康记录后应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_health_finance_1',
      family_id: 'fam_finance_3',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const res = await localSyncRuntime.batchAddHealthRecordsLocally('fam_finance_3', {
      dog_ids: ['dog_health_finance_1'],
      type: 'vaccination',
      date: now,
      cost: 200,
      notes: '六联疫苗',
      details: {
        vaccine_type: '六联',
      },
    })

    const txList = await getLocalTransactionList('fam_finance_3', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(res.data.count).toBe(1)
    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category: '疫苗驱虫',
      total_amount: 200,
      notes: '疫苗 · 六联疫苗',
    })
  })

  it('开始带费用的用药后应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_med_finance_1',
      family_id: 'fam_finance_4',
      name: '花花',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const res = await localSyncRuntime.batchStartMedicationLocally('fam_finance_4', {
      dog_ids: ['dog_med_finance_1'],
      drug_name: '阿莫西林',
      dosage: '1',
      dosage_unit: 'tablet',
      method: '口服',
      frequency: 1,
      duration_days: 5,
      actual_start_date: now,
      cost: 300,
    })

    const txList = await getLocalTransactionList('fam_finance_4', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(res.data.count).toBe(1)
    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category: '医疗',
      total_amount: 300,
      notes: '阿莫西林 5天',
    })
  })

  it('覆盖同名用药时首页应立即只保留新疗程', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_med_override_1',
      family_id: 'fam_med_override',
      name: '花花',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_old_override_1',
      dog_id: 'dog_med_override_1',
      dog_name: '花花',
      family_id: 'fam_med_override',
      drug_name: '阿莫西林',
      frequency: 1,
      duration_days: 5,
      actual_start_date: now,
      status: '进行中',
      daily_doses: {},
      version: 2,
      created_at: now - 1000,
      updated_at: now - 1000,
    }])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const result = await localSyncRuntime.batchStartMedicationLocally('fam_med_override', {
      dog_ids: ['dog_med_override_1'],
      drug_name: '阿莫西林',
      dosage: '1',
      dosage_unit: 'tablet',
      method: '口服',
      frequency: 1,
      duration_days: 3,
      actual_start_date: now,
      override_dog_ids: ['dog_med_override_1'],
    })

    const meds = await localDb.getTable<any>('medication_tasks')
    const home = await localSyncRuntime.getHomeCards()
    const medicationCard = home.cards.find((card: any) => card.cardType === 'medication')
    const newMedicationId = result.data.medications[0].medicationId

    expect(meds.find(item => item._id === 'med_old_override_1')?.status).toBe('已取消')
    expect(meds.find(item => item._id === newMedicationId)?.status).toBe('进行中')
    expect(medicationCard?.medicationTaskIds).toEqual([newMedicationId])
  })

  it('按犬停止用药时应立即取消旧版每日任务', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_end_by_dog_1',
      dog_id: 'dog_end_by_dog_1',
      dog_name: '肉肉',
      family_id: 'fam_end_by_dog',
      drug_name: '益生菌',
      frequency: 1,
      duration_days: 3,
      actual_start_date: now,
      status: '进行中',
      daily_doses: {},
      version: 2,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('tasks', [{
      _id: 'task_daily_med_1',
      family_id: 'fam_end_by_dog',
      dog_id: 'dog_end_by_dog_1',
      medication_task_id: 'med_end_by_dog_1',
      type: 'medication',
      title: '肉肉 · 益生菌',
      due_date: now,
      status: 'pending',
      version: 1,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const result = await localSyncRuntime.endMedicationByDogLocally('fam_end_by_dog', 'dog_end_by_dog_1')
    const medication = await localDb.findById<any>('medication_tasks', 'med_end_by_dog_1')
    const task = await getLocalTaskById('fam_end_by_dog', 'task_daily_med_1')

    expect(medication?.status).toBe('已取消')
    expect(task?.status).toBe('cancelled')
    expect(result?.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'medication_tasks', id: 'med_end_by_dog_1' }),
      expect.objectContaining({ collection: 'tasks', id: 'task_daily_med_1' }),
    ]))
  })

  it('批量完成今日用药应返回已完全完成的本地任务', async () => {
    const now = Date.now()

    await localDb.replaceTable('medication_tasks', [
      {
        _id: 'med_day_full_1',
        family_id: 'fam_med_day_full',
        dog_id: 'dog_med_day_full_1',
        drug_name: '益生菌',
        frequency: 2,
        duration_days: 1,
        actual_start_date: now,
        daily_doses: { 1: 1 },
        status: '进行中',
        version: 1,
        created_at: now,
        updated_at: now,
      },
      {
        _id: 'med_day_partial_1',
        family_id: 'fam_med_day_full',
        dog_id: 'dog_med_day_full_2',
        drug_name: '钙片',
        frequency: 1,
        duration_days: 2,
        actual_start_date: now,
        daily_doses: {},
        status: '进行中',
        version: 1,
        created_at: now,
        updated_at: now,
      },
    ])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const result = await localSyncRuntime.batchCompleteMedicationDayLocally('fam_med_day_full', ['med_day_full_1', 'med_day_partial_1'])
    const full = await localDb.findById<any>('medication_tasks', 'med_day_full_1')
    const partial = await localDb.findById<any>('medication_tasks', 'med_day_partial_1')

    expect(full?.status).toBe('已完成')
    expect(partial?.status).toBe('进行中')
    expect(result?.data.completedMedicationTaskIds).toEqual(['med_day_full_1', 'med_day_partial_1'])
    expect(result?.data.fullyCompletedMedicationTaskIds).toEqual(['med_day_full_1'])
  })

  it('关闭周期和确认断奶应在本地 ack 中包含关联任务', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_close_ack_1',
      family_id: 'fam_cycle_ack',
      dam_id: 'dog_cycle_ack_1',
      dam_name: '花花',
      status: '怀孕中',
      version: 2,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_weaning_ack_1',
      family_id: 'fam_cycle_ack',
      cycle_id: 'cycle_weaning_ack_1',
      dam_id: 'dog_cycle_ack_2',
      dam_name: '奶茶',
      birth_date: now - 45 * 86400000,
      version: 3,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('tasks', [
      {
        _id: 'task_cycle_close_ack_1',
        family_id: 'fam_cycle_ack',
        cycle_id: 'cycle_close_ack_1',
        type: 'breeding_milestone',
        status: 'pending',
        version: 4,
        created_at: now,
        updated_at: now,
      },
      {
        _id: 'task_weaning_ack_1',
        family_id: 'fam_cycle_ack',
        litter_id: 'litter_weaning_ack_1',
        type: 'breeding_milestone',
        title: '奶茶窝 · 确认断奶',
        status: 'pending',
        version: 5,
        created_at: now,
        updated_at: now,
      },
    ])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const closed = await localSyncRuntime.closeBreedingCycleLocally('fam_cycle_ack', 'cycle_close_ack_1', '失败')
    const weaned = await localSyncRuntime.confirmWeaningLocally('fam_cycle_ack', 'litter_weaning_ack_1')
    const closeTask = await getLocalTaskById('fam_cycle_ack', 'task_cycle_close_ack_1')
    const weaningTask = await getLocalTaskById('fam_cycle_ack', 'task_weaning_ack_1')

    expect(closeTask?.status).toBe('cancelled')
    expect(weaningTask?.status).toBe('completed')
    expect(closed.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'tasks', id: 'task_cycle_close_ack_1' }),
    ]))
    expect(weaned.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'tasks', id: 'task_weaning_ack_1' }),
    ]))
  })

  it('领养带费用时应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('dogs', [{
      _id: 'dog_adoption_finance_1',
      family_id: 'fam_finance_5',
      name: '奶糕',
      gender: '母',
      role: '幼崽',
      disposition: '在养',
      updated_at: now,
      version: 0,
    }])
    await localDb.replaceTable('breeding_cycles', [])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('incomes', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.changeDogDispositionLocally('fam_finance_5', 'dog_adoption_finance_1', '已领养', {
      disposition_date: now,
      disposition_notes: '熟人家庭；领养费用：¥888',
      adoption_fee: 888,
    })

    const txList = await getLocalTransactionList('fam_finance_5', {
      year: 2026,
      month: 5,
      type: 'income',
    })

    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'income',
      type: '领养',
      amount: 888,
      dog_id: 'dog_adoption_finance_1',
      source_type: 'auto',
      source_record_id: 'dog_adoption_finance_1',
      notes: '熟人家庭；领养费用：¥888',
    })
    const detail = await getLocalIncomeDetail('fam_finance_5', txList[0]._id)
    expect(detail?.source).toBe('auto')
    await expect(localSyncRuntime.updateIncomeLocally('fam_finance_5', {
      id: txList[0]._id,
      amount: 999,
      type: '领养',
    })).rejects.toThrow('自动生成的收入不可编辑')
    await expect(localSyncRuntime.deleteIncomeLocally('fam_finance_5', txList[0]._id)).rejects.toThrow('自动生成的收入不可删除')
  })

  it('编辑健康记录费用后应立即同步本地财务账单', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const nextDate = now + 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dog_health_edit_1',
      family_id: 'fam_finance_6',
      name: '奶糖',
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'health_edit_1',
      family_id: 'fam_finance_6',
      dog_id: 'dog_health_edit_1',
      dog_name: '奶糖',
      type: 'vaccination',
      date: now,
      cost: 100,
      notes: '旧疫苗',
      details: { vaccine_type: '二联' },
      updated_at: now,
      version: 2,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_health_edit_1',
      family_id: 'fam_finance_6',
      total_amount: 100,
      category: '疫苗驱虫',
      date: now,
      linked_dog_ids: ['dog_health_edit_1'],
      source_type: 'auto',
      source_record_id: 'health_edit_1',
      dog_names: ['奶糖'],
      notes: '疫苗 · 旧疫苗',
      deleted_at: null,
      updated_at: now,
      created_at: now,
      version: 1,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.updateHealthRecordLocally('fam_finance_6', {
      id: 'health_edit_1',
      date: nextDate,
      cost: 188,
      notes: '加强针',
    })

    const expenses = await localDb.getTable<any>('expenses')
    expect(expenses).toHaveLength(1)
    expect(expenses[0]).toMatchObject({
      _id: 'expense_health_edit_1',
      total_amount: 188,
      date: nextDate,
      notes: '疫苗 · 加强针',
    })
  })

  it('删除健康记录时应立即移除本地自动费用账单', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('health_records', [{
      _id: 'health_delete_1',
      family_id: 'fam_finance_7',
      dog_id: 'dog_health_delete_1',
      type: 'deworming',
      date: now,
      updated_at: now,
      version: 3,
    }])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_health_delete_1',
      family_id: 'fam_finance_7',
      total_amount: 66,
      category: '疫苗驱虫',
      date: now,
      linked_dog_ids: ['dog_health_delete_1'],
      source_type: 'auto',
      source_record_id: 'health_delete_1',
      deleted_at: null,
      updated_at: now,
      created_at: now,
      version: 1,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.deleteHealthRecordLocally('fam_finance_7', 'health_delete_1')

    const expenses = await localDb.getTable<any>('expenses')
    expect(expenses).toHaveLength(0)
  })

  it('编辑繁育记录和生产日期后应同步本地财务账单', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()
    const nextDate = now + 86400000

    await localDb.replaceTable('dogs', [{
      _id: 'dam_breeding_edit_1',
      family_id: 'fam_finance_8',
      name: '肉肉',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'breeding_edit_1',
      family_id: 'fam_finance_8',
      dog_id: 'dam_breeding_edit_1',
      dog_name: '肉肉',
      cycle_id: 'cycle_breeding_edit_1',
      type: 'follicle_check',
      date: now,
      cost: 120,
      notes: '旧检查',
      details: { result: '发育中' },
      updated_at: now,
      version: 4,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_breeding_edit_1',
      family_id: 'fam_finance_8',
      dam_id: 'dam_breeding_edit_1',
      status: '发情中',
      updated_at: now,
    }])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('litters', [{
      _id: 'litter_breeding_edit_1',
      family_id: 'fam_finance_8',
      cycle_id: 'cycle_breeding_edit_1',
      dam_id: 'dam_breeding_edit_1',
      dam_name: '肉肉',
      birth_date: now,
      updated_at: now,
      version: 1,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_breeding_edit_1',
      family_id: 'fam_finance_8',
      total_amount: 120,
      category: '检查化验',
      date: now,
      linked_cycle_id: 'cycle_breeding_edit_1',
      linked_dog_ids: ['dam_breeding_edit_1'],
      source_type: 'auto',
      source_record_id: 'breeding_edit_1',
      dog_names: ['肉肉'],
      dam_name: '肉肉',
      notes: '卵泡检查 · 旧检查',
      deleted_at: null,
      updated_at: now,
      created_at: now,
      version: 2,
    }, {
      _id: 'expense_birth_edit_1',
      family_id: 'fam_finance_8',
      total_amount: 560,
      category: '生产育幼',
      date: now,
      linked_cycle_id: 'cycle_breeding_edit_1',
      linked_litter_id: 'litter_breeding_edit_1',
      linked_dog_ids: ['dam_breeding_edit_1'],
      source_type: 'auto',
      source_record_id: 'litter_breeding_edit_1',
      dog_names: ['肉肉'],
      dam_name: '肉肉',
      notes: '生产',
      deleted_at: null,
      updated_at: now,
      created_at: now,
      version: 3,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.updateBreedingRecordLocally('fam_finance_8', {
      id: 'breeding_edit_1',
      date: nextDate,
      cost: 288,
      notes: '复查',
    })
    await localSyncRuntime.updateLitterBirthDateLocally('fam_finance_8', 'litter_breeding_edit_1', nextDate)

    const expenses = await localDb.getTable<any>('expenses')
    expect(expenses.find(item => item._id === 'expense_breeding_edit_1')).toMatchObject({
      total_amount: 288,
      date: nextDate,
      notes: '卵泡检查 · 复查',
    })
    expect(expenses.find(item => item._id === 'expense_birth_edit_1')).toMatchObject({
      date: nextDate,
    })
  })

  it('完成带费用的疫苗待办并自动建记录后应立即出现在本地财务列表', async () => {
    const now = new Date('2026-05-06T10:00:00+08:00').getTime()

    await localDb.replaceTable('tasks', [{
      _id: 'task_vaccination_cost_1',
      family_id: 'fam_finance_9',
      dog_id: 'dog_task_finance_1',
      dog_name: '奶糕',
      type: 'vaccination',
      status: 'pending',
      due_date: now,
      updated_at: now,
      version: 1,
      details: {
        vaccine_type: '卫佳5',
        cost: 128,
        notes: '门店接种',
      },
    }])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    await localSyncRuntime.completeTaskLocally('fam_finance_9', 'task_vaccination_cost_1', true)

    const txList = await getLocalTransactionList('fam_finance_9', {
      year: 2026,
      month: 5,
      type: 'expense',
    })

    expect(txList).toHaveLength(1)
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category: '疫苗驱虫',
      total_amount: 128,
      notes: '疫苗 · 门店接种',
    })
  })

  it('应从本地方案库和犬舍总览集合读取数据', async () => {
    const monthTs = new Date('2026-04-10T10:00:00+08:00').getTime()
    await localDb.replaceTable('medication_protocols', [{
      _id: 'protocol_1',
      family_id: 'fam_1',
      name: '保胎',
      drug_name: '黄体酮',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('dogs', [{
      _id: 'dog_1',
      family_id: 'fam_1',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '待售',
      updated_at: monthTs,
    }, {
      _id: 'dog_2',
      family_id: 'fam_1',
      name: '雪球',
      gender: '公',
      role: '种狗',
      disposition: '已售',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('breeding_cycles', [])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('litters', [{
      _id: 'litter_1',
      family_id: 'fam_1',
      dam_id: 'dog_1',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('sale_records', [{
      _id: 'sale_1',
      family_id: 'fam_1',
      status: '已成交',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_1',
      family_id: 'fam_1',
      total_amount: 300,
      date: monthTs,
      updated_at: monthTs,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_1',
      family_id: 'fam_1',
      amount: 1000,
      date: monthTs,
      updated_at: monthTs,
    }])

    expect(await listLocalMedicationProtocols('fam_1')).toHaveLength(1)

    const stats = await getLocalKennelDashboardStats('fam_1', { now: monthTs })
    expect(stats.activeDogs).toHaveLength(1)
    expect(stats.soldDogs).toHaveLength(1)
    expect(stats.monthlyIncome).toBe(1000)
    expect(stats.monthlyExpense).toBe(300)
  })

  it('应从本地集合投影出窝列表、周期列表与周期详情', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_active',
      family_id: 'fam_2',
      dam_id: 'dog_10',
      dam_name: '奶酪',
      status: '怀孕中',
      cycle_number: 3,
      mated_at: now - (10 * 86400000),
      updated_at: now,
    }, {
      _id: 'cycle_closed',
      family_id: 'fam_2',
      dam_id: 'dog_11',
      dam_name: '年糕',
      status: '放弃',
      cycle_number: 2,
      start_date: now - (20 * 86400000),
      updated_at: now - 5000,
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_10',
      family_id: 'fam_2',
      cycle_id: 'cycle_active',
      dam_id: 'dog_10',
      dam_name: '奶酪',
      birth_date: now - (3 * 86400000),
      litter_number: 4,
      total_born: 5,
      born_alive: 4,
      updated_at: now,
    }, {
      _id: 'litter_old',
      family_id: 'fam_2',
      cycle_id: 'cycle_closed',
      dam_id: 'dog_11',
      dam_name: '年糕',
      birth_date: now - (30 * 86400000),
      litter_number: 2,
      total_born: 3,
      born_alive: 3,
      weaned_at: now - (5 * 86400000),
      updated_at: now - 10000,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'record_10',
      family_id: 'fam_2',
      cycle_id: 'cycle_active',
      dog_id: 'dog_10',
      type: 'pregnancy_check',
      date: now - 86400000,
      updated_at: now,
      created_by: 'user_1',
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_10',
      family_id: 'fam_2',
      linked_cycle_id: 'cycle_active',
      total_amount: 200,
      date: now,
      updated_at: now,
      category: '产检',
      source_type: 'manual',
      created_by: 'user_1',
    }])

    const litters = await listLocalLitters('fam_2', { activeOnly: true })
    expect(litters).toHaveLength(1)
    expect(litters[0]).toMatchObject({
      _id: 'litter_10',
      damName: '奶酪',
      litterNumber: 4,
      aliveCount: 4,
      totalCount: 5,
    })

    const cycles = await listLocalBreedingCycles('fam_2', { includeClosed: true })
    expect(cycles.map(item => item._id)).toEqual(['cycle_active', 'cycle_closed'])
    expect(cycles[0]).toMatchObject({
      statusLabel: '怀孕中',
      damName: '奶酪',
      cycleNumber: 3,
    })

    const detail = await getLocalBreedingCycleDetail('fam_2', 'cycle_active')
    expect(detail).toMatchObject({
      cycle: { _id: 'cycle_active' },
      litter: { _id: 'litter_10' },
    })
    expect(detail?.records).toHaveLength(1)
    expect(detail?.expenses).toHaveLength(1)
  })

  it('周期第 N 天应按北京时间日边界计算', async () => {
    vi.setSystemTime(new Date('2026-04-25T00:30:00+08:00'))
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_beijing_day',
      family_id: 'fam_beijing_day',
      dam_id: 'dog_beijing_day',
      dam_name: '雪球',
      status: '发情中',
      cycle_number: 1,
      start_date: new Date('2026-04-24T23:30:00+08:00').getTime(),
      updated_at: Date.now(),
    }])

    const cycles = await listLocalBreedingCycles('fam_beijing_day', { includeClosed: true })

    expect(cycles[0].detail).toBe('发情第2天')
  })

  it('应从本地集合归一化销售与财务详情字段', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    await localDb.replaceTable('families', [{
      _id: 'fam_3',
      members: [{
        user_id: 'user_1',
        status: 'active',
        nickname: '小莫',
      }],
      settings: {
        custom_expense_categories: [{ name: '保健品', parent_group: 'health' }],
        custom_expense_category_groups: [],
      },
      updated_at: now,
    }])
    await localDb.replaceTable('dogs', [{
      _id: 'dog_30',
      family_id: 'fam_3',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      breed: '马尔济斯',
      birth_date: now - (400 * 86400000),
      updated_at: now,
    }, {
      _id: 'dog_31',
      family_id: 'fam_3',
      name: '奶芙',
      gender: '母',
      role: '幼崽',
      disposition: '在养',
      origin_litter_id: 'litter_30',
      updated_at: now,
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_30',
      family_id: 'fam_3',
      dam_id: 'dog_30',
      dam_name: '奶糖',
      birth_date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('agents', [{
      _id: 'agent_30',
      family_id: 'fam_3',
      name: '阿琳',
      updated_at: now,
    }])
    await localDb.replaceTable('sale_records', [{
      _id: 'sale_30',
      family_id: 'fam_3',
      dog_id: 'dog_30',
      dog_name: '奶糖',
      status: '已成交',
      received_amount: 8800,
      seller_agent_id: 'agent_30',
      updated_at: now,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_30',
      family_id: 'fam_3',
      total_amount: 320,
      category: '保健品',
      linked_dog_ids: ['dog_30'],
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'expense_31',
      family_id: 'fam_3',
      total_amount: 500,
      category: '检查化验',
      linked_litter_id: 'litter_30',
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'expense_32',
      family_id: 'fam_3',
      total_amount: 600,
      category: '其他',
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_30',
      family_id: 'fam_3',
      type: '定金',
      amount: 2000,
      dog_name: '奶糖',
      source_sale_id: 'sale_30',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'income_31',
      family_id: 'fam_3',
      type: '销售',
      amount: 3600,
      dog_id: 'dog_31',
      dog_name: '奶芙',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }])

    const sale = await getLocalSaleDetail('fam_3', 'sale_30')
    expect(sale).toMatchObject({
      sale_mode: '自售',
      settlement_status: '已结算',
      agent_name: '阿琳',
      breed: '马尔济斯',
      sex: '母',
    })
    expect(sale?.age_text).toContain('岁')

    const expense = await getLocalExpenseDetail('fam_3', 'expense_30')
    expect(expense).toMatchObject({
      amount: 320,
      category: '保健品',
      category_group_label: '医疗健康',
      created_by_name: '小莫',
      linked_ref: '单犬记录',
    })
    expect(expense?.linked_dogs).toEqual([{ _id: 'dog_30', name: '奶糖' }])

    const income = await getLocalIncomeDetail('fam_3', 'income_30')
    expect(income).toMatchObject({
      type: '定金保留',
      type_label: '定金保留',
      linked_dog_name: '奶糖',
      sale_id: 'sale_30',
      source: 'auto',
      created_by_name: '小莫',
    })

    const summary = await getLocalFinancialSummary('fam_3', {
      period: 'monthly',
      month: 4,
      year: 2026,
    })
    expect(summary).toMatchObject({
      totalIncome: 5600,
      totalExpense: 1420,
      netProfit: 4180,
      incomeBreakdown: { '定金保留': 2000, '销售': 3600 },
      categoryBreakdown: { '医疗健康': 820, '其他': 600 },
    })

    const projection = await getLocalProjectionParams('fam_3')
    expect(projection).toMatchObject({
      activeDams: 1,
      littersPerYear: 1,
      avgIncomePerLitter: 3600,
      avgCostPerLitter: 500,
      monthlySharedCost: 100,
    })

    const litterProfit = await getLocalLitterProfit('fam_3', 'litter_30')
    expect(litterProfit).toMatchObject({
      totalIncome: 3600,
      totalCost: 500,
      netProfit: 3100,
      puppyCount: 1,
      aliveCount: 1,
    })
    expect(litterProfit?.incomeItems).toHaveLength(1)

    const damRoi = await getLocalDamRoi('fam_3', 'dog_30')
    expect(damRoi).toMatchObject({
      totalBreedingIncome: 3600,
      totalBreedingCost: 500,
      healthCost: 320,
      cycleCount: 0,
      litterCount: 1,
      puppyCount: 1,
    })
    expect(damRoi?.litters).toHaveLength(1)

    const txList = await getLocalTransactionList('fam_3', {
      period: 'monthly',
      month: 4,
      year: 2026,
      type: 'expense',
      expenseCategoryGroups: ['health'],
      sort: 'amount_desc',
    })
    expect(txList.map(item => item._id)).toEqual(['expense_31', 'expense_30'])
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category_group_label: '医疗健康',
    })
  })

  it('应为犬只详情页提供本地详情、历史、窝统计与体重投影', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const runtimeNow = Date.now()
    await localDb.replaceTable('dogs', [{
      _id: 'dog_40',
      family_id: 'fam_4',
      name: '团子',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      purchase_price: 3200,
      birth_date: now - (500 * 86400000),
      updated_at: now,
    }, {
      _id: 'puppy_40_a',
      family_id: 'fam_4',
      name: '团子窝-1号',
      gender: '母',
      role: '幼崽',
      disposition: '在养',
      origin_litter_id: 'litter_40',
      updated_at: now,
    }, {
      _id: 'puppy_40_b',
      family_id: 'fam_4',
      name: '团子窝-2号',
      gender: '公',
      role: '幼崽',
      disposition: '已售',
      origin_litter_id: 'litter_40',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_40',
      family_id: 'fam_4',
      dam_id: 'dog_40',
      dam_name: '团子',
      status: '已生产',
      birth_date: now - (12 * 86400000),
      updated_at: now,
      created_at: now - (60 * 86400000),
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_40',
      family_id: 'fam_4',
      dam_id: 'dog_40',
      dam_name: '团子',
      cycle_id: 'cycle_40',
      birth_date: now - (12 * 86400000),
      born_alive: 2,
      total_born: 2,
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      type: 'illness',
      date: now - (2 * 86400000),
      updated_at: now,
      details: {
        treatment_status: '治疗中',
        primary_condition: '乳房炎',
      },
    }, {
      _id: 'vac_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      type: 'vaccination',
      date: now - (30 * 86400000),
      updated_at: now - 1000,
      details: {
        vaccine_type: '四联',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      dog_name: '团子',
      status: '进行中',
      drug_name: '头孢',
      frequency: 2,
      duration_days: 5,
      actual_start_date: runtimeNow - 86400000,
      updated_at: runtimeNow,
      daily_doses: { 1: 2 },
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_40',
      family_id: 'fam_4',
      total_amount: 240,
      category: '保健品',
      linked_dog_ids: ['dog_40'],
      date: now - 86400000,
      updated_at: now,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      dog_name: '团子',
      type: '销售',
      amount: 900,
      date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('dog_weights', [{
      _id: 'weight_40_a',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      weight: 3200,
      date: now - (7 * 86400000),
      created_at: now - (7 * 86400000),
    }, {
      _id: 'weight_40_b',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      weight: 3350,
      date: now - 86400000,
      created_at: now - 86400000,
    }])

    const detail = await getLocalDogDetail('fam_4', 'dog_40')
    expect(detail?.statuses.map(item => item.type)).toEqual(['生病中', '用药中', '哺乳中'])

    const history = await listLocalDogHealthHistory('fam_4', 'dog_40')
    expect(history.map(item => item._id)).toEqual(['ill_40', 'vac_40'])

    const medicationHistory = await listLocalDogMedicationHistory('fam_4', 'dog_40')
    expect(medicationHistory[0]).toMatchObject({
      _id: 'med_40',
      status: 'active',
      progress: {
        current: 2,
        total: 5,
      },
    })

    const litters = await listLocalLittersByDam('fam_4', 'dog_40')
    expect(litters[0]).toMatchObject({
      _id: 'litter_40',
      pupStats: {
        total: 2,
        alive: 2,
        sold: 1,
        kept: 1,
        available: 0,
      },
    })

    const finance = await getLocalDogFinanceSummary('fam_4', 'dog_40')
    expect(finance).toMatchObject({
      purchaseCost: 3200,
      directExpenses: 240,
      salesIncome: 900,
      netProfit: -2540,
    })
    expect(finance?.recent).toHaveLength(2)

    const weights = await listLocalDogWeights('fam_4', 'dog_40')
    expect(weights.map(item => item._id)).toEqual(['weight_40_b', 'weight_40_a'])
  })

  it('应支持本地任务读取与重复疾病/用药预检', async () => {
    const now = new Date('2026-04-28T10:00:00+08:00').getTime()
    await localDb.replaceTable('tasks', [{
      _id: 'task_50_a',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      title: '今日疫苗',
      type: 'vaccination',
      status: 'pending',
      due_date: now,
      created_at: now,
      updated_at: now,
    }, {
      _id: 'task_50_b',
      family_id: 'fam_5',
      dog_id: 'dog_51',
      dog_name: '奶盖',
      title: '今日驱虫',
      type: 'deworming',
      status: 'pending',
      due_date: now,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_50',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      type: 'illness',
      date: now,
      created_at: now,
      updated_at: now,
      details: {
        primary_condition: '皮肤炎',
        treatment_status: '治疗中',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_50',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      drug_name: '头孢',
      frequency: 2,
      duration_days: 5,
      actual_start_date: Date.now() - 86400000,
      status: '进行中',
      created_at: now,
      updated_at: now,
    }])

    const task = await getLocalTaskById('fam_5', 'task_50_a')
    expect(task?._id).toBe('task_50_a')

    const taskList = await listLocalTasksByIds('fam_5', ['task_50_b', 'task_50_a'])
    expect(taskList.map(item => item._id)).toEqual(['task_50_b', 'task_50_a'])

    const illnessDup = await findLocalDuplicateIllnesses('fam_5', ['dog_50'], '皮肤炎')
    expect(illnessDup).toEqual([{
      dogId: 'dog_50',
      recordId: 'ill_50',
      condition: '皮肤炎',
    }])

    const medicationDup = await findLocalDuplicateMedicationTasks('fam_5', ['dog_50'], '头孢')
    expect(medicationDup[0]).toMatchObject({
      dog_id: 'dog_50',
      dog_name: '奶黄',
      task_id: 'med_50',
      task_name: '头孢',
      status: 'active',
    })
  })

  it('本地重复疾病清理应写入 outbox，避免下次同步复活重复记录', async () => {
    const now = new Date('2026-04-28T10:00:00+08:00').getTime()
    await localDb.replaceTable('health_records', [{
      _id: 'ill_keep_1',
      family_id: 'fam_cleanup_1',
      dog_id: 'dog_cleanup_1',
      dog_name: '奶黄',
      type: 'illness',
      date: now,
      created_at: now,
      updated_at: now + 1000,
      version: 2,
      details: {
        primary_condition: '皮肤炎',
        treatment_status: '治疗中',
      },
    }, {
      _id: 'ill_dup_1',
      family_id: 'fam_cleanup_1',
      dog_id: 'dog_cleanup_1',
      dog_name: '奶黄',
      type: 'illness',
      date: now,
      created_at: now,
      updated_at: now,
      version: 1,
      details: {
        primary_condition: '皮肤炎',
        treatment_status: '观察中',
      },
    }])
    await localDb.replaceTable('tasks', [{
      _id: 'task_dup_1',
      family_id: 'fam_cleanup_1',
      dog_id: 'dog_cleanup_1',
      type: 'illness',
      source_record_id: 'ill_dup_1',
      status: 'pending',
      version: 3,
    }])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])

    const result = await localSyncRuntime.cleanupDuplicateIllnessesLocally('fam_cleanup_1', 'dog_cleanup_1')

    expect(result.data).toMatchObject({ cleanedGroups: 1, cleanedRecords: 1 })
    await expect(localDb.findById<any>('health_records', 'ill_dup_1')).resolves.toMatchObject({
      details: expect.objectContaining({
        treatment_status: '已康复',
        merged_into_record_id: 'ill_keep_1',
      }),
      _local_pending: true,
    })
    await expect(localDb.findById<any>('tasks', 'task_dup_1')).resolves.toMatchObject({
      source_record_id: 'ill_keep_1',
      _local_pending: true,
    })
    const outbox = await localDb.getTable<any>('outbox_mutations')
    expect(outbox[0]).toMatchObject({
      type: 'health.cleanupDuplicateIllnesses',
      collection_scope: expect.arrayContaining(['health_records', 'tasks']),
    })
  })
})
