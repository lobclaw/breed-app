const MEDICATION_DOSAGE_UNIT_LABELS: Record<string, string> = {
  ml: '毫升',
  mg: '毫克',
  tablet: '片',
}

const MEDICATION_METHOD_LABELS: Record<string, string> = {
  oral: '口服',
  injection: '注射',
  topical: '外用',
  other: '其他',
}

const MEDICATION_FREQUENCY_LABELS: Record<string, string> = {
  once_daily: '每日1次',
  twice_daily: '每日2次',
  three_daily: '每日3次',
}

export function formatMedicationDosage(
  dosage?: string | number | null,
  dosageUnit?: string | null,
  fallbackUnit = '',
): string {
  if (dosage === null || dosage === undefined || dosage === '') return ''

  const rawDosage = String(dosage).trim()
  if (!rawDosage) return ''

  const unit = MEDICATION_DOSAGE_UNIT_LABELS[dosageUnit || ''] || dosageUnit || fallbackUnit
  return `${rawDosage}${unit}`
}

export function formatMedicationMethod(method?: string | null): string {
  const rawMethod = String(method || '').trim()
  if (!rawMethod) return ''
  return MEDICATION_METHOD_LABELS[rawMethod] || rawMethod
}

export function formatMedicationFrequency(frequency?: string | number | null): string {
  if (frequency === null || frequency === undefined || frequency === '') return ''

  const count = Number(frequency)
  if (Number.isFinite(count) && count > 0) {
    return `每日${count}次`
  }

  const rawFrequency = String(frequency).trim()
  if (!rawFrequency) return ''
  return MEDICATION_FREQUENCY_LABELS[rawFrequency] || rawFrequency
}
