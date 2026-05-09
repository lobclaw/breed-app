export interface LocalImagePrepareResult {
  path: string
  compressed: boolean
  persisted: boolean
  warning?: string
  recoverable?: boolean
  size?: number
}

export interface UploadImageMeta {
  familyId: string
  collection: string
  rowId: string
  index?: number
}

export interface ChooseLocalImagesResult {
  paths: string[]
  warnings: string[]
}

export type ImageCompressionProfile = 'business' | 'record' | 'avatar'

interface ImagePrepareOptions {
  profile?: ImageCompressionProfile
}

interface ImageCompressionAttempt {
  maxEdge: number
  quality: number
}

const IMAGE_COMPRESSION_PROFILES: Record<ImageCompressionProfile, {
  targetBytes: number
  attempts: ImageCompressionAttempt[]
}> = {
  business: {
    targetBytes: 350 * 1024,
    attempts: [
      { maxEdge: 1024, quality: 68 },
      { maxEdge: 1024, quality: 58 },
      { maxEdge: 900, quality: 48 },
      { maxEdge: 768, quality: 42 },
    ],
  },
  record: {
    targetBytes: 450 * 1024,
    attempts: [
      { maxEdge: 1024, quality: 68 },
      { maxEdge: 1024, quality: 58 },
      { maxEdge: 900, quality: 48 },
      { maxEdge: 768, quality: 42 },
    ],
  },
  avatar: {
    targetBytes: 180 * 1024,
    attempts: [
      { maxEdge: 768, quality: 68 },
      { maxEdge: 640, quality: 58 },
      { maxEdge: 512, quality: 48 },
      { maxEdge: 384, quality: 42 },
    ],
  },
}
const displayUrlCache = new Map<string, string>()

function getUniApi() {
  return typeof uni === 'undefined' ? null : uni as any
}

function getUniCloudApi() {
  return typeof uniCloud === 'undefined' ? null : uniCloud as any
}

export function isUploadedImageRef(value: string) {
  const text = String(value || '').trim()
  return /^https?:\/\//.test(text)
    || /^cloud:\/\//.test(text)
    || /^mock:\/\//.test(text)
    || /^unicloud:\/\//i.test(text)
}

export function isCloudImageRef(value: string) {
  const text = String(value || '').trim()
  return /^cloud:\/\//.test(text)
    || /^mock:\/\//.test(text)
    || /^unicloud:\/\//i.test(text)
}

export function isDataUrlImageRef(value: string) {
  return /^data:image\//i.test(String(value || '').trim())
}

export function isVolatileImageRef(value: string) {
  return /^blob:/i.test(String(value || '').trim())
}

export function getImageFileExtension(path: string) {
  const dataUrlMatch = String(path || '').match(/^data:image\/([a-zA-Z0-9.+-]+);/i)
  if (dataUrlMatch) {
    const ext = dataUrlMatch[1].toLowerCase()
    return ext === 'jpeg' ? 'jpg' : ext
  }
  const cleanPath = String(path || '').split('?')[0]
  const match = cleanPath.match(/\.([a-zA-Z0-9]{1,8})$/)
  return match ? match[1].toLowerCase() : 'jpg'
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000)
    binary += String.fromCharCode(...chunk)
  }
  if (typeof btoa === 'function') return btoa(binary)
  const BufferCtor = (globalThis as any).Buffer
  if (BufferCtor) return BufferCtor.from(buffer).toString('base64')
  throw new Error('当前环境不支持图片持久化降级')
}

async function blobToDataUrl(blob: Blob) {
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  const mimeType = blob.type || 'image/jpeg'
  return `data:${mimeType};base64,${arrayBufferToBase64(await blob.arrayBuffer())}`
}

function dataUrlToBlob(dataUrl: string) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/i)
  if (!match || typeof Blob === 'undefined') return null
  const mimeType = match[1] || 'image/jpeg'
  const isBase64 = !!match[2]
  const body = match[3] || ''
  const binary = isBase64
    ? (typeof atob === 'function' ? atob(body) : String((globalThis as any).Buffer?.from(body, 'base64') || ''))
    : decodeURIComponent(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

function createUploadObjectUrl(dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl)
  if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) return ''
  return URL.createObjectURL(blob)
}

async function createDurableInlineImageRef(path: string) {
  if (isDataUrlImageRef(path)) return path
  if (!isVolatileImageRef(path) || typeof fetch !== 'function') return ''
  const response = await fetch(path)
  if (!response.ok) throw new Error('图片临时路径已失效，请重新选择图片')
  return blobToDataUrl(await response.blob())
}

function buildUploadCloudPath(meta: UploadImageMeta, localRef: string) {
  const safeFamilyId = encodeURIComponent(meta.familyId || 'unknown')
  const safeRowId = encodeURIComponent(meta.rowId || 'unknown')
  const suffix = `${Date.now().toString(36)}_${meta.index || 0}_${Math.random().toString(36).slice(2, 8)}`
  return `attachments/${safeFamilyId}/${meta.collection}/${safeRowId}/${suffix}.${getImageFileExtension(localRef)}`
}

function chooseImage(count: number) {
  const api = getUniApi()
  if (!api?.chooseImage) return Promise.reject(new Error('当前环境不支持选择图片'))
  return new Promise<string[]>((resolve, reject) => {
    api.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res: any) => resolve(Array.isArray(res?.tempFilePaths) ? res.tempFilePaths : []),
      fail: reject,
    })
  })
}

function getImageInfo(path: string) {
  const api = getUniApi()
  if (!api?.getImageInfo) return Promise.resolve(null)
  return new Promise<{ width: number, height: number } | null>((resolve) => {
    api.getImageInfo({
      src: path,
      success: (res: any) => resolve({ width: Number(res?.width || 0), height: Number(res?.height || 0) }),
      fail: () => resolve(null),
    })
  })
}

function getFileSize(path: string) {
  const api = getUniApi()
  if (isDataUrlImageRef(path)) {
    const blob = dataUrlToBlob(path)
    return Promise.resolve(blob?.size || 0)
  }
  if (!api?.getFileInfo) return Promise.resolve(0)
  return new Promise<number>((resolve) => {
    api.getFileInfo({
      filePath: path,
      success: (res: any) => resolve(Number(res?.size || 0)),
      fail: () => resolve(0),
    })
  })
}

async function compressImageOnce(path: string, attempt: ImageCompressionAttempt) {
  const api = getUniApi()
  const info = await getImageInfo(path)
  const options: Record<string, any> = {
    src: path,
    quality: attempt.quality,
  }
  if (info?.width && info?.height) {
    const maxEdge = Math.max(info.width, info.height)
    if (maxEdge > attempt.maxEdge) {
      const ratio = attempt.maxEdge / maxEdge
      options.compressedWidth = Math.round(info.width * ratio)
      options.compressedHeight = Math.round(info.height * ratio)
    }
  } else {
    options.compressedWidth = attempt.maxEdge
  }

  let compressionError: unknown = null
  if (api?.compressImage) {
    try {
      return await new Promise<string>((resolve, reject) => {
        api.compressImage({
          ...options,
          success: (res: any) => resolve(String(res?.tempFilePath || path)),
          fail: reject,
        })
      })
    } catch (error) {
      // H5 或部分运行时可能暴露了 API 但无法处理 blob/file 路径，继续尝试 canvas 兜底。
      compressionError = error
    }
  }

  const canvasPath = await compressImageWithCanvas(path, attempt)
  if (canvasPath === path && compressionError) throw compressionError
  return canvasPath
}

async function loadImageElement(path: string) {
  if (typeof Image === 'undefined') return null
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = path
  })
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  if (canvas.toBlob) {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality)
    })
  }
  if (!canvas.toDataURL) return null
  return dataUrlToBlob(canvas.toDataURL('image/jpeg', quality))
}

async function compressImageWithCanvas(path: string, attempt: ImageCompressionAttempt) {
  if (typeof document === 'undefined') return path
  const image = await loadImageElement(path)
  if (!image) return path

  const sourceWidth = Number(image.naturalWidth || image.width || 0)
  const sourceHeight = Number(image.naturalHeight || image.height || 0)
  if (!sourceWidth || !sourceHeight) return path

  const maxEdge = Math.max(sourceWidth, sourceHeight)
  const ratio = maxEdge > attempt.maxEdge ? attempt.maxEdge / maxEdge : 1
  const width = Math.max(1, Math.round(sourceWidth * ratio))
  const height = Math.max(1, Math.round(sourceHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return path
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, Math.max(0.01, Math.min(1, attempt.quality / 100)))
  if (!blob) return path
  return blobToDataUrl(blob)
}

async function compressImage(path: string, profileName: ImageCompressionProfile) {
  const profile = IMAGE_COMPRESSION_PROFILES[profileName] || IMAGE_COMPRESSION_PROFILES.business
  let bestPath = path
  let bestSize = await getFileSize(path)
  for (const attempt of profile.attempts) {
    const compressedPath = await compressImageOnce(bestPath, attempt)
    const size = await getFileSize(compressedPath)
    bestPath = compressedPath || bestPath
    bestSize = size || bestSize
    if (size > 0 && size <= profile.targetBytes) break
  }
  return { path: bestPath, size: bestSize }
}

export async function persistLocalImage(path: string) {
  const api = getUniApi()
  if (!api?.saveFile) {
    const inlineRef = await createDurableInlineImageRef(path).catch(() => '')
    return {
      path: inlineRef || path,
      persisted: !!inlineRef,
      warning: inlineRef ? undefined : '当前平台不支持本地持久保存图片',
      recoverable: true,
    }
  }
  return new Promise<{ path: string, persisted: boolean, warning?: string, recoverable?: boolean }>((resolve) => {
    api.saveFile({
      tempFilePath: path,
      success: (res: any) => resolve({ path: String(res?.savedFilePath || path), persisted: true }),
      fail: async (error: any) => {
        console.warn('图片本地持久保存失败，已保留临时路径等待同步', error)
        const inlineRef = await createDurableInlineImageRef(path).catch(() => '')
        resolve({
          path: inlineRef || path,
          persisted: !!inlineRef,
          warning: inlineRef ? undefined : '图片已临时保存，联网后会自动上传',
          recoverable: true,
        })
      },
    })
  })
}

export async function prepareLocalImage(path: string, options: ImagePrepareOptions = {}): Promise<LocalImagePrepareResult> {
  let preparedPath = path
  let compressed = false
  let warning = ''
  let size = 0
  try {
    const compressedResult = await compressImage(path, options.profile || 'business')
    compressed = compressedResult.path !== path
    preparedPath = compressedResult.path || path
    size = compressedResult.size || 0
  } catch (error) {
    warning = error instanceof Error ? error.message : '图片压缩失败，已保留原图'
  }
  const persisted = await persistLocalImage(preparedPath)
  const persistedSize = size || await getFileSize(persisted.path)
  return {
    path: persisted.path,
    compressed,
    persisted: persisted.persisted,
    warning: persisted.warning || warning || undefined,
    recoverable: persisted.recoverable,
    size: persistedSize || undefined,
  }
}

export async function chooseLocalImages(max: number, options: ImagePrepareOptions = {}): Promise<ChooseLocalImagesResult> {
  if (max <= 0) return { paths: [], warnings: [] }
  const selectedPaths = await chooseImage(max)
  const results: LocalImagePrepareResult[] = []
  for (const path of selectedPaths) {
    results.push(await prepareLocalImage(path, options))
  }
  return {
    paths: results.map(item => item.path).filter(Boolean),
    warnings: results
      .filter(item => !item.recoverable)
      .map(item => item.warning)
      .filter((item): item is string => !!item),
  }
}

export async function uploadLocalImage(localRef: string, meta: UploadImageMeta) {
  if (isVolatileImageRef(localRef)) {
    throw new Error('图片临时路径已失效，请重新选择图片')
  }
  const cloudApi = getUniCloudApi()
  if (!cloudApi?.uploadFile) {
    throw new Error('当前环境不支持附件上传')
  }
  const cloudPath = buildUploadCloudPath(meta, localRef)
  const options: Record<string, any> = {
    cloudPath,
    fileType: 'image',
  }
  let uploadObjectUrl = ''
  if (isDataUrlImageRef(localRef)) {
    uploadObjectUrl = createUploadObjectUrl(localRef)
    if (!uploadObjectUrl) throw new Error('当前环境不支持上传本地缓存图片')
    options.filePath = uploadObjectUrl
  } else {
    options.filePath = localRef
  }
  try {
    const result = await cloudApi.uploadFile(options)
    const uploadedRef = String(result?.fileID || result?.url || '').trim()
    if (!uploadedRef) throw new Error('附件上传未返回 fileID')
    return uploadedRef
  } finally {
    if (uploadObjectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(uploadObjectUrl)
    }
  }
}

export async function resolveImageDisplayUrl(ref: string) {
  const imageRef = String(ref || '').trim()
  if (!imageRef) return ''
  if (!isCloudImageRef(imageRef)) return imageRef
  const cached = displayUrlCache.get(imageRef)
  if (cached) return cached
  const cloudApi = getUniCloudApi()
  if (!cloudApi?.getTempFileURL) return ''
  try {
    const result = await cloudApi.getTempFileURL({ fileList: [imageRef] })
    const file = Array.isArray(result?.fileList) ? result.fileList[0] : null
    const url = String(file?.tempFileURL || file?.url || '').trim()
    if (url) {
      displayUrlCache.set(imageRef, url)
      return url
    }
  } catch (error) {
    console.warn('解析图片地址失败', error)
  }
  return ''
}

export async function resolveImageDisplayUrls(refs: string[]) {
  return Promise.all((refs || []).map(ref => resolveImageDisplayUrl(ref)))
}

export function resolveImageSafeSrc(ref: string, displayUrl = '') {
  if (displayUrl) return displayUrl
  return isCloudImageRef(ref) ? '' : String(ref || '')
}
