import { getRequestIP } from 'h3'
import type { H3Event } from 'h3'

/** 客户端 IP 的 SHA-256 哈希（点赞/评论去重用，不存储明文 IP） */
export async function getClientIpHash(event: H3Event, salt: string): Promise<string> {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const bytes = new TextEncoder().encode(`${ip}:${salt}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}