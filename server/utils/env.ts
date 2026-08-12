import type { H3Event } from 'h3'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

export type Env = Record<string, unknown> & {
  DB_TYPE?: 'd1' | 'postgresql'
  STORAGE_TYPE?: 'r2' | 's3'
  DATABASE_URL?: string
  JWT_SECRET?: string
  PUBLIC_API_ENABLED?: string
  APP_URL?: string
  S3_ENDPOINT?: string
  S3_REGION?: string
  S3_BUCKET?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_HOSTNAMES?: string
  METING_API?: string
  GITHUB_TOKEN?: string
  DB?: D1Database
  R2?: R2Bucket
}

/**
 * 读取运行时环境变量。
 * Cloudflare Workers（Nitro cloudflare_module preset）下从 event.context._platform.cloudflare.env
 * 读取 D1/R2 绑定与 vars/secret；Node 平台（Vercel/Netlify）下从 process.env 读取。
 */
export function getEnv(event: H3Event): Env {
  const cloudflare = (event.context as { _platform?: { cloudflare?: { env?: Env } } })._platform?.cloudflare
  return (cloudflare?.env ?? process.env) as Env
}
