export const ONLINE_ONLY_MESSAGE = '当前功能需要联网'

export async function isNetworkAvailable() {
  try {
    if (typeof uni === 'undefined' || typeof uni.getNetworkType !== 'function') return true
    const result = await new Promise<any>((resolve) => {
      uni.getNetworkType({
        success: resolve,
        fail: () => resolve({ networkType: 'unknown' }),
      })
    })
    return result?.networkType !== 'none'
  } catch {
    return true
  }
}
