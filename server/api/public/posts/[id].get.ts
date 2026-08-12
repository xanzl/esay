import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { getConfig } from '../../../utils/config'
import { getRepo } from '../../../db/client'
import { requestOrigin, toPublicPost, withLikeStats } from '../../../utils/http'
import { isValidUuid } from '../../../utils/uuidv7'
import { isOwner } from '../../../utils/optional-auth'

/** 公开 API：获取单条说说详情（无需认证，支持 CORS）；私密说说仅站长可见 */
export default defineEventHandler(async (event: H3Event) => {
  const config = getConfig(event)
  if (!config.publicApiEnabled) {
    throw createError({ statusCode: 404, statusMessage: '公开 API 未开启' })
  }

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }

  const post = await getRepo(event).getPost(id)
  if (!post || (post.private && !(await isOwner(event)))) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }

  const baseUrl = config.appUrl || requestOrigin(event)
  const apiPost = (await withLikeStats(event, toPublicPost(post, baseUrl))) as ReturnType<typeof toPublicPost>
  return { post: apiPost }
})
