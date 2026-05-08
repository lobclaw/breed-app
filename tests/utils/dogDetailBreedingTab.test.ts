import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')

describe('dog detail breeding tab source contract', () => {
  it('应将去向管理从原生 ActionSheet 改为同风格自定义 Sheet', () => {
    expect(source).toContain('const showDispositionSheet = ref(false)')
    expect(source).toContain('const dispositionActions = computed<DispositionAction[]>(() => {')
    expect(source).toContain('const dispositionActionSummary = computed(() => {')
    expect(source).toContain('function handleDispositionAction(actionKey:')
    expect(source).toContain('<BSheet v-model:visible="showDispositionSheet" title="去向管理">')
    expect(source).toContain('handleDispositionActionItem(action)')
    expect(source).not.toContain('uni.showActionSheet({')
    expect(source).toContain('status-sheet__action-row')
  })

  it('应让去向管理中的已故动作排在最后，并保留红色危险语义', () => {
    expect(source).toContain(`  return [
    { key: 'adoption', icon: 'volunteer_activism', title: '送领养', sub: '登记领养去向与领养费用', tone: 'green' },
    { key: 'retire', icon: 'bedtime', title: '退休', sub: '结束繁育身份并保留健康管理', tone: 'plum' },
    { key: 'gift', icon: 'redeem', title: '赠送', sub: '登记受赠对象与赠送日期', tone: 'teal' },
    { key: 'deceased', icon: 'heart_broken', title: '标记已故', sub: '结束当前状态并取消未完成任务', tone: 'red' },
  ]`)
    expect(source).toContain(`  if (d.role === '幼崽') {
    return [
      { key: 'promote', icon: 'trending_up', title: '升级为种犬', sub: '切换为种犬身份并恢复在养状态', tone: 'amber' },
      { key: 'adoption', icon: 'volunteer_activism', title: '送领养', sub: '登记领养去向与领养费用', tone: 'green' },
      { key: 'gift', icon: 'redeem', title: '赠送', sub: '登记受赠对象与赠送日期', tone: 'teal' },
      { key: 'deceased', icon: 'heart_broken', title: '标记已故', sub: '结束当前状态并取消未完成任务', tone: 'red' },
    ]`)
    expect(source).toContain("action.tone === 'red' ? 'status-sheet__action-title--danger' : ''")
    expect(source).toContain("showDeceasedSheet.value = true")
  })

  it('应将标记状态 Sheet 收敛为健康操作快捷面板，并移除重复的生病入口', () => {
    expect(source).toContain('title="健康操作"')
    expect(source).toContain('hasHealthActions')
    expect(source).toContain('healthActions')
    expect(source).toContain('healthActionSummary')
    expect(source).toContain('handleHealthAction(action.key)')
    expect(source).toContain('康复、治疗推进等快捷操作')
    expect(source).not.toContain('status-grid status-grid--3col')
    expect(source).not.toContain('录入疾病记录')
    expect(source).not.toContain('selectIllness')
    expect(source).toContain('status-sheet__action-row')
  })

  it('应让顶栏标题只在滚动后接管，避免首屏与 Hero 双标题竞争', () => {
    expect(source).toContain('onLoad, onPageScroll, onShow')
    expect(source).toContain('const showCompactTopbarTitle = ref(false)')
    expect(source).toContain('const TOPBAR_TITLE_SCROLL_THRESHOLD = 36')
    expect(source).toContain("showCompactTopbarTitle.value = scrollTop > TOPBAR_TITLE_SCROLL_THRESHOLD")
    expect(source).toContain(":class=\"{ 'dog-detail__topbar-title--visible': showCompactTopbarTitle }\"")
    expect(source).toContain('.dog-detail__topbar-title--visible')
    expect(source).toContain('opacity: 0;')
  })

  it('应在犬只详情中接入当前周期摘要时间线与历史周期摘要', () => {
    expect(source).toContain('activeCycleSummary.timeline')
    expect(source).toContain('historyCycleCards')
    expect(source).toContain('litterCards')
    expect(source).toContain('breeding-active-cycle__timeline-item')
    expect(source).toContain('summaryTitle')
    expect(source).toContain('summaryMeta')
    expect(source).toContain('summaryResult')
  })

  it('应让幼崽详情隐藏繁育能力面，但保留来源窝追溯', () => {
    expect(source).toContain(`const tabs = computed(() => {
  if (dog.value?.role === '外部种公') {
    return [
      { key: 'overview', label: '概览' },
      { key: 'breeding', label: '繁育' },
    ]
  }

  if (dog.value?.role === '幼崽') {
    return [
      { key: 'overview', label: '概览' },
      { key: 'health', label: '健康' },
      { key: 'finance', label: '财务' },
    ]`)
    expect(source).toContain("const tertiaryStatValue = computed(() => isPuppyDetail.value ? (dog.value?.disposition || '在养') : `${cycles.value.length}窝`)")
    expect(source).toContain("const tertiaryStatLabel = computed(() => isPuppyDetail.value ? '去向' : '繁育')")
    expect(source).toContain("allowBreeding: dog.value?.role !== '幼崽'")
    expect(source).toContain("v-if=\"dog.origin_litter_id\"")
    expect(source).toContain('来源窝')
  })

  it('应让时间线节点顶部对齐，并仅为当前/下一步保留特殊标题色', () => {
    expect(source).toContain('align-items: flex-start;')
    expect(source).toContain('justify-content: flex-start;')
    expect(source).toContain('align-self: stretch;')
    expect(source).toContain('padding-top: 3px;')
    expect(source).toContain("item.kind === 'upcoming' ? 'breeding-active-cycle__timeline-title--gray' : ''")
    expect(source).toContain("item.kind === 'current' ? `breeding-active-cycle__timeline-title--${item.tone}` : ''")
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--teal')
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--green')
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--blue')
  })

  it('应只在繁育 Tab 懒加载当前周期详情，并支持来源页返回刷新', () => {
    expect(source).toContain('getLocalBreedingCycleDetail')
    expect(source).toContain('watch([activeTab, activeCycleId]')
    expect(source).toContain("if (tab === 'breeding')")
    expect(source).toContain('refreshBreedingSummary')
    expect(source).toContain("refreshBreedingSummary: !!feedback && activeTab.value === 'breeding'")
    expect(source).toContain("const isPuppy = detail?.role === '幼崽'")
    expect(source).toContain('const cyclesPromise = isPuppy')
    expect(source).toContain('const littersPromise = isPuppy')
    expect(source).toContain('listLocalBreedingCycles')
    expect(source).toContain('listLocalLittersByDam')
    expect(source).toContain("const isExternalSire = detail?.role === '外部种公'")
    expect(source).toContain("if ((detail.role === '幼崽' && activeTab.value === 'breeding') || (isExternalSire && (activeTab.value === 'health' || activeTab.value === 'finance'))) {")
    expect(source).toContain("usePageSync({ routePath: 'pages/dog/detail' })")
  })

  it('应让外部种公详情收敛为轻量档案与使用追踪', () => {
    expect(source).toContain("const isExternalSireDetail = computed(() => dog.value?.role === '外部种公')")
    expect(source).toContain("const displayStatuses = computed(() => isExternalSireDetail.value ? [] : statuses.value.filter((status: any) => status?.type !== '正常'))")
    expect(source).toContain('v-if="!isExternalSireDetail" class="dog-detail__topbar-cta"')
    expect(source).toContain('<view v-else class="dog-detail__stats">')
    expect(source).toContain('外部种公档案')
    expect(source).toContain('使用记录')
    expect(source).toContain('externalSireUseCards')
    expect(source).toContain('openExternalSireUseCard(card)')
    expect(source).toContain('listLocalMatingRecordsBySire')
    expect(source).toContain('externalSireMatingRecords')
    expect(source).toContain("meta: matingTs ? `${formatDate(matingTs)} 配种${matingCountText}` : '配种日期未记录'")
    expect(source).toContain('const recordTs = externalSireMatingRecords.value.map')
    expect(source).toContain('dog-detail__rec-icon dog-detail__rec-icon--rose')
    expect(source).toContain('<text class="material-icons-round">pets</text>')
    expect(source).toContain("return `${month}-${day}`")
    expect(source).not.toContain("return `${d.getMonth() + 1}/${d.getDate()}`")
    expect(source).not.toContain('可用状态')
    expect(source).not.toContain('externalSireAvailabilityText')
    expect(source).not.toContain('配种使用')
    expect(source).not.toContain('产窝结果')
    expect(source).toContain('listLocalLittersBySire')
    expect(source).toContain('? { sireId: dogId, sireName: detail?.name, includeClosed: true }')
    expect(source).toContain('v-if="!isExternalSireDetail && hasHealthActions"')
    expect(source).toContain('v-if="!isExternalSireDetail" class="dog-detail__action-sheet-item" @click="openDispositionSheet"')
  })

  it('应让哺乳状态可点击进入周期详情，并展示副文案与窝信息', () => {
    expect(source).toContain("if (s.type === '哺乳中') {")
    expect(source).toContain("return s.detail || '当前处于哺乳照护阶段'")
    expect(source).toContain("const litterCards = computed(() => {")
    expect(source).toContain('dog-detail__cycle-list')
    expect(source).toContain('dog-detail__cycle-meta')
    expect(source).toContain('dog-detail__cycle-result')
    expect(source).toContain('dog-detail__litter-list')
    expect(source).toContain('summaryNumber')
    expect(source).toContain('summarySire')
    expect(source).toContain("label: `存活${aliveCount}`")
    expect(source).toContain("label: `在养${keptCount}`")
  })

  it('应将退休、已故、康复这类表单型动作统一到底部 Sheet，并保留纯确认弹窗', () => {
    expect(source).toContain('<BSheet v-model:visible="showRetireSheet" title="标记退休">')
    expect(source).toContain('<BSheet v-model:visible="showDeceasedSheet" title="标记已故">')
    expect(source).toContain('<BSheet v-model:visible="showRecoverySheet" title="标记康复">')
    expect(source).not.toContain('v-model:visible="showRetireModal"')
    expect(source).not.toContain('v-model:visible="showDeceasedModal"')
    expect(source).not.toContain('v-model:visible="showRecoveryModal"')
    expect(source).toContain('v-model:visible="showCancelRetireModal"')
    expect(source).toContain('v-model:visible="showPromoteModal"')
    expect(source).toContain('<BDeleteConfirm')
  })

  it('应让底部表单按钮改为左右双按钮，并保留已故 danger 语义', () => {
    expect(source).toContain('flex-direction: row;')
    expect(source).toContain('flex: 1;')
    expect(source).toContain('@click="showRetireSheet = false"')
    expect(source).toContain('@click="showDeceasedSheet = false"')
    expect(source).toContain('@click="showRecoverySheet = false"')
    expect(source).toContain('sheet-form__btn sheet-form__btn--danger')
    expect(source).toContain('sheet-form__danger-note')
    expect(source).toContain('确认标记已故')
    expect(source).toContain('background: var(--red);')
    expect(source).not.toContain('background: var(--danger);')
  })
})
