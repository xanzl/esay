import type { H3Event } from 'h3'
import { getTurnstileConfig } from '../../utils/turnstile'

/** 读取 Turnstile 配置（站长）：密钥不回显，仅返回是否已设置 */
export default defineEventHandler(async (event: H3Event) => {
  const config = await getTurnstileConfig(event)
  return {
    site_key: config.siteKey,
    secret_set: !!config.secretKey,
    comment_enabled: config.commentEnabled,
    login_enabled: config.loginEnabled,
  }
})
