import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { isValidUuid } from '../../utils/uuidv7'

/** 删除评论：仅站长（已认证）可操作 */
export default defineEventHandler(async (event: H3Event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的评论 ID' })
  }
  const deleted = await getRepo(event).deleteComment(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '评论不存在' })
  }
  return { ok: true }
})