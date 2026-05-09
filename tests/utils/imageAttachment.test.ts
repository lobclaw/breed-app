import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseLocalImages,
  prepareLocalImage,
  resolveImageDisplayUrl,
  uploadLocalImage,
} from '@/utils/imageAttachment'

const originalFetch = globalThis.fetch
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalDocument = globalThis.document
const originalImage = globalThis.Image

describe('imageAttachment', () => {
  beforeEach(() => {
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

  it('云 fileID 展示前应转换为临时 URL', async () => {
    const url = await resolveImageDisplayUrl('cloud://bucket/photo.jpg')

    expect(url).toBe('https://temp.local/bucket/photo.jpg')
    expect((globalThis as any).uniCloud.getTempFileURL).toHaveBeenCalledWith({
      fileList: ['cloud://bucket/photo.jpg'],
    })
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
