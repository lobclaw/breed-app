import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/record/breeding-detail.vue'), 'utf8')

describe('breeding-detail source contract', () => {
  it('应为繁育记录详情提供完整类型映射，而不是直接暴露内部 type key', () => {
    expect(source).toContain("follicle_check: { label: '卵泡检查'")
    expect(source).toContain("prenatal_check: { label: '产检'")
    expect(source).toContain("pre_labor: { label: '临产监测'")
    expect(source).toContain("abnormal_termination: { label: '异常终止'")
  })

  it('应展示卵泡检查详情字段', () => {
    expect(source).toContain("<!-- 卵泡检查 -->")
    expect(source).toContain('左侧卵泡')
    expect(source).toContain('右侧卵泡')
    expect(source).toContain("function getFollicleSideText")
  })

  it('应兼容孕检新旧字段口径', () => {
    expect(source).toContain('function getPregnancyResult')
    expect(source).toContain('details.confirmed === \'是\'')
    expect(source).toContain('details.fetus_count || details.puppy_count || details.count')
  })

  it('孕检和产检详情应展示检查图片并使用 display URL 预览', () => {
    expect(source).toContain("['pregnancy_check', 'prenatal_check'].includes(record.value?.type)")
    expect(source).toContain('record.value?.details?.images || record.value?.images || []')
    expect(source).toContain('resolveImageDisplayUrls')
    expect(source).toContain('resolveImageSafeSrc')
    expect(source).toContain('uni.previewImage')
  })

  it('检查图片缩略图应使用固定宽高避免被原图比例撑开', () => {
    expect(source).toContain('class="info-row image-section__header"')
    expect(source).toContain('.image-thumb {')
    expect(source).toContain('width: 78px;')
    expect(source).toContain('height: 78px;')
    expect(source).not.toContain('aspect-ratio: 1;')
  })

  it('编辑入口应按繁育记录类型直达对应表单页并排除生产记录', () => {
    expect(source).toContain('buildBreedingRecordEditUrl(record.value.type, recordId)')
    expect(source).toContain('当前记录暂不支持编辑')
  })
})
