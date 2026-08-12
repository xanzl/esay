import { createError, getRouterParam, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { isValidUuid } from '../../utils/uuidv7'
import type { CommentStatus } from '../../db/types'

const VALID_STATUSES: CommentStatus[] = ['pending', 'approved', 'rejected']

/** 评论审核：站长（已认证）可修改评论状态（通过/驳回/待审） */
export default defineEventHandler(async (event: H3Event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的评论 ID' })
  }
  const body = (await readBody<{ status?: string }>(event)) ?? {}
  const status = body.status as CommentStatus
  if (!VALID_STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: '无效的评论状态' })
  }
  const updated = await getRepo(event).updateCommentStatus(id, status)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '评论不存在' })
  }
  return { comment: updated }
})