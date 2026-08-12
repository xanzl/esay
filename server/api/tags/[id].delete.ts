import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { isValidUuid } from '../../utils/uuidv7'

/** 删除标签（站长）：同时移除所有说说上的该标签关联 */
export default defineEventHandler(async (event: H3Event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的标签 ID' })
  }
  const deleted = await getRepo(event).deleteTag(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '标签不存在' })
  }
  return { ok: true }
})