import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/add.vue'), 'utf8')

describe('dog add/edit page source contract', () => {
  it('编辑犬只时角色区域应锁定，新建时仍保留角色选择', () => {
    expect(source).toContain(`<view class="role-selector" :class="{ 'role-selector--locked': isEdit }">`)
    expect(source).toContain(`@click="!isEdit && (form.role = r.value)"`)
    expect(source).toContain('角色创建后不可直接修改；幼崽升级请在详情页使用专门操作')
  })

  it('编辑犬只时应先承接 dogStore 缓存，再用本地镜像校准', () => {
    expect(source).toContain('const cachedDog = dogStore.list.find(dog => dog._id === editDogId)')
    expect(source).toContain('applyDogToForm(cachedDog, { syncOriginalName: true })')
    expect(source).toContain("const localDog = await localSyncRuntime.findLocal<any>('dogs', editDogId)")
    expect(source).toContain('applyDogToForm(localDog, { syncOriginalName: true })')
  })

  it('应复用同一套表单回填逻辑，避免缓存承接和详情回填分叉', () => {
    expect(source).toContain('function applyDogToForm(dog: any, { syncOriginalName = false } = {})')
    expect(source).toContain("purchasePriceInput.value = dog.purchase_price ? String(dog.purchase_price) : ''")
  })

  it('编辑犬只提交时不应继续通过普通更新接口主动传 role', () => {
    expect(source).toContain('const baseDogData = {')
    expect(source).toContain('await localSyncRuntime.updateDogLocally(currentFamily.value?._id || \'\', editDogId, baseDogData)')
    expect(source).toContain('const dogData = {')
    expect(source).toContain('role: form.role')
  })

  it('新建犬只成功后应把 targetDogId 写入 submit feedback 以便列表页返回承接', () => {
    expect(source).toContain("const createdDogId = res?.data?._id || ''")
    expect(source).toContain("targetDogId: createdDogId || undefined")
    expect(source).toContain("targetRoute: feedbackTargetRoute || undefined")
    expect(source).toContain("message: '已创建犬只'")
  })
})
