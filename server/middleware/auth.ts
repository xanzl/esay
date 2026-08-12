import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'
import { verifyToken } from '../utils/jwt'
import { getJwtSecret } from '../utils/jwt-secret'

export interface AuthContext {
  id: number
}

interface ProtectedRoute {
  method: string
  pattern: RegExp
}

const protectedRoutes: ProtectedRoute[] = [
  { method: 'GET', pattern: /^\/api\/auth\/me$/ },
  { method: 'PUT', pattern: /^\/api\/auth\/me$/ },
  { method: 'POST', pattern: /^\/api\/posts$/ },
  { method: 'PUT', pattern: /^\/api\/posts\/[0-9a-f-]{36}$/ },
  { method: 'DELETE', pattern: /^\/api\/posts\/[0-9a-f-]{36}$/ },
  { method: 'POST', pattern: /^\/api\/upload$/ },
  { method: 'DELETE', pattern: /^\/api\/comments\/[0-9a-f-]{36}$/ },
  { method: 'PUT', pattern: /^\/api\/comments\/[0-9a-f-]{36}$/ },
  { method: 'PUT', pattern: /^\/api\/comments\/settings$/ },
  { method: 'GET', pattern: /^\/api\/hub\/instances$/ },
  { method: 'PUT', pattern: /^\/api\/hub\/instances$/ },
  { method: 'GET', pattern: /^\/api\/turnstile\/settings$/ },
  { method: 'PUT', pattern: /^\/api\/turnstile\/settings$/ },
  { method: 'DELETE', pattern: /^\/api\/tags\/[0-9a-f-]{36}$/ },
  { method: 'GET', pattern: /^\/api\/stats$/ },
  { method: 'GET', pattern: /^\/api\/storage\/settings$/ },
  { method: 'PUT', pattern: /^\/api\/storage\/settings$/ },
  { method: 'POST', pattern: /^\/api\/storage\/test$/ },
  { method: 'GET', pattern: /^\/api\/site\/settings$/ },
  { method: 'PUT', pattern: /^\/api\/site\/settings$/ },
  { method: 'POST', pattern: /^\/api\/extension\/preview$/ },
]

export default defineEventHandler(async (event: H3Event) => {
  const path = event.path ?? ''
  const matched = protectedRoutes.find((r) => r.method === event.method && r.pattern.test(path))
  if (!matched) return

  const header = getHeader(event, 'authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '未登录，请先登录' })
  }

  try {
    const { userId } = await verifyToken(token, await getJwtSecret(event))
    event.context.user = { id: userId } satisfies AuthContext
  } catch {
    throw createError({ statusCode: 401, statusMessage: '登录已过期，请重新登录' })
  }
})
