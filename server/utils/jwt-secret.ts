import type { H3Event } from 'h3'
import { getEnv } from './env'
import { getRepo } from '../db/client'

const SETTINGS_KEY = 'jwt.secret'

/** 进程级缓存：同一隔离内只读一次数据库；密钥在数据库中被持久化，跨部署有效 */
let cachedSecret: string | null = null

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 解析 JWT 密钥：优先环境变量 JWT_SECRET（Cloudflare dashboard 的 Variables/Secrets、
 * wrangler secret、Vercel/Netlify 平台环境变量均可注入），否则首次从 app_settings 读取；
 * 若不存在则随机生成并持久化到数据库，写入后重读数据库中的实际值，
 * 避免多 isolate 并发各写一份导致各实例缓存不同密钥（登录态间歇失效）。
 */
export async function getJwtSecret(event: H3Event): Promise<string> {
  const envSecret = String(getEnv(event).JWT_SECRET ?? '').trim()
  if (envSecret) {
    // 弱密钥防护：低于 32 字符（约 128 bit）的密钥直接忽略并回退数据库自动生成，
    // 避免配置失误导致 JWT 可被暴力猜测
    if (envSecret.length < 32) {
      console.warn('[jwt] JWT_SECRET 长度不足 32 字符，已忽略并回退自动生成；请使用 openssl rand -hex 32 重新配置')
    } else {
      return envSecret
    }
  }
  if (cachedSecret) return cachedSecret

  const repo = getRepo(event)
  const stored = await repo.getSetting(SETTINGS_KEY)
  if (stored) {
    cachedSecret = stored
    return stored
  }

  const secret = randomSecret()
  try {
    await repo.setSetting(SETTINGS_KEY, secret)
  } catch {
    // 并发写入冲突时忽略，写入后统一重读实际值
  }
  // 写后重读：以数据库中的最终值为准，保证所有 isolate 收敛到同一密钥
  const persisted = await repo.getSetting(SETTINGS_KEY).catch(() => null)
  const final = persisted && persisted.length >= 32 ? persisted : secret
  cachedSecret = final
  return final
}