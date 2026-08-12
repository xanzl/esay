import { createError, getRequestIP, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { getJwtSecret } from '../../utils/jwt-secret'
import { signToken } from '../../utils/jwt'
import { verifyPassword } from '../../utils/password'
import { checkRateLimit, resetRateLimit } from '../../utils/ratelimit'
import { toApiUser } from '../../utils/http'
import { verifyTurnstile } from '../../utils/turnstile'

interface LoginBody {
  username?: string
  password?: string
  turnstile_token?: string
}

export default defineEventHandler(async (event: H3Event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(event, `login:${ip}`, 10, 5 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: '尝试次数过多，请稍后再试' })
  }

  const body = await readBody<LoginBody>(event)
  const username = (body.username ?? '').trim()
  const password = body.password ?? ''
  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: '请输入用户名和密码' })
  }

  if (!(await verifyTurnstile(event, String(body.turnstile_token ?? ''), 'login'))) {
    throw createError({ statusCode: 403, statusMessage: '人机验证未通过，请刷新后重试' })
  }

  const repo = getRepo(event)
  const user = await repo.getUserByUsername(username)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }

  // 登录成功：重置该 IP 的失败计数，正常使用不误触限流
  resetRateLimit(`login:${ip}`)

  const token = await signToken(user.id, await getJwtSecret(event))
  return { token, user: toApiUser(user) }
})