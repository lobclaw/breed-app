import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/breeding/birth-wizard.vue'), 'utf8')

describe('birth-wizard source contract', () => {
  it('Step 2 应保留昵称选填并补充自动命名弱提示', () => {
    expect(source).toContain('标识/昵称 <text class="optional">（选填）</text>')
    expect(source).toContain('未填写时将自动生成默认名称')
    expect(source).toContain(':placeholder="`${damName}窝-${idx + 1}号`"')
  })

  it('Step 3 应包含经验心得与首次健康提醒勾选项', () => {
    expect(source).toContain('经验心得 <text class="optional">（选填）</text>')
    expect(source).toContain('首次驱虫提醒')
    expect(source).toContain('首次疫苗提醒')
    expect(source).toContain('仅创建待办，后续补录时再选择具体驱虫类型')
    expect(source).toContain('仅创建待办，后续补录时再选择具体疫苗类型')
  })

  it('提交时应携带显式提醒字段，并继续走品牌主色按钮', () => {
    expect(source).toContain('create_first_deworming_task: form.create_first_deworming_task')
    expect(source).toContain('create_first_vaccination_task: form.create_first_vaccination_task')
    expect(source).toContain('class="btn-next"')
    expect(source).not.toContain('class="btn-next btn-next--submit"')
    expect(source).not.toContain('&--submit {')
  })
})
