import type { HubInstance } from './hub'

/** 去掉 URL 尾部斜杠 */
export function normalizeHubUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/** 时间值归一化为毫秒：支持 Unix 秒/毫秒与 ISO 文本 */
export function timeValueToMs(value: number | string): number {
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** 将 /api/connect 返回的 logo 转为绝对地址（相对路径对齐到该实例 origin） */
export function resolveHubLogo(rawUrl: string | undefined, instanceOrigin: string): string {
  const value = (rawUrl || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = normalizeHubUrl(instanceOrigin)
  if (value.startsWith('/')) return `${base}${value}`
  return `${base}/${value}`
}

/** 受限并发（fan-out limit），与 ech0 pMapLimit 语义一致 */
export async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  opts?: { onSettled?: (r: PromiseSettledResult<R>, index: number) => void },
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]!
      try {
        const value = await fn(item, index)
        results[index] = value
        opts?.onSettled?.({ status: 'fulfilled', value }, index)
      } catch (reason) {
        opts?.onSettled?.({ status: 'rejected', reason }, index)
      }
    }
  })
  await Promise.all(workers)
  return results
}

/** 供 Hub 卡片做 like 去重的本地存储 key */
export function hubLikeListKey(serverUrl: string): string {
  return `${normalizeHubUrl(serverUrl)}_liked_echo_ids`
}