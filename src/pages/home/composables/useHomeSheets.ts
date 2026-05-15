import { computed, reactive, ref } from 'vue'
import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'
import { getHomeBreedingActionItems } from '@/utils/homeBreedingActions'
import { buildTimestampFromDayOffset, formatDateInputValue } from '@/utils/date'

export type BatchDogSelectionItem = {
  id: string
  name: string
  completed: boolean
  taskId?: string
}

export type SickBatchAction = 'recover' | 'update_status' | 'start_medication'

export function useHomeSheets() {
  const showQuickComplete = ref(false)
  const quickCompleteTask = ref<any>(null)
  const quickCompleteNotes = ref('')
  const quickCompleteDate = ref(Date.now())
  const showQuickCompleteDatePicker = ref(false)
  const quickCompleteDateStr = computed(() => formatDateInputValue(quickCompleteDate.value))

  const showPostponeModal = ref(false)
  const postponeTaskId = ref<string | string[]>('')
  const postponeDate = ref(buildTimestampFromDayOffset(1))
  const postponeQuick = ref('tomorrow')
  const showPostponeDatePicker = ref(false)
  const postponeTaskInfo = ref<Record<string, unknown> | null>(null)
  const postponeDateStr = computed(() => formatDateInputValue(postponeDate.value))

  const showBatchComplete = ref(false)
  const batchCompleteTitle = ref('批量完成')
  const batchDogList = ref<BatchDogSelectionItem[]>([])
  const batchSelected = reactive<Record<string, boolean>>({})
  const batchTaskIdByDogId = reactive<Record<string, string>>({})

  const showSickBatch = ref(false)
  const sickBatchList = ref<Array<{
    id: string
    dogId: string
    name: string
    illness: string
    treatmentStatus: string
    daysSick: number
    illnessId: string
    symptomSummary?: string
  }>>([])
  const sickBatchSelected = reactive<Record<string, boolean>>({})

  const showMedBatch = ref(false)
  const medBatchList = ref<Array<{
    id: string
    dogId: string
    name: string
    detail: string
    medicationTaskIds: string[]
    illnessId: string
    illnessIds: string[]
  }>>([])
  const medBatchSelected = reactive<Record<string, boolean>>({})

  const showBreedingActionSheet = ref(false)
  const breedingActionCard = ref<any>(null)
  const breedingActionTask = computed(() => {
    const card = breedingActionCard.value
    const tasks = Array.isArray(card?.tasks) ? card.tasks : []
    return tasks[0] || null
  })
  const breedingActionMilestone = computed(() => {
    return breedingActionTask.value ? deriveBreedingMilestoneViewModel(breedingActionTask.value) : null
  })
  const breedingActionItems = computed(() => getHomeBreedingActionItems(breedingActionCard.value))
  const breedingActionStageTitle = computed(() => breedingActionMilestone.value?.stageTitle || '')
  const breedingActionAlertDanger = computed(() => !!breedingActionMilestone.value?.isAlertDanger)
  const breedingActionSummary = computed(() => {
    const milestone = breedingActionMilestone.value
    if (!milestone) {
      return {
        stageTag: '',
        primaryLabel: '选择要执行的繁育动作',
        secondaryLabel: '',
        alertLabel: '',
      }
    }
    return buildBreedingMilestoneSummary(milestone)
  })

  const showSickMenu = ref(false)
  const sickMenuDog = ref<any>(null)
  const sickMenuItems = ref<any[]>([])

  const showStopConfirm = ref(false)
  const stopConfirmData = ref<any>(null)

  const batchSelectedCount = computed(() => Object.values(batchSelected).filter(Boolean).length)
  const isAllSelected = computed(() => {
    const uncompleted = batchDogList.value.filter(d => !d.completed)
    return uncompleted.length > 0 && uncompleted.every(d => batchSelected[d.id])
  })
  const sickBatchSelectedCount = computed(() => Object.values(sickBatchSelected).filter(Boolean).length)
  const isAllSickBatchSelected = computed(() => sickBatchList.value.length > 0 && sickBatchList.value.every(item => sickBatchSelected[item.id]))
  const medBatchSelectedCount = computed(() => Object.values(medBatchSelected).filter(Boolean).length)
  const isAllMedBatchSelected = computed(() => medBatchList.value.length > 0 && medBatchList.value.every(item => medBatchSelected[item.id]))
  const medBatchRecoverCount = computed(() => medBatchList.value.filter(item => medBatchSelected[item.id] && item.illnessIds.length > 0).length)

  function onQuickCompleteDateConfirm(value: number | string) {
    if (typeof value !== 'number') return
    quickCompleteDate.value = value
  }

  function setPostponeQuick(option: string) {
    postponeQuick.value = option
    const offsetMap: Record<string, number> = {
      tomorrow: 1,
      dayAfter: 2,
      nextWeek: 7,
    }
    postponeDate.value = buildTimestampFromDayOffset(offsetMap[option] || 1)
  }

  function onPostponeDateConfirm(value: number | string) {
    if (typeof value !== 'number') return
    postponeDate.value = value
    postponeQuick.value = ''
  }

  function toggleSelectAll() {
    const uncompleted = batchDogList.value.filter(d => !d.completed)
    if (isAllSelected.value) {
      uncompleted.forEach(d => { batchSelected[d.id] = false })
    } else {
      uncompleted.forEach(d => { batchSelected[d.id] = true })
    }
  }

  function toggleBatchDog(id: string) {
    const dog = batchDogList.value.find(d => d.id === id)
    if (dog?.completed) return
    batchSelected[id] = !batchSelected[id]
  }

  function toggleSelectAllSickBatch() {
    const nextValue = !isAllSickBatchSelected.value
    sickBatchList.value.forEach((item) => {
      sickBatchSelected[item.id] = nextValue
    })
  }

  function toggleSickBatchItem(id: string) {
    sickBatchSelected[id] = !sickBatchSelected[id]
  }

  function toggleSelectAllMedBatch() {
    const nextValue = !isAllMedBatchSelected.value
    medBatchList.value.forEach((item) => {
      medBatchSelected[item.id] = nextValue
    })
  }

  function toggleMedBatchItem(id: string) {
    medBatchSelected[id] = !medBatchSelected[id]
  }

  function resetBatchTaskIds(nextMap: Record<string, string>) {
    Object.keys(batchTaskIdByDogId).forEach(key => delete batchTaskIdByDogId[key])
    Object.assign(batchTaskIdByDogId, nextMap)
  }

  return {
    showQuickComplete,
    quickCompleteTask,
    quickCompleteNotes,
    quickCompleteDate,
    showQuickCompleteDatePicker,
    quickCompleteDateStr,
    onQuickCompleteDateConfirm,
    showPostponeModal,
    postponeTaskId,
    postponeDate,
    postponeQuick,
    showPostponeDatePicker,
    postponeTaskInfo,
    postponeDateStr,
    setPostponeQuick,
    onPostponeDateConfirm,
    showBatchComplete,
    batchCompleteTitle,
    batchDogList,
    batchSelected,
    batchTaskIdByDogId,
    resetBatchTaskIds,
    showSickBatch,
    sickBatchList,
    sickBatchSelected,
    showMedBatch,
    medBatchList,
    medBatchSelected,
    showBreedingActionSheet,
    breedingActionCard,
    breedingActionItems,
    breedingActionStageTitle,
    breedingActionAlertDanger,
    breedingActionSummary,
    showSickMenu,
    sickMenuDog,
    sickMenuItems,
    showStopConfirm,
    stopConfirmData,
    batchSelectedCount,
    isAllSelected,
    sickBatchSelectedCount,
    isAllSickBatchSelected,
    medBatchSelectedCount,
    isAllMedBatchSelected,
    medBatchRecoverCount,
    toggleSelectAll,
    toggleBatchDog,
    toggleSelectAllSickBatch,
    toggleSickBatchItem,
    toggleSelectAllMedBatch,
    toggleMedBatchItem,
  }
}
