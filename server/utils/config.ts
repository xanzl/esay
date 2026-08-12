import type { H3Event } from 'h3'
import { getEnv, type Env } from './env'

export interface AppConfig {
  dbType: 'd1' | 'postgresql'
  storageType: 'r2' | 's3'
  appUrl: string
  publicApiEnabled: boolean
}

export function getConfig(event: H3Event): AppConfig {
  const env: Env = getEnv(event)
  return {
    dbType: env.DB_TYPE ?? 'd1',
    storageType: env.STORAGE_TYPE ?? 'r2',
    appUrl: (env.APP_URL ?? '').replace(/\/+$/, ''),
    publicApiEnabled: env.PUBLIC_API_ENABLED !== 'false',
  }
}