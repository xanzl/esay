import { setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * 所有 /api/* 响应禁用缓存（no-store），防止浏览器或边缘 CDN 缓存 API 响应
 * （如 setup/status 被缓存后，初始化成功后刷新仍显示旧状态）。
 */
export default defineEventHandler((event: H3Event) => {
  const path = event.path ?? ''
  if (!path.startsWith('/api/')) return
  setResponseHeader(event, 'Cache-Control', 'no-store')
})