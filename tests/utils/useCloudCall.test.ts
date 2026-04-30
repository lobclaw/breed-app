import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCloudCall } from '../../src/composables/useCloudCall'

describe('useCloudCall', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('离线时应直接提示需要联网且不发起云调用', async () => {
    const showToast = vi.fn()
    const importObject = vi.fn()

    ;(globalThis as any).uni = {
      getNetworkType: ({ success }: any) => success({ networkType: 'none' }),
      showToast,
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    }
    ;(globalThis as any).uniCloud = { importObject }

    const { run, error } = useCloudCall('family-service', 'joinFamily')
    const result = await run({ code: 'ABCD' })

    expect(result).toBeNull()
    expect(error.value).toBe('当前功能需要联网')
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '当前功能需要联网' }))
    expect(importObject).not.toHaveBeenCalled()
  })
})
