import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSyncScopeForRoute } from '../../src/localdb/scope-registry'

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('local-first source contract', () => {
  it('应确保纯选择组件不再直接读取云端', () => {
    const selectorFiles = [
      'src/components/form/BDogPicker.vue',
      'src/components/form/BLitterSelector.vue',
      'src/components/form/BCycleSelector.vue',
      'src/components/form/BFinanceLinkSheet.vue',
    ]

    for (const file of selectorFiles) {
      const source = readWorkspaceFile(file)
      expect(source).not.toContain('useCloudCall')
      expect(source).not.toContain('cloudCall(')
      expect(source).not.toContain('uniCloud.database(')
    }
  })

  it('应为 pages.json 中每个路由提供同步归类', () => {
    const pagesConfig = JSON.parse(readWorkspaceFile('src/pages.json'))
    const routes: string[] = []

    for (const page of pagesConfig.pages || []) {
      routes.push(page.path)
    }

    for (const subPackage of pagesConfig.subPackages || []) {
      for (const page of subPackage.pages || []) {
        routes.push(`${subPackage.root}/${page.path}`)
      }
    }

    for (const route of routes) {
      expect(resolveSyncScopeForRoute(route), `missing scope for ${route}`).not.toBeNull()
    }
  })
})
