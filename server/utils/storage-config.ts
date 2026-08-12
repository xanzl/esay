import type { H3Event } from 'h3'
import { getRepo } from '../db/client'
import { getEnv } from './env'

export interface StorageConfig {
  type: 'r2' | 's3'
  s3_endpoint: string
  s3_region: string
  s3_bucket: string
  s3_access_key_id: string
  s3_secret_access_key: string
}

const SETTINGS_KEY = 'storage.config'

export const DEFAULT_S3_ENDPOINT = 'https://s3.amazonaws.com'

/** 读取存储配置：后台设置优先，未配置时回退环境变量（旧部署兼容） */
export async function getStorageConfig(event: H3Event): Promise<StorageConfig> {
  const raw = await getRepo(event).getSetting(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StorageConfig>
      if (parsed.type === 'r2' || parsed.type === 's3') {
        return {
          type: parsed.type,
          s3_endpoint: parsed.s3_endpoint ?? '',
          s3_region: parsed.s3_region ?? 'us-east-1',
          s3_bucket: parsed.s3_bucket ?? '',
          s3_access_key_id: parsed.s3_access_key_id ?? '',
          s3_secret_access_key: parsed.s3_secret_access_key ?? '',
        }
      }
    } catch {
      /* 损坏则回退环境变量 */
    }
  }
  const env = getEnv(event)
  return {
    type: env.STORAGE_TYPE === 's3' ? 's3' : 'r2',
    s3_endpoint: env.S3_ENDPOINT ?? '',
    s3_region: env.S3_REGION ?? 'us-east-1',
    s3_bucket: env.S3_BUCKET ?? '',
    s3_access_key_id: env.S3_ACCESS_KEY_ID ?? '',
    s3_secret_access_key: env.S3_SECRET_ACCESS_KEY ?? '',
  }
}

export async function setStorageConfig(event: H3Event, config: StorageConfig): Promise<void> {
  await getRepo(event).setSetting(SETTINGS_KEY, JSON.stringify(config))
}