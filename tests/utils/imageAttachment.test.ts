import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheUploadedImageLocalRef,
  chooseLocalImages,
  prepareLocalImage,
  resolveImageDisplayUrl,
  uploadLocalImage,
} from '@/utils/imageAttachment'
import { localDb } from '../../src/localdb/db'

const originalFetch = globalThis.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalDocument = globalThis.document
const originalImage = globalThis.Image

async function waitForCondition(assertion: () => boolean | Promise<boolean>) {
  for (let index = 0; index < 20; index += 1) {
    if (await assertion()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

function imageCacheEntryId(fileID: string) {
  const encoded = encodeURIComponent(fileID).replace(/[^a-zA-Z0-9_-]/g, (char) => {
    return `_${char.charCodeAt(0).toString(16).padStart(2, '0')}`
  })
  return `image_cache_${encoded}`
}

describe('imageAttachment', () => {
  beforeEach(async () => {
    await localDb.replaceTable('image_cache_entries', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('outbox_mutations', [])
    ;(globalThis as any).uni = {
      chooseImage: vi.fn(({ success }) => success({ tempFilePaths: ['tmp://photo.jpg'] })),
      getImageInfo: vi.fn(({ success }) => success({ width: 3000, height: 1500 })),
      compressImage: vi.fn(({ success }) => success({ tempFilePath: 'tmp://photo_compressed.jpg' })),
      getFileInfo: vi.fn(({ success }) => success({ size: 320 * 1024 })),
      saveFile: vi.fn(({ tempFilePath, success }) => success({ savedFilePath: `saved://${tempFilePath}` })),
    }
    ;(globalThis as any).uniCloud = {
      getTempFileURL: vi.fn(({ fileList }) => ({
        fileList: fileList.map((fileID: string) => ({
          fileID,
          tempFileURL: `https://temp.local/${fileID.replace('cloud://', '')}`,
        })),
      })),
    }
  })

  afterEach(() => {
    delete (globalThis as any).uni
    delete (globalThis as any).uniCloud
    ;(globalThis as any).fetch = originalFetch
    ;(globalThis as any).document = originalDocument
    ;(globalThis as any).Image = originalImage
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('选择图片后应压缩并保存为本地持久路径', async () => {
    const result = await chooseLocalImages(1)
    const uniApi = (globalThis as any).uni

    expect(result.paths).toEqual(['saved://tmp://photo_compressed.jpg'])
    expect(uniApi.chooseImage).toHaveBeenCalledWith(expect.objectContaining({
      count: 1,
      sizeType: ['compressed'],
    }))
    expect(uniApi.compressImage).toHaveBeenCalledWith(expect.objectContaining({
      src: 'tmp://photo.jpg',
      quality: 68,
      compressedWidth: 1024,
      compressedHeight: 512,
    }))
    expect(uniApi.saveFile).toHaveBeenCalledWith(expect.objectContaining({
      tempFilePath: 'tmp://photo_compressed.jpg',
    }))
  })

  it('压缩失败时应回退原图再持久化', async () => {
    ;(globalThis as any).uni.compressImage = vi.fn(({ fail }) => fail(new Error('compress failed')))

    const result = await prepareLocalImage('tmp://origin.jpg')

    expect(result.path).toBe('saved://tmp://origin.jpg')
    expect(result.persisted).toBe(true)
    expect(result.warning).toContain('compress failed')
  })

  it('省流量优先应按目标体积逐档降低质量和尺寸', async () => {
    const sizes = [900 * 1024, 700 * 1024, 520 * 1024, 320 * 1024]
    ;(globalThis as any).uni.getFileInfo = vi.fn(({ success }) => success({ size: sizes.shift() || 320 * 1024 }))
    ;(globalThis as any).uni.compressImage = vi.fn(({ quality, compressedWidth, success }) => {
      success({ tempFilePath: `tmp://photo_q${quality}_w${compressedWidth}.jpg` })
    })

    const result = await prepareLocalImage('tmp://origin.jpg', { profile: 'business' })

    expect(result.path).toBe('saved://tmp://photo_q48_w900.jpg')
    expect((globalThis as any).uni.compressImage).toHaveBeenCalledTimes(3)
    expect((globalThis as any).uni.compressImage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      quality: 68,
      compressedWidth: 1024,
    }))
    expect((globalThis as any).uni.compressImage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      quality: 58,
      compressedWidth: 1024,
    }))
    expect((globalThis as any).uni.compressImage).toHaveBeenNthCalledWith(3, expect.objectContaining({
      quality: 48,
      compressedWidth: 900,
    }))
  })

  it('不支持 saveFile 时应保留普通路径并返回警告', async () => {
    delete (globalThis as any).uni.saveFile

    const result = await prepareLocalImage('tmp://origin.jpg')

    expect(result.path).toBe('tmp://photo_compressed.jpg')
    expect(result.persisted).toBe(false)
    expect(result.warning).toBe('当前平台不支持本地持久保存图片')
    expect(result.recoverable).toBe(true)
  })

  it('saveFile 失败时选择图片不应返回阻塞性警告', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(globalThis as any).uni.saveFile = vi.fn(({ fail }) => fail(new Error('save failed')))

    const result = await chooseLocalImages(1)

    expect(result.paths).toEqual(['tmp://photo_compressed.jpg'])
    expect(result.warnings).toEqual([])
  })

  it('H5 blob 路径持久化失败时应转为 data URL 保存', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(globalThis as any).uni.compressImage = vi.fn(({ success }) => success({ tempFilePath: 'blob:http://localhost/photo' }))
    ;(globalThis as any).uni.saveFile = vi.fn(({ fail }) => fail(new Error('save failed')))
    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
    }))

    const result = await chooseLocalImages(1)

    expect(result.paths[0]).toMatch(/^data:image\/jpeg;base64,/)
    expect(result.warnings).toEqual([])
  })

  it('H5 缺少 uni.compressImage 时应使用 canvas 压缩 blob 图片', async () => {
    const drawImage = vi.fn()
    const toBlob = vi.fn((callback: (blob: Blob) => void, type: string, quality: number) => {
      callback(new Blob(['compressed-image'], { type }))
      expect(quality).toBe(0.68)
    })
    delete (globalThis as any).uni.compressImage
    delete (globalThis as any).uni.saveFile
    ;(globalThis as any).document = {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage })),
        toBlob,
      })),
    }
    ;(globalThis as any).Image = class {
      naturalWidth = 3000
      naturalHeight = 1500
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    const result = await prepareLocalImage('blob:http://localhost/origin.jpg', { profile: 'record' })

    expect(result.path).toMatch(/^data:image\/jpeg;base64,/)
    expect(result.compressed).toBe(true)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1024, 512)
    expect(result.size).toBe('compressed-image'.length)
  })

  it('上传 data URL 时应转为可上传的 Blob filePath', async () => {
    const uploadFile = vi.fn(async () => ({ fileID: 'cloud://uploaded.jpg' }))
    URL.createObjectURL = vi.fn(() => 'blob:uploadable-image')
    URL.revokeObjectURL = vi.fn()
    ;(globalThis as any).uniCloud.uploadFile = uploadFile

    const uploaded = await uploadLocalImage('data:image/jpeg;base64,aW1hZ2U=', {
      familyId: 'fam_1',
      collection: 'expenses',
      rowId: 'row_1',
    })

    expect(uploaded).toBe('cloud://uploaded.jpg')
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'blob:uploadable-image',
      fileType: 'image',
    }))
    expect(uploadFile.mock.calls[0][0]).not.toHaveProperty('fileContent')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:uploadable-image')
  })

  it('上传失效 blob 路径应给出重新选择提示', async () => {
    await expect(uploadLocalImage('blob:http://localhost/lost', {
      familyId: 'fam_1',
      collection: 'expenses',
      rowId: 'row_1',
    })).rejects.toThrow('图片临时路径已失效，请重新选择图片')
  })

  it('本地路径展示不应请求临时 URL', async () => {
    const url = await resolveImageDisplayUrl('saved://photo.jpg')

    expect(url).toBe('saved://photo.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).not.toHaveBeenCalled()
  })

  it('云 fileID 有本地缓存时应直接显示本地图片', async () => {
    await cacheUploadedImageLocalRef('cloud://bucket/cached.jpg', 'saved://cached-local.jpg', { familyId: 'fam_1' })

    const url = await resolveImageDisplayUrl('cloud://bucket/cached.jpg', { familyId: 'fam_1' })

    expect(url).toBe('saved://cached-local.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).not.toHaveBeenCalled()
  })

  it('无法验证本地缓存路径时应回退到云端临时 URL', async () => {
    delete (globalThis as any).uni.getFileInfo
    await localDb.upsertRows('image_cache_entries', [{
      _id: 'image_cache_unreadable',
      file_id: 'cloud://bucket/unreadable.jpg',
      family_id: 'fam_1',
      local_src: 'saved://missing-local.jpg',
      size: 100,
      created_at: 1000,
      last_accessed_at: 1000,
      updated_at: 1000,
    }])

    const url = await resolveImageDisplayUrl('cloud://bucket/unreadable.jpg', { familyId: 'fam_1' })

    expect(url).toBe('https://temp.local/bucket/unreadable.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).toHaveBeenCalledWith({
      fileList: ['cloud://bucket/unreadable.jpg'],
    })
  })

  it('云 fileID 展示前应转换为临时 URL', async () => {
    const url = await resolveImageDisplayUrl('cloud://bucket/photo.jpg')

    expect(url).toBe('https://temp.local/bucket/photo.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).toHaveBeenCalledWith({
      fileList: ['cloud://bucket/photo.jpg'],
    })
  })

  it('临时 URL 内存缓存应按家庭隔离', async () => {
    let callIndex = 0
    ;(globalThis as any).fetch = vi.fn(async () => ({ ok: false }))
    ;(globalThis as any).uniCloud.getTempFileURL = vi.fn(({ fileList }) => {
      callIndex += 1
      return {
        fileList: fileList.map((fileID: string) => ({
          fileID,
          tempFileURL: `https://temp.local/family-${callIndex}.jpg`,
        })),
      }
    })

    const firstFamilyUrl = await resolveImageDisplayUrl('cloud://bucket/family-cache.jpg', { familyId: 'fam_1' })
    const secondFamilyUrl = await resolveImageDisplayUrl('cloud://bucket/family-cache.jpg', { familyId: 'fam_2' })
    const secondFamilyCachedUrl = await resolveImageDisplayUrl('cloud://bucket/family-cache.jpg', { familyId: 'fam_2' })

    expect(firstFamilyUrl).toBe('https://temp.local/family-1.jpg')
    expect(secondFamilyUrl).toBe('https://temp.local/family-2.jpg')
    expect(secondFamilyCachedUrl).toBe('https://temp.local/family-2.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).toHaveBeenCalledTimes(2)
  })

  it('云 fileID 无本地缓存时应返回临时 URL 并后台写入本地缓存', async () => {
    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['remote-image'], { type: 'image/jpeg' }),
    }))

    const url = await resolveImageDisplayUrl('cloud://bucket/cache-miss.jpg', { familyId: 'fam_1' })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(url).toBe('https://temp.local/bucket/cache-miss.jpg')
    const rows = await localDb.getTable<any>('image_cache_entries')
    expect(rows).toEqual([expect.objectContaining({
      file_id: 'cloud://bucket/cache-miss.jpg',
      family_id: 'fam_1',
      local_src: expect.stringMatching(/^data:image\/jpeg;base64,/),
    })])
  })

  it('后台写入本地缓存失败不应影响临时 URL 展示', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(localDb, 'upsertRows').mockRejectedValueOnce(new Error('cache write failed'))
    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['remote-image'], { type: 'image/jpeg' }),
    }))

    const url = await resolveImageDisplayUrl('cloud://bucket/cache-write-fail.jpg', { familyId: 'fam_1' })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(url).toBe('https://temp.local/bucket/cache-write-fail.jpg')
  })

  it('LRU 清理不应删除仍被保留缓存引用的同一本地文件', async () => {
    const removeSavedFile = vi.fn(({ success }) => success({}))
    ;(globalThis as any).uni.removeSavedFile = removeSavedFile
    const sharedLocalSrc = 'saved://shared-local.jpg'
    await localDb.replaceTable('image_cache_entries', [
      {
        _id: imageCacheEntryId('cloud://bucket/stale.jpg'),
        file_id: 'cloud://bucket/stale.jpg',
        family_id: 'fam_1',
        local_src: sharedLocalSrc,
        size: 100,
        created_at: 1000,
        last_accessed_at: 1000,
        updated_at: 1000,
      },
      {
        _id: imageCacheEntryId('cloud://bucket/fresh.jpg'),
        file_id: 'cloud://bucket/fresh.jpg',
        family_id: 'fam_1',
        local_src: sharedLocalSrc,
        size: 100,
        created_at: Date.now(),
        last_accessed_at: Date.now(),
        updated_at: Date.now(),
      },
    ])

    await resolveImageDisplayUrl('cloud://bucket/fresh.jpg', { familyId: 'fam_1' })
    await waitForCondition(async () => {
      const rows = await localDb.getTable<any>('image_cache_entries')
      return rows.length === 1
    })

    expect(removeSavedFile).not.toHaveBeenCalled()
    const rows = await localDb.getTable<any>('image_cache_entries')
    expect(rows.map(row => row.file_id)).toEqual(['cloud://bucket/fresh.jpg'])
  })

  it('LRU 清理不应删除仍被业务记录或 outbox 引用的待上传本地文件', async () => {
    const removeSavedFile = vi.fn(({ success }) => success({}))
    ;(globalThis as any).uni.removeSavedFile = removeSavedFile
    const businessLocalSrc = 'saved://pending-business.jpg'
    const outboxLocalSrc = 'saved://pending-outbox.jpg'
    await localDb.replaceTable('image_cache_entries', [
      {
        _id: imageCacheEntryId('cloud://bucket/stale-business.jpg'),
        file_id: 'cloud://bucket/stale-business.jpg',
        family_id: 'fam_1',
        local_src: businessLocalSrc,
        size: 100,
        created_at: 1000,
        last_accessed_at: 1000,
        updated_at: 1000,
      },
      {
        _id: imageCacheEntryId('cloud://bucket/stale-outbox.jpg'),
        file_id: 'cloud://bucket/stale-outbox.jpg',
        family_id: 'fam_1',
        local_src: outboxLocalSrc,
        size: 100,
        created_at: 1000,
        last_accessed_at: 1000,
        updated_at: 1000,
      },
      {
        _id: imageCacheEntryId('cloud://bucket/fresh-protected-test.jpg'),
        file_id: 'cloud://bucket/fresh-protected-test.jpg',
        family_id: 'fam_1',
        local_src: 'saved://fresh-protected-test.jpg',
        size: 100,
        created_at: Date.now(),
        last_accessed_at: Date.now(),
        updated_at: Date.now(),
      },
    ])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_pending_image',
      family_id: 'fam_1',
      images: [businessLocalSrc],
      _pending_upload: true,
      pending_upload: true,
    }])
    await localDb.replaceTable('outbox_mutations', [{
      _id: 'outbox_pending_image',
      type: 'finance.addExpense',
      collection_scope: ['expenses'],
      payload: { images: [outboxLocalSrc] },
      family_id: 'fam_1',
      status: 'pending',
      retry_count: 0,
      next_retry_at: 0,
      client_mutation_id: 'mutation_pending_image',
      device_id: 'device_1',
      created_at: 1000,
      updated_at: 1000,
    }])

    await resolveImageDisplayUrl('cloud://bucket/fresh-protected-test.jpg', { familyId: 'fam_1' })
    await waitForCondition(async () => {
      const rows = await localDb.getTable<any>('image_cache_entries')
      return rows.length === 1
    })

    expect(removeSavedFile).not.toHaveBeenCalledWith(expect.objectContaining({ filePath: businessLocalSrc }))
    expect(removeSavedFile).not.toHaveBeenCalledWith(expect.objectContaining({ filePath: outboxLocalSrc }))
    const rows = await localDb.getTable<any>('image_cache_entries')
    expect(rows.map(row => row.file_id)).toEqual(['cloud://bucket/fresh-protected-test.jpg'])
  })

  it('云 fileID 解析失败时不应回退为浏览器无法识别的 cloud 协议', async () => {
    delete (globalThis as any).uniCloud.getTempFileURL

    const url = await resolveImageDisplayUrl('cloud://bucket/unresolved.jpg')

    expect(url).toBe('')
  })

  it('安全图片 src 不应回退到 cloud 协议', async () => {
    const { resolveImageSafeSrc } = await import('@/utils/imageAttachment')

    expect(resolveImageSafeSrc('cloud://bucket/photo.jpg')).toBe('')
    expect(resolveImageSafeSrc('cloud://bucket/photo.jpg', 'https://temp.local/photo.jpg')).toBe('https://temp.local/photo.jpg')
    expect(resolveImageSafeSrc('saved://photo.jpg')).toBe('saved://photo.jpg')
  })
})
