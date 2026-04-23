import { getBeijingDayStart } from '@/utils/date'
import type { BreedingMilestoneViewModel } from '@/utils/breedingMilestone'

export interface BreedingMilestoneSummary {
  stageTag: string
  primaryLabel: string
  secondaryLabel: string
  alertLabel: string
}

export function buildBreedingMilestoneSummary(
  milestone: BreedingMilestoneViewModel,
): BreedingMilestoneSummary {
  return {
    stageTag: buildStageTag(milestone.stageTitle),
    primaryLabel: buildPrimaryLabel(milestone),
    secondaryLabel: buildSecondaryLabel(milestone),
    alertLabel: buildAlertLabel(milestone),
  }
}

function buildStageTag(stageTitle: string) {
  if (stageTitle === '建议卵泡检查') return '卵泡检查'
  if (stageTitle === '待断奶') return '哺乳中'
  return stageTitle
    .replace(/^建议/, '')
    .replace(/^确认/, '')
    .trim() || '流程'
}

function buildPrimaryLabel(milestone: BreedingMilestoneViewModel) {
  if (milestone.stepType === 'follicle_check') {
    return milestone.heatDayLabel || '发情时间待确认'
  }
  if (milestone.stepType === 'mating' && milestone.heatDayLabel) {
    return milestone.heatDayLabel
  }
  if (milestone.stepType === 'weaning_confirm') {
    return milestone.stageDayLabel
  }
  return milestone.dayLabel
}

function buildSecondaryLabel(milestone: BreedingMilestoneViewModel) {
  if (milestone.stepType === 'mating') {
    return buildMatingSecondaryLabel(milestone)
  }
  if (milestone.stepType === 'pregnancy_check') {
    return buildPregnancyCheckSecondaryLabel(milestone)
  }
  if (milestone.stepType === 'follicle_check') {
    return buildFollicleSecondaryLabel(milestone)
  }
  if (milestone.stepType === 'weaning_confirm') {
    return milestone.referenceDateLabel
  }
  if (milestone.suggestionStatus === 'window_due') {
    return milestone.suggestionLabel
  }
  return milestone.referenceDateLabel.replace('建议日期 · ', '建议')
}

function buildAlertLabel(milestone: BreedingMilestoneViewModel) {
  if (milestone.stepType === 'follicle_check') {
    return buildFollicleAlertLabel(milestone)
  }
  if (milestone.stepType === 'mating' && milestone.suggestionStatus === 'window_passed') {
    return buildMatingPassedAlertLabel(milestone)
  }
  if (milestone.alertLabel) return milestone.alertLabel
  return ''
}

function buildFollicleSecondaryLabel(milestone: BreedingMilestoneViewModel) {
  const count = milestone.follicleCheckCount
  const latestResult = milestone.latestFollicleResult
  const latestCheckDistance = buildCheckDistanceOnlyLabel(milestone)

  if (count <= 0) {
    return `尚未检查 · ${buildFollicleSuggestionLabel(milestone, false)}`
  }

  if (count === 1) {
    if (latestResult) return `上次${latestResult} · ${latestCheckDistance}`
    return `${latestCheckDistance} · ${buildFollicleSuggestionLabel(milestone, true)}`
  }

  if (!milestone.latestFollicleCheckDate) {
    return `已检查 ${count} 次 · ${buildFollicleSuggestionLabel(milestone, true)}`
  }

  if (!latestResult) {
    return `已检查 ${count} 次 · ${buildFollicleSuggestionLabel(milestone, true)}`
  }

  return `已查${count}次 · ${latestResult} · ${latestCheckDistance}`
}

function buildFollicleAlertLabel(milestone: BreedingMilestoneViewModel) {
  if (milestone.isFollicleAbnormal) return '最近一次检查提示发育不良'
  if (milestone.follicleCheckCount > 0 && milestone.suggestionStatus === 'window_passed') {
    return milestone.suggestionLabel.replace('建议日期已过', '建议复查已过')
  }
  return ''
}

function buildCheckDistanceOnlyLabel(milestone: BreedingMilestoneViewModel) {
  if (!milestone.latestFollicleCheckDate) return '时间待确认'
  const diffDays = Math.max(1, Math.floor((startOfDay(milestone.now) - startOfDay(milestone.latestFollicleCheckDate)) / DAY_MS) + 1)
  return `${diffDays}天前`
}

function buildFollicleSuggestionLabel(milestone: BreedingMilestoneViewModel, isRecheck: boolean) {
  if (milestone.suggestionStatus === 'window_due') {
    return isRecheck ? '建议今日复查' : '建议今日处理'
  }
  if (milestone.suggestionStatus === 'window_passed') {
    return milestone.referenceDateLabel.replace('建议日期 · ', '建议 ')
  }
  if (!milestone.dueDate) {
    return isRecheck ? '建议尽快复查' : '建议尽快处理'
  }
  return milestone.referenceDateLabel.replace('建议日期 · ', '建议 ')
}

function buildMatingPassedAlertLabel(milestone: BreedingMilestoneViewModel) {
  const passedLabel = milestone.passedWindowLabel.replace(/建议配种窗已过\s*(\d+)\s*天/, '建议配种日期已过 $1 天')
  return passedLabel
}

function buildMatingSecondaryLabel(milestone: BreedingMilestoneViewModel) {
  return milestone.stageDayLabel.replace(/卵泡检查后第\s*(\d+)\s*天/, '卵检后第$1天')
}

function buildPregnancyCheckSecondaryLabel(milestone: BreedingMilestoneViewModel) {
  if (milestone.suggestionStatus === 'window_due') return '建议今日孕检'
  if (!milestone.dueDate) return '建议尽快孕检'
  return milestone.referenceDateLabel.replace('建议日期 · ', '建议 ')
    .concat('孕检')
}

const DAY_MS = 86400000

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}
