export type FinanceAmountScene = 'overview' | 'detail' | 'list' | 'report'

export interface FinanceAmountDisplay {
  value: string
  detail: string
  abbreviated: boolean
}

export interface FinanceAmountParts {
  sign: '' | '-'
  currency: '¥'
  number: string
  fullText: string
  detail: string
  abbreviated: boolean
}

interface FinanceAmountOptions {
  scene?: FinanceAmountScene
  absolute?: boolean
  showDetailWhenAbbreviated?: boolean
}

const FINANCE_WAN_THRESHOLD = 100000
const FINANCE_WAN_UNIT = 10000

function normalizeAmount(amount: number) {
  const numericAmount = Number(amount)
  return Number.isFinite(numericAmount) ? numericAmount : 0
}

export function formatFinanceInteger(amount: number) {
  return normalizeAmount(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatFinanceWan(amount: number) {
  return `${(amount / FINANCE_WAN_UNIT).toFixed(1).replace(/\.0$/, '')}万`
}

export function getFinanceAmountParts(amount: number, options: FinanceAmountOptions = {}): FinanceAmountParts {
  const numericAmount = normalizeAmount(amount)
  const effectiveAmount = options.absolute ? Math.abs(numericAmount) : numericAmount
  const absoluteAmount = Math.abs(effectiveAmount)
  const abbreviated = absoluteAmount >= FINANCE_WAN_THRESHOLD
  const baseValue = abbreviated ? formatFinanceWan(absoluteAmount) : formatFinanceInteger(absoluteAmount)
  const sign: '' | '-' = effectiveAmount < 0 ? '-' : ''
  const currency = '¥'
  const fullText = `${sign}${currency}${baseValue}`

  return {
    sign,
    currency,
    number: baseValue,
    fullText,
    detail: options.showDetailWhenAbbreviated !== false && abbreviated
      ? `完整：${sign}${currency}${formatFinanceInteger(absoluteAmount)}`
      : '',
    abbreviated,
  }
}

export function getFinanceAmountDisplay(amount: number, options: FinanceAmountOptions = {}): FinanceAmountDisplay {
  const parts = getFinanceAmountParts(amount, options)

  return {
    value: parts.fullText,
    detail: parts.detail,
    abbreviated: parts.abbreviated,
  }
}

export function formatFinanceAmount(amount: number, options: FinanceAmountOptions = {}) {
  return getFinanceAmountDisplay(amount, options).value
}
