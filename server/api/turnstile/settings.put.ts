import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getTurnstileConfig, setTurnstileConfig } from '../../utils/turnstile'

interface UpdateTurnstileBody {
  site_key?: unknown
  secret_key?: unknown
  clear_secret?: unknown
  comment_enabled?: unknown
  login_enabled?: unknown
}

/** 保存 Turnstile 配置（站长）。密钥留空表示保留原值，clear_secret=true 表示清除 */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<UpdateTurnstileBody>(event)) ?? {}
  const siteKey = String(body.site_key ?? '').trim()
  if (siteKey.length > 255) {
    throw createError({ statusCode: 400, statusMessage: '密钥长度不合法' })
  }

  const current = await getTurnstileConfig(event)
  let secretKey = current.secretKey
  if (body.clear_secret === true) {
    secretKey = ''
  } else {
    const input = String(body.secret_key ?? '').trim()
    if (input) secretKey = input
  }
  if (secretKey.length > 255) {
    throw createError({ statusCode: 400, statusMessage: '密钥长度不合法' })
  }

  const commentEnabled = body.comment_enabled === undefined ? current.commentEnabled : body.comment_enabled === true
  const loginEnabled = body.login_enabled === undefined ? current.loginEnabled : body.login_enabled === true

  await setTurnstileConfig(event, siteKey, secretKey, commentEnabled, loginEnabled)
  return { ok: true }
})
