import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCAL_MUTATION_REGISTRY, LOCAL_MUTATION_TYPES } from '../../src/localdb/mutation-registry'

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('local mutation registry coverage', () => {
  it('每个语义 mutation 都应有云对象映射和文档矩阵', () => {
    const matrix = readWorkspaceFile('docs/sync-mutation-matrix.md')
    const mutationTypes = Object.values(LOCAL_MUTATION_TYPES)

    for (const mutationType of mutationTypes) {
      const definition = LOCAL_MUTATION_REGISTRY[mutationType]
      expect(definition, `${mutationType} missing registry definition`).toBeTruthy()
      expect(definition.service, `${mutationType} missing cloud service`).toMatch(/-service$/)
      expect(definition.method, `${mutationType} missing cloud method`).toBeTruthy()
      expect(definition.defaultScopes, `${mutationType} missing default scopes`).toBeInstanceOf(Array)
      expect(matrix, `${mutationType} missing sync mutation matrix row`).toContain(`\`${mutationType}\``)
      expect(matrix, `${mutationType} missing cloud method in matrix`).toContain(`${definition.service}.${definition.method}`)
    }
  })
})
