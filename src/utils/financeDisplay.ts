export type FinanceAmountScene = 'overview' | 'detail' | 'list' | 'report'

export interface FinanceAmountDisplay {
  value: string
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

export function getFinanceAmountDisplay(amount: number, options: FinanceAmountOptions = {}): FinanceAmountDisplay {
  const numericAmount = normalizeAmount(amount)
  const effectiveAmount = options.absolute ? Math.abs(numericAmount) : numericAmount
  const absoluteAmount = Math.abs(effectiveAmount)
  const abbreviated = absoluteAmount >= FINANCE_WAN_THRESHOLD
  const baseValue = abbreviated ? formatFinanceWan(absoluteAmount) : formatFinanceInteger(absoluteAmount)
  const negative = effectiveAmount < 0

  return {
    value: negative ? `-${baseValue}` : baseValue,
    detail: options.showDetailWhenAbbreviated !== false && abbreviated
      ? `完整：${negative ? '-' : ''}${formatFinanceInteger(absoluteAmount)}`
      : '',
    abbreviated,
  }
}

export function formatFinanceAmount(amount: number, options: FinanceAmountOptions = {}) {
  return getFinanceAmountDisplay(amount, options).value
}
