import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../../db/client'
import { isValidUuid } from '../../../utils/uuidv7'
import { checkRateLimit } from '../../../utils/ratelimit'
import { getClientIpHash } from '../../../utils/ip'
import { hubResult } from '../../../utils/hub-protocol'

/**
 * ech0 Hub 跨站点赞协议端点：PUT /api/echo/like/:id（公开）。
 * 按请求方 IP 计一次点赞（可重复点赞由 Hub 侧本地记录约束）。
 */
export default defineEventHandler(async (event: H3Event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }
  const repo = getRepo(event)
  const post = await repo.getPost(id)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }

  const ipHash = await getClientIpHash(event, 'echo-like')
  if (!checkRateLimit(event, `echo-like:${ipHash}`, 30, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: '操作过于频繁，请稍后再试' })
  }

  const result = await repo.toggleLike(id, ipHash, Date.now())
  return hubResult(null, result.liked ? 'like success' : 'unlike success')
})