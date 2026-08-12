import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../../../db/client'
import { isValidUuid } from '../../../../utils/uuidv7'
import { isOwner } from '../../../../utils/optional-auth'

/** 公开 API：评论列表。访客仅见已通过审核的评论；站长（携带有效 token）可见全部 */
export default defineEventHandler(async (event: H3Event) => {
  const postId = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(postId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }
  const post = await getRepo(event).getPost(postId)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }

  const owner = await isOwner(event)
  const comments = await getRepo(event).listCommentsByPost(postId)
  return { comments: owner ? comments : comments.filter((c) => c.status === 'approved') }
})