import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/breeding/birth-wizard.vue'), 'utf8')

describe('birth-wizard source contract', () => {
  it('母犬名称不应使用测试犬名兜底，应缺省为空并从本地周期补齐', () => {
    expect(source).toContain("const cycleId = ref('')")
    expect(source).toContain("const damName = ref('')")
    expect(source).toContain('const selectedDam = ref<any>(null)')
    expect(source).toContain("const damDisplayName = computed(() => damName.value || selectedDam.value?.name || '未选择母犬')")
    expect(source).toContain('async function loadDamNameFromLocalCycle()')
    expect(source).toContain("findLocal<any>('breeding_cycles', cycleId.value)")
    expect(source).not.toContain("const damName = ref('花花')")
  })

  it('自由入口应通过种母选择解析怀孕周期，不在加载时直接提示缺少周期', () => {
    expect(source).toContain('<text class="page-title">录入生产</text>')
    expect(source).toContain('BBreedingContextCard')
    expect(source).toContain(':meta-text="selectedDamContextText"')
    expect(source).toContain('empty-meta="怀孕中的种母"')
    expect(source).toContain('<BDogPicker')
    expect(source).toContain('v-model:visible="damPickerVisible"')
    expect(source).toContain(":candidate-dogs=\"birthCandidateDogs\"")
    expect(source).toContain(':show-breeding-stage="true"')
    expect(source).toContain("getEligibleBreedingDogs(dogStore.list, 'birth')")
    expect(source).toContain('getBirthCycleIdFromDog(dog)')
    expect(source).toContain('cycleId.value = birthCycleId')
    expect(source).toContain(":readonly=\"cycleLocked\"")
    expect(source).toContain('getLocalBreedingCycleFormContext')
    expect(source).toContain('buildBreedingCycleMetaText')

    const onLoadSource = source.slice(source.indexOf('onLoad((query) => {'))
    expect(onLoadSource).not.toContain("uni.showToast({ title: '缺少周期信息'")
  })

  it('Step 2 应保留昵称选填并补充自动命名弱提示', () => {
    expect(source).toContain('标识/昵称 <text class="optional">（选填）</text>')
    expect(source).toContain('未填写时将自动生成默认名称')
    expect(source).toContain(':placeholder="getDefaultPuppyName(idx)"')
    expect(source).toContain('function getDefaultPuppyName(idx: number)')
    expect(source).toContain("return `${defaultPuppyDamName.value}${previewLitterNumber.value || 1}窝-${idx + 1}号`")
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

  it('Step 1 未选择种母时下一步按钮应保持禁用态', () => {
    expect(source).toContain("if (step.value === 1) return !!cycleId.value && !!form.birth_date")
    expect(source).toContain(':disabled="!canNext"')
    expect(source).not.toContain(':disabled="step === 1 ? !form.birth_date : !canNext"')
  })

  it('底部按钮应参与页面布局，不遮挡 Step 2 滚动内容', () => {
    expect(source).toContain('class="form-scroll"')
    expect(source).toContain('.form-scroll')
    expect(source).toContain('height: 100vh;')
    expect(source).toContain('flex-direction: column;')
    const footerStyle = source.slice(source.indexOf('.btn-footer {'), source.indexOf('.btn-back {'))
    expect(footerStyle).toContain('flex-shrink: 0;')
    expect(footerStyle).not.toContain('position: fixed')
    expect(source).not.toContain('btn-footer-spacer')
  })

  it('添加下一只后应自动滚动到底部并在切换步骤时回到顶部', () => {
    expect(source).toContain(':scroll-top="formScrollTop"')
    expect(source).toContain('scroll-with-animation')
    expect(source).toContain('const formScrollTop = ref(0)')
    expect(source).toContain('const FORM_SCROLL_BOTTOM_STEP = 100000')
    expect(source).toContain('async function addPuppy()')
    expect(source).toContain('await nextTick()')
    expect(source).toContain('scrollFormToBottom()')
    expect(source).toContain('formScrollTop.value += FORM_SCROLL_BOTTOM_STEP')
    expect(source).toContain('watch(step, async () => {')
    expect(source).toContain('scrollFormToTop()')
  })
})
