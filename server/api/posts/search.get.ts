import { createError, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { toApiPost, withLikeStats } from '../../utils/http'
import { isOwner } from '../../utils/optional-auth'

export default defineEventHandler(async (event: H3Event) => {
  const query = getQuery(event)
  const keyword = String(query.q ?? '').trim()
  const since = Number(query.since) > 0 ? Number(query.since) : undefined
  const tagParam = query.tag
  const tagNames = Array.isArray(tagParam)
    ? tagParam.map((t) => String(t).trim()).filter(Boolean)
    : tagParam
      ? String(tagParam).split(',').map((t) => t.trim()).filter(Boolean)
      : []
  if (!keyword && !since && !tagNames.length) {
    throw createError({ statusCode: 400, statusMessage: '请输入搜索关键词或选择筛选条件' })
  }
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
  const owner = await isOwner(event)
  const posts = await getRepo(event).searchPosts(keyword, limit, since, tagNames)
  return {
    keyword,
    since,
    tagNames,
    posts: (await withLikeStats(
      event,
      posts.filter((p) => owner || !p.private).map(toApiPost),
    )) as ReturnType<typeof toApiPost>[],
  }
})
