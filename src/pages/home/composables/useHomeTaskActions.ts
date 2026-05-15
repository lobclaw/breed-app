import { localSyncRuntime } from '@/localdb/runtime'

type RecoverIllnessesInput = {
  illnessIds: string[]
  medicationTaskIds?: string[]
}

type UpdateIllnessStatusInput = {
  illnessIds: string[]
  status: string
}

export function useHomeTaskActions(options: {
  getFamilyId: () => string
}) {
  function getFamilyId() {
    return options.getFamilyId()
  }

  async function doCompleteTask(taskId: string, autoRecord?: boolean) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.completeTaskLocally(familyId, taskId, Boolean(autoRecord))
  }

  async function doPostponeTask(taskId: string, newDate: number) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.postponeTasksLocally(familyId, [taskId], newDate)
  }

  async function doBatchComplete(taskIds: string[], autoRecord?: boolean) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.batchCompleteTasksLocally(familyId, taskIds, Boolean(autoRecord))
  }

  async function doBatchPostponeTask(taskIds: string[], newDate: number) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.postponeTasksLocally(familyId, taskIds, newDate)
  }

  async function doRecordMedDose(medicationTaskId: string) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.recordMedicationDoseLocally(familyId, medicationTaskId)
  }

  async function doBatchCompleteMedDay(medicationTaskIds: string[]) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.batchCompleteMedicationDayLocally(familyId, medicationTaskIds)
  }

  async function recoverIllnesses(input: RecoverIllnessesInput) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.recoverIllnessesLocally(familyId, input.illnessIds || [], input.medicationTaskIds || [])
  }

  async function batchUpdateIllnessStatus(input: UpdateIllnessStatusInput) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.updateIllnessStatusLocally(familyId, input.illnessIds || [], input.status)
  }

  async function endMedication(dogId: string) {
    const familyId = getFamilyId()
    if (!familyId) return null
    return localSyncRuntime.endMedicationByDogLocally(familyId, dogId)
  }

  return {
    doCompleteTask,
    doPostponeTask,
    doBatchComplete,
    doBatchPostponeTask,
    doRecordMedDose,
    doBatchCompleteMedDay,
    recoverIllnesses,
    batchUpdateIllnessStatus,
    endMedication,
  }
}
