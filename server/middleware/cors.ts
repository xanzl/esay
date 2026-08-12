import { setResponseHeader, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'

const CORS_PATHS: RegExp[] = [
  /^\/api\/public\//,
  /^\/api\/connect(\/|$)/,
  /^\/api\/echo(\/|$)/,
  /^\/healthz(\/|$)/,
]

/** Hub 协议与公开 API 的 CORS 处理（供 ech0 Hub 等跨域调用方） */
export default defineEventHandler((event: H3Event) => {
  const path = event.path ?? ''
  if (!CORS_PATHS.some((re) => re.test(path))) return

  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  setResponseHeader(event, 'Access-Control-Max-Age', 86400)

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }
})