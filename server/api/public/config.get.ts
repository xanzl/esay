import type { H3Event } from 'h3'
import { getCommentSettings } from '../../utils/comment-settings'
import { getTurnstileConfig, turnstileEnabledFor } from '../../utils/turnstile'

/** 公开配置：评论开关/审核开关/验证码开关与站点密钥（前端展示与渲染 widget） */
export default defineEventHandler(async (event: H3Event) => {
  const settings = await getCommentSettings(event)
  const turnstile = await getTurnstileConfig(event)
  return {
    comments_enabled: settings.enable_comment,
    require_approval: settings.require_approval,
    turnstile_site_key: turnstile.siteKey,
    turnstile_enabled: turnstileEnabledFor(turnstile, 'comment'),
    login_turnstile_enabled: turnstileEnabledFor(turnstile, 'login'),
  }
})
