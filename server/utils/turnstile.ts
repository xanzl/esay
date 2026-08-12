import type { H3Event } from 'h3'
import { getRepo } from '../db/client'

export interface TurnstileConfig {
  siteKey: string
  secretKey: string
  /** 评论是否需要验证码（配置了密钥时默认启用，向后兼容） */
  commentEnabled: boolean
  /** 登录是否需要验证码 */
  loginEnabled: boolean
}

const SETTINGS_KEY = 'turnstile.config'

/** 读取 Turnstile 配置（站点密钥 + 密钥 + 各场景开关，存于 app_settings，后台页面管理） */
export async function getTurnstileConfig(event: H3Event): Promise<TurnstileConfig> {
  const raw = await getRepo(event).getSetting(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        site_key?: string
        secret_key?: string
        comment_enabled?: boolean
        login_enabled?: boolean
      }
      return {
        siteKey: parsed.site_key?.trim() ?? '',
        secretKey: parsed.secret_key?.trim() ?? '',
        commentEnabled: parsed.comment_enabled !== false,
        loginEnabled: parsed.login_enabled === true,
      }
    } catch {
      /* 损坏则视为未配置 */
    }
  }
  return { siteKey: '', secretKey: '', commentEnabled: true, loginEnabled: false }
}

export async function setTurnstileConfig(
  event: H3Event,
  siteKey: string,
  secretKey: string,
  commentEnabled: boolean,
  loginEnabled: boolean,
): Promise<void> {
  await getRepo(event).setSetting(
    SETTINGS_KEY,
    JSON.stringify({
      site_key: siteKey.trim(),
      secret_key: secretKey.trim(),
      comment_enabled: commentEnabled,
      login_enabled: loginEnabled,
    }),
  )
}

/** 未配置任何密钥时视为「未启用」：前端不渲染组件，服务端跳过校验 */
export function turnstileConfigured(config: TurnstileConfig): boolean {
  return !!config.siteKey && !!config.secretKey
}

export type TurnstileScene = 'comment' | 'login'

/** 指定场景是否启用验证码（未配置密钥 = 未启用） */
export function turnstileEnabledFor(config: TurnstileConfig, scene: TurnstileScene): boolean {
  if (!turnstileConfigured(config)) return false
  return scene === 'comment' ? config.commentEnabled : config.loginEnabled
}

/**
 * 服务端 siteverify：要求 success=true、action 与场景匹配。
 * 对应场景未启用（或未配置密钥）时直接放行。
 * widget 本身已按域名限制（创建时配置的 domains），此处不再校验 hostname。
 */
export async function verifyTurnstile(
  event: H3Event,
  token: string,
  scene: TurnstileScene = 'comment',
): Promise<boolean> {
  const config = await getTurnstileConfig(event)
  if (!turnstileEnabledFor(config, scene)) return true

  if (typeof token !== 'string' || !token || token.length > 2048) return false

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: config.secretKey,
        response: token,
      }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success: boolean; action?: string }
    return data.success === true && data.action === scene
  } catch {
    return false
  }
}
