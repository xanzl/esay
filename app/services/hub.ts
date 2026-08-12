import type { ApiResult, EchoQueryPage, HubConnect, HubEcho, HubInstance } from '../utils/hub'
import { normalizeHubUrl, timeValueToMs } from '../utils/hub-utils'

const ECHO_QUERY_TIMEOUT_MS = 8000
const HEALTHZ_TIMEOUT_MS = 5000
const CONNECT_TIMEOUT_MS = 6000

export const HUB_MIN_VERSION = '4.4.0'

function isVersionAtLeast(current: string, minimum: string): boolean {
  const parse = (s: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(s.trim())?.slice(1).map(Number) ?? []
  const a = parse(current)
  const b = parse(minimum)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false
  }
  return true
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** GET {origin}/healthz */
export async function fetchHealthz(
  instanceUrl: string,
): Promise<{ ok: true; version: string } | { ok: false; message: string }> {
  try {
    const r = await fetchJson<ApiResult<{ status: string; version: string }>>(
      `${normalizeHubUrl(instanceUrl)}/healthz`,
      undefined,
      HEALTHZ_TIMEOUT_MS,
    )
    if (r.code !== 1 || !r.data) return { ok: false, message: 'healthz failed' }
    return { ok: true, version: r.data.version }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

/** GET {origin}/api/connect */
export async function fetchInstanceConnect(instanceUrl: string): Promise<HubConnect | null> {
  try {
    const r = await fetchJson<ApiResult<HubConnect>>(
      `${normalizeHubUrl(instanceUrl)}/api/connect`,
      undefined,
      CONNECT_TIMEOUT_MS,
    )
    return r.code === 1 && r.data ? r.data : null
  } catch {
    return null
  }
}

export interface EchoQueryBody {
  page: number
  pageSize: number
  search: string
  tagIds: string[]
  sortBy: string
  sortOrder: string
}

const DEFAULT_QUERY: EchoQueryBody = {
  page: 1,
  pageSize: 10,
  search: '',
  tagIds: [],
  sortBy: '',
  sortOrder: 'desc',
}

function normalizeTimes(item: HubEcho): HubEcho {
  return {
    ...item,
    created_at: timeValueToMs(item.created_at),
    tags: item.tags?.map((t) => ({
      ...t,
      ...(t.created_at != null ? { created_at: timeValueToMs(t.created_at) } : {}),
    })),
  }
}

/** POST {origin}/api/echo/query（ech0 Hub 取数协议） */
export async function queryInstancePage(
  instanceUrl: string,
  body: Partial<EchoQueryBody> = {},
): Promise<HubEcho[]> {
  const merged: EchoQueryBody = { ...DEFAULT_QUERY, ...body }
  const r = await fetchJson<ApiResult<EchoQueryPage>>(
    `${normalizeHubUrl(instanceUrl)}/api/echo/query`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    },
    ECHO_QUERY_TIMEOUT_MS,
  )
  if (r.code !== 1 || !r.data || !Array.isArray(r.data.items)) {
    throw new Error(r.msg || 'query failed')
  }
  return r.data.items.map(normalizeTimes)
}

/** GET {origin}/hub.json：本实例配置的 hub 实例列表 */
export async function loadHubInstances(): Promise<HubInstance[]> {
  try {
    const r = await fetchJson<{ instances?: HubInstance[] }>('/hub.json', undefined, 5000)
    if (!Array.isArray(r.instances)) return []
    return r.instances.filter(
      (i): i is HubInstance => typeof i?.id === 'string' && typeof i?.url === 'string',
    )
  } catch {
    return []
  }
}

export { isVersionAtLeast as hubVersionAtLeast }