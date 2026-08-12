import type { H3Event } from 'h3'
import { getRepo } from '../db/client'

export interface HubInstance {
  id: string
  url: string
}

const SETTINGS_KEY = 'hub.instances'

function normalizeUrl(url: string): string {
  let value = url.trim()
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    return value.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export async function getHubInstances(event: H3Event): Promise<HubInstance[]> {
  const raw = await getRepo(event).getSetting(SETTINGS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { instances?: HubInstance[] }
    if (!Array.isArray(parsed.instances)) return []
    return parsed.instances
      .filter((i) => typeof i?.id === 'string' && typeof i?.url === 'string')
      .map((i) => ({ id: i.id.trim(), url: normalizeUrl(i.url) }))
      .filter((i) => i.id && i.url)
  } catch {
    return []
  }
}

export async function setHubInstances(event: H3Event, instances: HubInstance[]): Promise<void> {
  const cleaned: HubInstance[] = []
  const seen = new Set<string>()
  for (const inst of instances) {
    if (typeof inst?.id !== 'string' || typeof inst?.url !== 'string') continue
    const id = inst.id.trim()
    const url = normalizeUrl(inst.url)
    if (!id || !url || seen.has(url)) continue
    seen.add(url)
    cleaned.push({ id, url })
  }
  await getRepo(event).setSetting(SETTINGS_KEY, JSON.stringify({ instances: cleaned }))
}