const MEDICATION_DOSAGE_UNIT_LABELS: Record<string, string> = {
  ml: '毫升',
  mg: '毫克',
  tablet: '片',
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

export function formatMedicationFrequency(frequency?: string | number | null): string {
  if (frequency === null || frequency === undefined || frequency === '') return ''

  const count = Number(frequency)
  if (Number.isFinite(count) && count > 0) {
    return `每日${count}次`
  }

  const rawFrequency = String(frequency).trim()
  if (!rawFrequency) return ''
  return rawFrequency
}
