import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { isValidUuid } from '../../utils/uuidv7'

export default defineEventHandler(async (event: H3Event) => {
  if (!(event.context as { user?: unknown }).user) {
    throw createError({ statusCode: 401, statusMessage: '未登录或登录已过期' })
  }
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }
  const deleted = await getRepo(event).deletePost(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }
  return { ok: true }
})
