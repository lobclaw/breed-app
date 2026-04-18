import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

type SubmitState = 'idle' | 'submitting' | 'success'

interface SubmitStateOptions {
  idleLabel: MaybeRefOrGetter<string>
  successLabel: MaybeRefOrGetter<string>
  submittingLabel?: MaybeRefOrGetter<string>
}

export function useRecordSubmitState(options: SubmitStateOptions) {
  const submitState = ref<SubmitState>('idle')

  const submitButtonText = computed(() => {
    if (submitState.value === 'submitting') {
      return toValue(options.submittingLabel) || '提交中...'
    }
    if (submitState.value === 'success') {
      return toValue(options.successLabel)
    }
    return toValue(options.idleLabel)
  })

  function markSubmitting() {
    submitState.value = 'submitting'
  }

  function markSuccess() {
    submitState.value = 'success'
  }

  function resetSubmitState() {
    submitState.value = 'idle'
  }

  return {
    submitState,
    submitButtonText,
    markSubmitting,
    markSuccess,
    resetSubmitState,
  }
}
