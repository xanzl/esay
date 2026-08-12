import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { setCommentSettings } from '../../utils/comment-settings'

interface UpdateCommentSettingsBody {
  enable_comment?: unknown
  require_approval?: unknown
}

/** 评论设置：站长（已认证）开关评论与审核 */
export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<UpdateCommentSettingsBody>(event)
  const enableComment = body.enable_comment
  const requireApproval = body.require_approval
  if (typeof enableComment !== 'boolean' || typeof requireApproval !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: '参数无效' })
  }
  await setCommentSettings(event, {
    enable_comment: enableComment,
    require_approval: requireApproval,
  })
  return { ok: true }
})