import { getQuery } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { toApiPost, withLikeStats } from '../../utils/http'
import { isOwner } from '../../utils/optional-auth'
import { parseCursor, serializeCursor } from '../../utils/cursor'

/** 时间线：游标分页，倒序；私密说说仅站长可见 */
export default defineEventHandler(async (event: H3Event) => {
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50)
  const owner = await isOwner(event)
  const { posts, nextCursor, hasMore } = await getRepo(event).listPosts({
    limit,
    cursor: parseCursor(query.cursor),
  })
  return {
    posts: (await withLikeStats(
      event,
      posts.filter((p) => owner || !p.private).map(toApiPost),
    )) as Awaited<ReturnType<typeof toApiPost>>[],
    nextCursor: serializeCursor(nextCursor),
    hasMore,
  }
})
