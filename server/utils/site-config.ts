import type { H3Event } from 'h3'
import { getRepo } from '../db/client'

export interface SiteConfig {
  instance_name: string
  meting_api: string
}

const SETTINGS_KEY = 'site.config'

export async function getSiteConfig(event: H3Event): Promise<SiteConfig> {
  const raw = await getRepo(event).getSetting(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SiteConfig>
      return {
        instance_name: parsed.instance_name?.trim() ?? '',
        meting_api: parsed.meting_api?.trim() ?? '',
      }
    } catch {
      /* 损坏则视为未配置 */
    }
  }
  return { instance_name: '', meting_api: '' }
}

export async function setSiteConfig(
  event: H3Event,
  instanceName: string,
  metingApi: string,
): Promise<void> {
  await getRepo(event).setSetting(
    SETTINGS_KEY,
    JSON.stringify({ instance_name: instanceName.trim(), meting_api: metingApi.trim() }),
  )
}

/** 实例显示名：实例配置 > 站长昵称 > 用户名 */
export async function getInstanceName(event: H3Event): Promise<string> {
  const config = await getSiteConfig(event)
  if (config.instance_name) return config.instance_name
  const site = await getRepo(event).getSite()
  return site?.nickname || site?.username || 'esay'
}