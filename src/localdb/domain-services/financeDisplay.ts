import { normalizeExpenseCategoryName } from '@/constants/financeCategories'
import type { BreedingRecord } from '@/types/breeding'
import type { HealthRecord } from '@/types/health'

export type ExpenseSourceRecord = Partial<BreedingRecord | HealthRecord> & Record<string, any>

export type ExpenseDisplayInfo = {
  title: string
  subtitle: string
  name: string
}

const EXPENSE_SOURCE_TYPE_LABELS: Record<string, string> = {
  vaccination: '疫苗',
  deworming: '驱虫',
  illness: '治疗',
  heat: '发情',
  heat_observation: '发情观察',
  follicle_check: '卵泡检查',
  mating: '配种',
  pregnancy_check: '孕检',
  prenatal_check: '产检',
  pre_labor: '临产监测',
  birth: '生产',
  abnormal_termination: '异常终止',
}
const EXPENSE_SOURCE_LABEL_SET = new Set(Object.values(EXPENSE_SOURCE_TYPE_LABELS))

const DEWORMING_TYPE_LABELS: Record<string, string> = {
  internal: '内驱',
  external: '外驱',
  combo: '内外同驱',
}

function buildExpenseName(expense: Record<string, any>, fallback = '费用') {
  return expense.notes || normalizeExpenseCategoryName(expense.category) || fallback
}

function splitExpenseFallbackDisplayInfo(name: string): ExpenseDisplayInfo {
  const normalized = normalizeExpenseDisplayPart(name)
  const [head, ...tailParts] = normalized.split(' · ')
  const title = normalizeExpenseDisplayPart(head)
  const subtitle = normalizeExpenseDisplayPart(tailParts.join(' · '))
  if (title && subtitle && EXPENSE_SOURCE_LABEL_SET.has(title)) {
    return { title, subtitle, name: normalized }
  }
  return { title: normalized, subtitle: '', name: normalized }
}

function normalizeExpenseDisplayPart(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getPregnancyCheckResultText(details: Record<string, any> = {}) {
  if (normalizeExpenseDisplayPart(details.result)) return normalizeExpenseDisplayPart(details.result)
  if (details.confirmed === '是' || details.confirmed === true) return '确认怀孕'
  if (details.confirmed === '否' || details.confirmed === false) return '未怀孕'
  return ''
}

function getExpenseSourceDetailText(record: ExpenseSourceRecord) {
  const details = record.details || {}
  if (record.type === 'vaccination') {
    return normalizeExpenseDisplayPart(details.vaccine_type || details.vaccine_name || record.notes)
  }
  if (record.type === 'deworming') {
    const drugName = normalizeExpenseDisplayPart(details.drug_name)
    if (drugName) return drugName
    const dewormingType = normalizeExpenseDisplayPart(details.deworming_type)
    return DEWORMING_TYPE_LABELS[dewormingType] || dewormingType || normalizeExpenseDisplayPart(record.notes)
  }
  if (record.type === 'pregnancy_check') {
    return getPregnancyCheckResultText(details) || normalizeExpenseDisplayPart(record.notes)
  }
  if (record.type === 'prenatal_check') {
    return normalizeExpenseDisplayPart(details.results || details.result || record.notes)
  }
  if (record.type === 'follicle_check') {
    return normalizeExpenseDisplayPart(details.result || record.notes)
  }
  if (record.type === 'mating') {
    return normalizeExpenseDisplayPart(details.sire_name || details.male_name || record.notes)
  }
  if (record.type === 'birth') {
    return normalizeExpenseDisplayPart(details.birth_type || record.notes)
  }
  return normalizeExpenseDisplayPart(record.notes)
}

export function buildExpenseDisplayName(
  expense: Record<string, any>,
  sourceRecordMap: Map<string, ExpenseSourceRecord> = new Map(),
  fallback = '费用',
) {
  return buildExpenseDisplayInfo(expense, sourceRecordMap, fallback).name
}

export function buildExpenseDisplayInfo(
  expense: Record<string, any>,
  sourceRecordMap: Map<string, ExpenseSourceRecord> = new Map(),
  fallback = '费用',
): ExpenseDisplayInfo {
  const sourceRecordId = normalizeExpenseDisplayPart(expense.source_record_id)
  const sourceRecord = sourceRecordId ? sourceRecordMap.get(sourceRecordId) : null
  const sourceLabel = sourceRecord?.type ? EXPENSE_SOURCE_TYPE_LABELS[sourceRecord.type] : ''
  if (sourceRecord && sourceLabel) {
    const detailText = getExpenseSourceDetailText(sourceRecord)
    return {
      title: sourceLabel,
      subtitle: detailText,
      name: detailText ? `${sourceLabel} · ${detailText}` : sourceLabel,
    }
  }
  const fallbackName = buildExpenseName(expense, fallback)
  return splitExpenseFallbackDisplayInfo(fallbackName)
}
