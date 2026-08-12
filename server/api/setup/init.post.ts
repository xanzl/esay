import { createError, getRequestIP, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import type { DbRepo } from '../../db/types'
import { signToken } from '../../utils/jwt'
import { getJwtSecret } from '../../utils/jwt-secret'
import { hashPassword } from '../../utils/password'
import { checkRateLimit } from '../../utils/ratelimit'
import { toApiUser } from '../../utils/http'

interface InitBody {
  username?: string
  password?: string
  nickname?: string
}

export default defineEventHandler(async (event: H3Event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(event, `setup:${ip}`, 5, 10 * 60_000)) {
    throw createError({ statusCode: 429, statusMessage: '尝试次数过多，请稍后再试' })
  }

  const repo = getRepo(event)
  if ((await repo.countUsers()) > 0) {
    throw createError({ statusCode: 409, statusMessage: '站点已初始化' })
  }

  const body = await readBody<InitBody>(event)
  const username = (body.username ?? '').trim()
  const password = body.password ?? ''
  const nickname = (body.nickname ?? '').trim() || null

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: '请设置用户名' })
  }
  if (username.length > 20) {
    throw createError({ statusCode: 400, statusMessage: '用户名过长（最多 20 个字符）' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: '密码至少 6 位' })
  }

  let user: Awaited<ReturnType<DbRepo['createUser']>>
  try {
    user = await repo.createUser({
      username,
      passwordHash: await hashPassword(password),
      nickname,
      avatarUrl: null,
      bio: null,
    })
  } catch (error) {
    if ((await repo.countUsers()) > 0) {
      throw createError({ statusCode: 409, statusMessage: '站点已初始化' })
    }
    throw error
  }

  const token = await signToken(user.id, await getJwtSecret(event))
  const afterCount = await repo.countUsers()
  console.log(`[esay] setup/init created user id=${user.id} username=${username} postWriteCount=${afterCount}`)
  return { token, user: toApiUser(user), postWriteCount: afterCount }
})