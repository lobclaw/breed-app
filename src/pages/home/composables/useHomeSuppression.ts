import { ref } from 'vue'

export function useHomeSuppression() {
  const suppressedTaskMap = ref<Record<string, number>>({})

  function pruneSuppressedTasks() {
    const now = Date.now()
    Object.entries(suppressedTaskMap.value).forEach(([taskId, expiresAt]) => {
      if (expiresAt <= now) delete suppressedTaskMap.value[taskId]
    })
  }

  function addSuppressedTasks(taskIds: string[] = [], duration = 2500) {
    if (!taskIds.length) return
    const expiresAt = Date.now() + duration
    taskIds.forEach((taskId) => {
      if (taskId) suppressedTaskMap.value[taskId] = expiresAt
    })
  }

  function filterSuppressibleTaskIds(taskIds: string[] = []) {
    return taskIds.filter(taskId => taskId && !taskId.startsWith('synthetic_breeding_milestone:'))
  }

  function isTaskSuppressed(taskId?: string) {
    if (!taskId) return false
    pruneSuppressedTasks()
    return !!suppressedTaskMap.value[taskId]
  }

  function resetSuppressedTasks() {
    suppressedTaskMap.value = {}
  }

  return {
    addSuppressedTasks,
    filterSuppressibleTaskIds,
    isTaskSuppressed,
    pruneSuppressedTasks,
    resetSuppressedTasks,
    suppressedTaskMap,
  }
}
