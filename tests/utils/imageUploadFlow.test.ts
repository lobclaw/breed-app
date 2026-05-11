import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('image upload flow source contract', () => {
  it('BImageUpload 应只保存本地图片引用，不直接上传云端', () => {
    const content = source('src/components/form/BImageUpload.vue')

    expect(content).toContain('chooseLocalImages')
    expect(content).toContain('resolveImageDisplayUrls')
    expect(content).not.toContain('uniCloud.uploadFile')
  })

  it('财务图片入口不应直接保存 chooseImage 临时路径', () => {
    const files = [
      'src/pages/finance/expense-add.vue',
      'src/pages/finance/expense-edit.vue',
      'src/pages/finance/income-edit.vue',
    ]

    files.forEach((file) => {
      const content = source(file)
      expect(content).toContain('chooseLocalImages')
      expect(content).toContain('resolveImageDisplayUrls')
      expect(content).not.toContain('tempFilePaths')
      expect(content).not.toContain('uni.chooseImage')
    })
  })

  it('图片详情页预览应使用解析后的 display URL', () => {
    const expenseDetail = source('src/pages/finance/expense-detail.vue')
    const incomeDetail = source('src/pages/finance/income-detail.vue')

    expect(expenseDetail).toContain('resolveImageDisplayUrls')
    expect(expenseDetail).toContain('resolveImageSafeSrc')
    expect(expenseDetail).toContain('imageDisplayUrls')
    expect(incomeDetail).toContain('resolveImageDisplayUrls')
    expect(incomeDetail).toContain('resolveImageSafeSrc')
    expect(incomeDetail).toContain('imageDisplayUrls')
  })

  it('账号头像应复用统一上传工具并保留联网提示', () => {
    const content = source('src/uni_modules/uni-id-pages/components/uni-id-pages-avatar/uni-id-pages-avatar.vue')

    expect(content).toContain('prepareLocalImage')
    expect(content).toContain('uploadLocalImage')
    expect(content).toContain('当前功能需要联网')
  })

  it('同步状态页应展示并优先处理附件待上传问题', () => {
    const statusSource = source('src/localdb/sync-status.ts')
    const pageSource = source('src/pages/profile/sync-status.vue')

    expect(statusSource).toContain('pendingUploadIssues')
    expect(statusSource).toContain('图片临时路径已失效，请重新选择图片')
    expect(pageSource).toContain('pending_upload')
    expect(pageSource).toContain('上传附件')
    expect(pageSource).toContain('处理附件问题')
    expect(pageSource).toContain('firstStaleUploadIssue')
    expect(pageSource).toContain('去处理')
    expect(pageSource).toContain('/pages/finance/expense-edit?')
    expect(pageSource).toContain('/pages/finance/income-edit?')
    expect(pageSource).toContain('getLocalBreedingRecordDetail')
    expect(pageSource).toContain('getLocalHealthRecordDetail')
    expect(pageSource).toContain('buildBreedingRecordEditUrl')
    expect(pageSource).toContain('buildHealthRecordEditUrl')
    expect(pageSource).toContain('uni.navigateTo({ url })')
    expect(pageSource).toContain('syncStatus.pendingUpload > 0')
    expect(pageSource).toContain('await localSyncRuntime.syncPendingAttachmentsNow(familyId)')
    expect(pageSource).toContain('loadStatusAndAutoSync')
    expect(pageSource).toContain('syncPendingUploads({ silent: true })')
    expect(pageSource.indexOf('syncStatus.pendingUpload > 0')).toBeLessThan(pageSource.indexOf('await forceSyncActiveScope()'))
  })
})
