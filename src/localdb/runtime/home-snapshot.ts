import { localDb } from '@/localdb/db'
import {
  buildLocalDateCounts,
  buildLocalHomeCards,
  buildLocalWeekCards,
  buildPendingBreedingMilestones,
  type HomeProjectionEntities,
} from '@/localdb/home-projection'
import { getBeijingDayStart } from '@/utils/date'

const HOME_PROJECTION_MEMO_LIMIT = 24

const homeEntitiesCache: {
  revisionKey: string
  entities: HomeProjectionEntities
} = {
  revisionKey: '',
  entities: {
    dogs: [],
    tasks: [],
    health_records: [],
    medication_tasks: [],
  },
}

type HomeEntitiesSnapshot = {
  revisionKey: string
  entities: HomeProjectionEntities
}

let homeEntitiesPromise: Promise<HomeEntitiesSnapshot> | null = null
let homeEntitiesPromiseKey = ''
const homeProjectionMemo = new Map<string, unknown>()

export function clearHomeEntitiesCache() {
  homeEntitiesCache.revisionKey = ''
  homeEntitiesCache.entities = {
    dogs: [],
    tasks: [],
    health_records: [],
    medication_tasks: [],
  }
  homeEntitiesPromise = null
  homeEntitiesPromiseKey = ''
  homeProjectionMemo.clear()
}

async function getHomeRevisionKey(familyId: string) {
  return (await Promise.all([
    Promise.resolve(familyId),
    localDb.getCollectionRevision('dogs'),
    localDb.getCollectionRevision('tasks'),
    localDb.getCollectionRevision('health_records'),
    localDb.getCollectionRevision('medication_tasks'),
  ])).join(':')
}

function memoizeHomeProjection<T>(key: string, build: () => T): T {
  if (homeProjectionMemo.has(key)) return homeProjectionMemo.get(key) as T
  const value = build()
  homeProjectionMemo.set(key, value)
  if (homeProjectionMemo.size > HOME_PROJECTION_MEMO_LIMIT) {
    const oldestKey = homeProjectionMemo.keys().next().value
    if (oldestKey) homeProjectionMemo.delete(oldestKey)
  }
  return value
}

async function getHomeEntitiesSnapshot(familyId = ''): Promise<HomeEntitiesSnapshot> {
  if (!familyId) {
    const [dogs, tasks, health_records, medication_tasks] = await Promise.all([
      localDb.getReadonlyTable<any>('dogs'),
      localDb.getReadonlyTable<any>('tasks'),
      localDb.getReadonlyTable<any>('health_records'),
      localDb.getReadonlyTable<any>('medication_tasks'),
    ])
    return {
      revisionKey: await getHomeRevisionKey(familyId),
      entities: { dogs, tasks, health_records, medication_tasks },
    }
  }

  const revisionKey = await getHomeRevisionKey(familyId)
  if (homeEntitiesCache.revisionKey === revisionKey) {
    return { revisionKey, entities: homeEntitiesCache.entities }
  }
  if (homeEntitiesPromise && homeEntitiesPromiseKey === revisionKey) return homeEntitiesPromise

  const promise = (async () => {
    try {
      const [dogs, tasks, health_records, medication_tasks] = await Promise.all([
        localDb.getRowsByFamilyReadonly<any>('dogs', familyId),
        localDb.getRowsByFamilyReadonly<any>('tasks', familyId),
        localDb.getRowsByFamilyReadonly<any>('health_records', familyId),
        localDb.getRowsByFamilyReadonly<any>('medication_tasks', familyId),
      ])

      const entities = { dogs, tasks, health_records, medication_tasks }
      homeEntitiesCache.revisionKey = revisionKey
      homeEntitiesCache.entities = entities
      return { revisionKey, entities }
    } finally {
      homeEntitiesPromise = null
      homeEntitiesPromiseKey = ''
    }
  })()
  homeEntitiesPromise = promise
  homeEntitiesPromiseKey = revisionKey

  return promise
}

export async function getHomeEntities(familyId = ''): Promise<HomeProjectionEntities> {
  return (await getHomeEntitiesSnapshot(familyId)).entities
}

export async function getMemoizedHomeCards(familyId: string, now = Date.now()) {
  const { entities, revisionKey } = await getHomeEntitiesSnapshot(familyId)
  if (!familyId) return buildLocalHomeCards(entities, now, familyId)
  const todayKey = getBeijingDayStart(now)
  return memoizeHomeProjection(
    `home:${familyId}:${todayKey}:${revisionKey}`,
    () => buildLocalHomeCards(entities, now, familyId),
  )
}

export async function getMemoizedHomeDateCounts(familyId: string, startDate: number, endDate: number) {
  const { entities, revisionKey } = await getHomeEntitiesSnapshot(familyId)
  if (!familyId) return buildLocalDateCounts(entities, startDate, endDate, familyId)
  return memoizeHomeProjection(
    `dateCounts:${familyId}:${getBeijingDayStart(startDate)}:${getBeijingDayStart(endDate)}:${revisionKey}`,
    () => buildLocalDateCounts(entities, startDate, endDate, familyId),
  )
}

export async function getMemoizedHomeWeekCards(familyId: string, startDate: number, endDate: number, now = Date.now()) {
  const { entities, revisionKey } = await getHomeEntitiesSnapshot(familyId)
  if (!familyId) return buildLocalWeekCards(entities, startDate, endDate, now, familyId)
  const todayKey = getBeijingDayStart(now)
  return memoizeHomeProjection(
    `weekCards:${familyId}:${getBeijingDayStart(startDate)}:${getBeijingDayStart(endDate)}:${todayKey}:${revisionKey}`,
    () => buildLocalWeekCards(entities, startDate, endDate, now, familyId),
  )
}

export async function materializeBreedingMilestonesForFamily(familyId: string) {
  if (!familyId) return []
  let materialized: any[] = []
  await localDb.transact(['breeding_cycles', 'breeding_records', 'tasks'], (tables) => {
    const entities = {
      dogs: [],
      health_records: [],
      medication_tasks: [],
      tasks: (tables.tasks as any[]).filter(row => row.family_id === familyId),
      breeding_cycles: (tables.breeding_cycles as any[]).filter(row => row.family_id === familyId),
      breeding_records: (tables.breeding_records as any[]).filter(row => row.family_id === familyId),
    }
    const nextTasks: any[] = buildPendingBreedingMilestones(entities).map((task) => {
      const { _synthetic_local: _ignored, ...rest } = task
      return {
        ...rest,
        version: Number(task.version || 0),
        _local_pending: task._local_pending ?? true,
      }
    })
    if (!nextTasks.length) return
    const taskMap = new Map((tables.tasks as any[]).map(row => [row._id, row]))
    nextTasks.forEach((task) => {
      if (!taskMap.has(task._id)) taskMap.set(task._id, task)
    })
    tables.tasks = Array.from(taskMap.values())
    materialized = nextTasks
  })
  if (materialized.length) clearHomeEntitiesCache()
  return materialized
}

export async function buildHomeSnapshot(input: {
  familyId: string
  dateCountsStartDate: number
  dateCountsEndDate: number
  weekStartDate: number
  weekEndDate: number
  now: number
}) {
  return {
    home: await getMemoizedHomeCards(input.familyId, input.now),
    dateCounts: await getMemoizedHomeDateCounts(input.familyId, input.dateCountsStartDate, input.dateCountsEndDate),
    weekCards: await getMemoizedHomeWeekCards(input.familyId, input.weekStartDate, input.weekEndDate, input.now),
  }
}
