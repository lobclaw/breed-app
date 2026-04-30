import { describe, expect, it, vi } from 'vitest'

const syncUtils = require('../../uniCloud-alipay/cloudfunctions/common/breed-sync')

function createDbWithMissingSyncMutations() {
  const syncMutationCollection = {
    doc: () => ({
      async get() {
        throw new Error('not found collection')
      },
      async update() {
        throw new Error('not found collection')
      },
    }),
    async add() {
      throw new Error('not found collection')
    },
  }

  return {
    collection(name: string) {
      if (name === 'sync_mutations') return syncMutationCollection
      throw new Error(`unexpected collection ${name}`)
    },
  }
}

describe('breed-sync common module', () => {
  it('sync_mutations 集合未部署时应跳过幂等查询，不阻断业务写入', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const db = createDbWithMissingSyncMutations()

    await expect(syncUtils.findAppliedMutation(db, 'fam_1', 'mutation_1')).resolves.toBeNull()
    await expect(syncUtils.markMutationApplied(db, 'fam_1', 'mutation_1', { ok: true })).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith('[breed-sync] sync_mutations collection missing, skip idempotency lookup')
    expect(warnSpy).toHaveBeenCalledWith('[breed-sync] sync_mutations collection missing, skip idempotency mark')
    warnSpy.mockRestore()
  })
})
