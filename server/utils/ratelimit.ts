import { setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 2000

/**
 * 简单的进程内滑动窗口限流（单用户场景足够；多实例部署时可换 KV 实现）。
 * 超过限制时返回 false 并设置 Retry-After 响应头。
 */
export function checkRateLimit(
  event: H3Event,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now()

  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k)
    }
  }

  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  if (bucket.count > max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', retryAfter)
    return false
  }
  return true
}

/** 清除指定 key 的限流计数（如登录成功后重置，避免正常使用误触限流） */
export function resetRateLimit(key: string): void {
  buckets.delete(key)
}
