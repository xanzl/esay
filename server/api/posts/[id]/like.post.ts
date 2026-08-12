import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../../db/client'
import { isValidUuid } from '../../../utils/uuidv7'
import { checkRateLimit } from '../../../utils/ratelimit'
import { getClientIpHash } from '../../../utils/ip'

/** 点赞/取消点赞：公开（按 IP 每帖一次），切换并返回最新状态 */
export default defineEventHandler(async (event: H3Event) => {
  const postId = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(postId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }

  const repo = getRepo(event)
  const post = await repo.getPost(postId)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }

  const ipHash = await getClientIpHash(event, 'like')
  if (!checkRateLimit(event, `like:${ipHash}`, 30, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: '操作过于频繁，请稍后再试' })
  }

  const result = await repo.toggleLike(postId, ipHash, Date.now())
  return result
})