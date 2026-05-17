import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/record/BreedingRecordForm.vue'), 'utf8')

describe('breeding record form source contract', () => {
  it('本地合成的繁育 milestone 不应被当成真实待办完成', () => {
    expect(source).toContain('const prefillTaskIsPersisted = ref(false)')
    expect(source).toContain('prefillTaskIsPersisted.value = true')
    expect(source).toContain('if (prefillTaskId.value && prefillTaskIsPersisted.value)')
    expect(source).toContain('const completedTaskIds = prefillTaskId.value && prefillTaskIsPersisted.value ? [prefillTaskId.value] : []')
    expect(source).toContain('message: buildRecordFeedbackMessage(1, completedTaskIds.length)')
  })

  it('异常终止类型应按当前周期状态过滤放弃配种', () => {
    expect(source).toContain("const ABANDON_MATING_TERMINATION = '放弃配种'")
    expect(source).toContain("if (terminationCycleStatus.value === '发情中') return [ABANDON_MATING_TERMINATION]")
    expect(source).toContain('return pregnancyTerminationTypes')
    expect(source).toContain("visibleTerminationTypes.value.includes(typeof details.termination_type === 'string' ? details.termination_type : '')")
    expect(source).toContain('details.termination_type = \'\'')
  })

  it('孕检和产检都应支持检查图片并保存到 details.images', () => {
    const pregnancySection = source.slice(
      source.indexOf("<template v-if=\"breedingType === 'pregnancy_check'\">"),
      source.indexOf("<template v-if=\"breedingType === 'prenatal_check'\">"),
    )
    const prenatalSection = source.slice(
      source.indexOf("<template v-if=\"breedingType === 'prenatal_check'\">"),
      source.indexOf("<template v-if=\"breedingType === 'pre_labor'\">"),
    )

    expect(pregnancySection).toContain('<BImageUpload v-model="images" :max="6" />')
    expect(prenatalSection).toContain('<BImageUpload v-model="images" :max="6" />')
    expect(source).toContain("if (breedingType.value === 'pregnancy_check') {\n    if (details.confirmed) built.confirmed = details.confirmed\n    if (details.puppy_count) built.puppy_count = parseInt(String(details.puppy_count))\n    if (images.value.length > 0) built.images = images.value\n  }")
    expect(source).toContain("if (breedingType.value === 'prenatal_check') {\n    if (details.results) built.results = details.results\n    if (images.value.length > 0) built.images = images.value\n  }")
    expect(source).toContain("if (record.type === 'pregnancy_check' || record.type === 'prenatal_check') {\n        images.value = toStringList(recordDetails.images)\n      }")
  })

  it('产检应要求检查结果或检查图片至少填写一项', () => {
    expect(source).toContain('检查结果和检查图片至少填写一项')
    expect(source).toContain("const hasPrenatalCheckContent = computed(() => {\n  return !!String(details.results || '').trim() || images.value.length > 0\n})")
    expect(source).toContain("if (breedingType.value === 'prenatal_check') return hasPrenatalCheckContent.value")
  })

  it('单犬繁育记录应使用专用上下文卡，标题保持动作型', () => {
    expect(source).toContain('BBreedingContextCard')
    expect(source).toContain('const pageTitle = computed(() => {')
    expect(source).toContain("const title = breedingType.value ? createTitles[breedingType.value] : '录入繁育记录'")
    expect(source).toContain("if (isEdit.value) return title.replace(/^录入/, '编辑')")
    expect(source).not.toContain('记录类型')
    expect(source).not.toContain('type-display')
    expect(source).toContain('const selectedCycleContextText = computed')
    expect(source).toContain('const selectedLatestHeatText = computed')
    expect(source).toContain('const singleDogContextEmptyMeta = computed')
    expect(source).toContain(':empty-meta="singleDogContextEmptyMeta"')
    expect(source).toContain("if (breedingType.value === 'abnormal_termination') return '发情中或怀孕中的种母'")
    expect(source).toContain('return buildBreedingCycleMetaText(cycleFormContext.value) || selectedLatestHeatText.value')
    expect(source).toContain('getLocalBreedingCycleFormContext')
    expect(source).toContain('buildBreedingCycleMetaText')
    expect(source).toContain('avatar-variant="sire"')
    expect(source).toContain('v-if="isHeatMultiCreate"')
    expect(source).toContain('v-if="shouldShowSingleDogContext"')
    expect(source).toContain('<view v-if="isHeatMultiCreate" class="field-label"><text>选择种母</text></view>')
    expect(source).not.toContain('getLocalBreedingCycleDetail')
    expect(source).not.toContain('breedingDogExtraMetaMap')
    expect(source).not.toContain('选择后显示繁育周期信息')
  })

  it('发情观察字段组不应使用小圆点标题', () => {
    expect(source).toContain('heat-observation__label')
    expect(source).not.toContain('heat-observation__label-dot')
  })

  it('发情观察单选和多选应使用不同选中样式', () => {
    expect(source).toContain('.heat-observation__segment--active {\n  background: var(--primary);')
    expect(source).toContain('.heat-observation__segment--active .heat-observation__segment-text {\n  color: #fff;')
    expect(source).toContain('.heat-observation__symptom--selected {\n  background: var(--primary-soft);')
    expect(source).toContain('.heat-observation__symptom--selected .heat-observation__symptom-text {\n  color: var(--primary);')
  })
})
