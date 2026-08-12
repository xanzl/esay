import { createError, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { getConfig } from '../../../utils/config'
import { getRepo } from '../../../db/client'
import { requestOrigin, toPublicPost, withLikeStats } from '../../../utils/http'
import { parseCursor, serializeCursor } from '../../../utils/cursor'

/** 公开 API：获取说说列表（无需认证，支持 CORS，用于外嵌） */
export default defineEventHandler(async (event: H3Event) => {
  const config = getConfig(event)
  if (!config.publicApiEnabled) {
    throw createError({ statusCode: 404, statusMessage: '公开 API 未开启' })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50)
  const baseUrl = config.appUrl || requestOrigin(event)

  const { posts, nextCursor, hasMore } = await getRepo(event).listPosts({
    limit,
    cursor: parseCursor(query.cursor),
  })
  const site = await getRepo(event).getSite()
  const apiPosts = (await withLikeStats(
    event,
    posts.filter((p) => !p.private).map((p) => toPublicPost(p, baseUrl)),
  )) as ReturnType<typeof toPublicPost>[]

  return {
    site,
    posts: apiPosts,
    nextCursor: serializeCursor(nextCursor),
    hasMore,
  }
})
