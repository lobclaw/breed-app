import { localDb } from '@/localdb/db'
import type { Family } from '@/types/family'

type SortableRecentRow = {
  updated_at?: number | string | null
  date?: number | string | null
  created_at?: number | string | null
}

export function sortByRecent(left: SortableRecentRow, right: SortableRecentRow) {
  return Number(right.updated_at || right.date || right.created_at || 0) - Number(left.updated_at || left.date || left.created_at || 0)
}

export async function getLocalFamilyRow(familyId: string): Promise<Family | null> {
  if (!familyId) return null
  const family = await localDb.findById<Family>('families', familyId)
  return family && family._id === familyId ? family : null
}
