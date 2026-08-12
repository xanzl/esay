import { createError, getQuery, getRouterParam } from 'h3'
import type { H3Event } from 'h3'

/**
 * 瓦片代理：主源 CARTO（ech0 同款，宽松使用政策、支持亮暗主题），
 * 备用 OSM（带合规 User-Agent + Referer，仅作回退）。
 * openstreetmap.org 直连在国内不稳定且对高频代理请求有限制（osm.wiki/Blocked）。
 */

const CARTO_LIGHT = 'https://a.basemaps.cartocdn.com/light_all'
const CARTO_DARK = 'https://a.basemaps.cartocdn.com/dark_all'
const OSM_TILE = 'https://tile.openstreetmap.org'

const APP_UA = 'Esay/1.0 (https://mm.020504.xyz)'

export default defineEventHandler(async (event: H3Event) => {
  const z = Number(getRouterParam(event, 'z'))
  const x = Number(getRouterParam(event, 'x'))
  const y = Number(String(getRouterParam(event, 'y') ?? '').replace(/\.png$/i, ''))
  if (
    !Number.isInteger(z) || z < 0 || z > 19 ||
    !Number.isInteger(x) || x < 0 || x >= 2 ** z ||
    !Number.isInteger(y) || y < 0 || y >= 2 ** z
  ) {
    throw createError({ statusCode: 400, statusMessage: '无效的瓦片坐标' })
  }

  const style = getQuery(event).style === 'dark' ? 'dark' : 'light'
  const upstreams: Array<{ url: string; headers?: Record<string, string> }> = [
    { url: `${style === 'dark' ? CARTO_DARK : CARTO_LIGHT}/${z}/${x}/${y}.png` },
    { url: `${OSM_TILE}/${z}/${x}/${y}.png`, headers: { 'User-Agent': APP_UA } },
  ]

  let lastError: unknown = null
  for (const upstream of upstreams) {
    try {
      const res = await fetch(upstream.url, {
        headers: upstream.headers,
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const headers = new Headers(res.headers)
        headers.set('Content-Type', 'image/png')
        headers.set('Cache-Control', 'public, max-age=86400, immutable')
        return new Response(res.body, { status: 200, headers })
      }
      lastError = new Error(`upstream HTTP ${res.status}`)
    } catch (error) {
      lastError = error
    }
  }
  console.error(`[tiles] 所有上游均失败 ${z}/${x}/${y}:`, lastError)
  throw createError({ statusCode: 502, statusMessage: '瓦片代理请求失败' })
})