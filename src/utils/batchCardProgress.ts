export interface BatchCardDogLike {
  dogId?: string
  dog_id?: string
  completed?: boolean
  [key: string]: unknown
}

export interface BatchCardProgressState {
  activeDogIds: Set<string>
  checkedDogIds: Set<string>
  doneCount: number
  totalDogs: number
  allDone: boolean
}

export function getBatchCardDogId(dog: BatchCardDogLike | null | undefined): string | undefined {
  if (!dog || typeof dog !== 'object') return undefined
  return dog.dogId || dog.dog_id
}

export function resolveBatchCardProgress(
  dogs: readonly BatchCardDogLike[] = [],
  checkedDogIds: Iterable<string> = [],
): BatchCardProgressState {
  const activeDogIds = new Set<string>()

  dogs.forEach((dog) => {
    const dogId = getBatchCardDogId(dog)
    if (dogId) activeDogIds.add(dogId)
  })

  const normalizedCheckedDogIds = new Set<string>()
  for (const dogId of checkedDogIds) {
    if (activeDogIds.has(dogId)) normalizedCheckedDogIds.add(dogId)
  }

  const totalDogs = dogs.length
  const doneCount = dogs.reduce((count, dog) => {
    if (dog.completed) return count + 1
    const dogId = getBatchCardDogId(dog)
    return dogId && normalizedCheckedDogIds.has(dogId) ? count + 1 : count
  }, 0)

  return {
    activeDogIds,
    checkedDogIds: normalizedCheckedDogIds,
    doneCount,
    totalDogs,
    allDone: totalDogs > 0 && doneCount === totalDogs,
  }
}
