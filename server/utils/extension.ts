import type { H3Event } from 'h3'
import type { PostExtension } from '../db/types'
import { getEnv, type Env } from './env'
import { getSiteConfig } from './site-config'
import { getRepo } from '../db/client'

export const EXTENSION_TYPES = [
  'WEBSITE',
  'GITHUBPROJ',
  'MUSIC',
  'VIDEO',
  'LOCATION',
  'TWEET',
] as const

export const DEFAULT_METING_API = 'https://api.injahow.cn/meting/'

/** GitHub 解析结果缓存时长（24 小时，规避 API 限流与重复抓取） */
export const GITHUB_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** 从 HTML 中粗略提取 og:title / <title> */
function extractTitle(html: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)
  if (og?.[1]) return og[1].trim()
  const og2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html)
  if (og2?.[1]) return og2[1].trim()
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (title?.[1]) return title[1].replace(/\s+/g, ' ').trim()
  return ''
}

function cleanUrl(raw: string): string {
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}

/** 私网/环回/链路本地/元数据地址段（IPv4 与 IPv6），用于拒绝 SSRF 目标 */
const BLOCKED_HOST_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|::1$|fe80:|fc00:|fd00:|fec0:|::ffff:)/i

/**
 * 校验外呼 URL：仅允许 http/https，且目标必须是公网地址。
 * 返回规范化后的 URL；不合法返回 null。
 */
function safeOutboundUrl(raw: string): string | null {
  const url = cleanUrl(raw)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (!host || BLOCKED_HOST_RE.test(host)) return null
  return url
}

/** 抓取网站标题（og:title 优先） */
async function fetchWebsiteMeta(rawUrl: string): Promise<{ title: string; site: string }> {
  const site = safeOutboundUrl(rawUrl) ?? ''
  if (!site) {
    return { title: String(rawUrl).trim(), site: String(rawUrl).trim() }
  }
  try {
    const res = await fetch(site, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; EsayBot/1.0)' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const title = extractTitle(html)
    return { title: title || site.replace(/^https?:\/\//, '').replace(/\/$/, ''), site }
  } catch {
    return { title: site.replace(/^https?:\/\//, '').replace(/\/$/, ''), site }
  }
}

/** 解析 GitHub 仓库 URL 并拉取仓库信息（名称/描述/星标/fork/作者头像），带 24h 缓存与 Token 支持 */
async function fetchGithubRepo(
  rawUrl: string,
  event?: H3Event,
): Promise<Record<string, string | number>> {
  const url = cleanUrl(rawUrl)
  const match = /github\.com\/([^/]+)\/([^/?#]+)/i.exec(url)
  const owner = match?.[1] ?? ''
  const repo = match?.[2]?.replace(/\.git$/i, '') ?? ''
  if (!owner || !repo) {
    return { url, owner, repo, name: repo, description: '', stars: 0, forks: 0, avatar: '' }
  }
  // GitHub 仓库名大小写不敏感，缓存键统一小写，大小写不同的链接可复用同一份结果
  const cacheKey = `github:${owner.toLowerCase()}/${repo.toLowerCase()}`
  if (event) {
    try {
      const cached = await getRepo(event).getCache(cacheKey)
      if (cached && Date.now() - cached.createdAt < GITHUB_CACHE_TTL_MS) {
        const data = JSON.parse(cached.payload) as Record<string, string | number>
        return { url, owner, repo, ...data }
      }
    } catch {
      /* 缓存不可用不阻塞解析 */
    }
  }
  try {
    const env = event ? getEnv(event) : (process.env as Env)
    const token = env.GITHUB_TOKEN?.trim()
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'user-agent': 'Esay/1.0',
    }
    if (token) headers.authorization = `Bearer ${token}`
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        name?: string
        description?: string | null
        stargazers_count?: number
        forks_count?: number
        owner?: { avatar_url?: string }
        full_name?: string
      }
      const payload = {
        name: data.name ?? repo,
        description: data.description ?? '',
        stars: data.stargazers_count ?? 0,
        forks: data.forks_count ?? 0,
        avatar: data.owner?.avatar_url ?? '',
      }
      if (event) {
        try {
          await getRepo(event).setCache(cacheKey, JSON.stringify(payload), Date.now())
        } catch {
          /* 缓存写入失败不影响返回 */
        }
      }
      return { url, owner, repo, ...payload }
    }
  } catch {
    /* GitHub API 失败时用兜底数据 */
  }
  return { url, owner, repo, name: repo, description: '', stars: 0, forks: 0, avatar: '' }
}

/** 从音乐链接/短链解析平台与歌曲 ID（先跟随重定向拿最终地址） */
export function parseMusicUrl(finalUrl: string): { server: string; id: string } | null {
  const idMatch =
    /[?&]id=(\d+)/i.exec(finalUrl) ??
    /\/song\/(\d+)/i.exec(finalUrl) ??
    /\/songDetail\/([0-9A-Za-z]+)/i.exec(finalUrl) ??
    /[?#&]hash=([0-9A-Za-z]+)/i.exec(finalUrl) ??
    /\/play_detail\/(\d+)/i.exec(finalUrl)
  const id = idMatch?.[1] ?? ''
  if (!id) return null
  const host = finalUrl.toLowerCase()
  let server = 'netease'
  if (host.includes('qq.com')) server = 'tencent'
  else if (host.includes('kugou')) server = 'kugou'
  else if (host.includes('kuwo')) server = 'kuwo'
  else if (host.includes('163') || host.includes('163cn.tv')) server = 'netease'
  return { server, id }
}

/** 跟随重定向解析短链（如 https://163cn.tv/xxx、QQ 音乐 c6.y.qq.com 分享链）的最终地址 */
async function resolveFinalUrl(rawUrl: string): Promise<string> {
  try {
    const res = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok && res.url && res.url !== rawUrl && safeOutboundUrl(res.url)) return res.url
    if (res.ok && res.url && safeOutboundUrl(res.url)) return res.url
    // HEAD 被拒（如 QQ 音乐短链返回 500）：改用 GET 跟随重定向
  } catch {
    /* fallthrough to GET */
  }
  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; EsayBot/1.0)' },
    })
    return res.url && safeOutboundUrl(res.url) ? res.url : rawUrl
  } catch {
    return rawUrl
  }
}

/** 通过 Meting API 解析音乐（网易云/QQ/酷狗等），失败时保留原始 id */
async function resolveMusic(
  server: string,
  id: string,
  event?: H3Event,
): Promise<Record<string, string | number>> {
  try {
    let endpoint = DEFAULT_METING_API
    if (event) {
      const config = await getSiteConfig(event)
      endpoint = config.meting_api?.trim() || getEnv(event).METING_API?.trim() || endpoint
    }
    const res = await fetch(
      `${endpoint.replace(/\/+$/, '')}?server=${encodeURIComponent(server)}&type=song&id=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (res.ok) {
      const list = (await res.json()) as Array<{
        name?: string
        artist?: string
        url?: string
        pic?: string
      }>
      const track = list[0]
      if (track) {
        return {
          server,
          type: 'song',
          id,
          name: track.name ?? '',
          artist: track.artist ?? '',
          url: track.url ?? '',
          cover: track.pic ?? '',
        }
      }
    }
  } catch {
    /* 解析失败时回退 */
  }
  return { server, type: 'song', id }
}

/** 解析视频链接：B 站（bvid，含移动端/带参）/ YouTube（video id，含 embed/shorts） */
function parseVideoUrl(rawUrl: string): Record<string, string> {
  const url = cleanUrl(rawUrl)
  const bili = /(?:bilibili\.com\/(?:video|list\/[^/?#]+\/video)\/|bvid=)(BV[0-9A-Za-z]+)/i.exec(url)
  if (bili?.[1]) return { type: 'bilibili', videoId: bili[1], url }
  const mbili = /(?:m\.bilibili\.com\/video\/)(BV[0-9A-Za-z]+)/i.exec(url)
  if (mbili?.[1]) return { type: 'bilibili', videoId: mbili[1], url }
  const yt = /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/i.exec(url)
  if (yt?.[1]) return { type: 'youtube', videoId: yt[1], url }
  return { type: 'bilibili', videoId: '', url }
}

/** 视频短链（b23.tv 等）：跟随重定向后用完整链接解析 */
async function resolveVideoUrl(rawUrl: string): Promise<Record<string, string>> {
  const url = cleanUrl(rawUrl)
  if (/b23\.tv\//i.test(url) || /^(?:https?:\/\/)?b23\.tv\//i.test(url)) {
    const finalUrl = await resolveFinalUrl(url)
    if (finalUrl && finalUrl !== url) return parseVideoUrl(finalUrl)
  }
  return parseVideoUrl(url)
}

/** 解析推文链接：twitter.com / x.com 的 /status/{id} */
function parseTweetUrl(rawUrl: string): Record<string, string> {
  const url = cleanUrl(rawUrl)
  const match = /(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i.exec(url)
  if (match?.[1] && match?.[2]) {
    return { url, username: match[1], statusId: match[2] }
  }
  return { url, username: '', statusId: '' }
}

/**
 * 归一化并补全扩展：前端只提交 { type, payload: { url } }，
 * 此处抓取元数据补全标题/描述等展示字段。抓取失败不阻塞发布。
 */
export async function normalizeExtension(
  raw: PostExtension | null | undefined,
  event?: H3Event,
): Promise<PostExtension | null> {
  if (!raw) return null
  const type = String(raw.type ?? '')
  const payload = { ...(raw.payload ?? {}) }
  if (!EXTENSION_TYPES.includes(type as (typeof EXTENSION_TYPES)[number])) return null

  const url = String(payload.url ?? '').trim()
  if (type === 'WEBSITE' && url) {
    const meta = await fetchWebsiteMeta(url)
    payload.title = meta.title
    payload.site = meta.site
  } else if (type === 'GITHUBPROJ' && url) {
    Object.assign(payload, await fetchGithubRepo(url, event))
  } else if (type === 'MUSIC') {
    const raw = String(payload.id ?? payload.url ?? '').trim()
    const isLink = /^https?:\/\//i.test(raw)
    let server = String(payload.server ?? 'netease')
    let id = raw
    let jumpUrl = ''
    if (isLink) {
      // 直连链接/短链：跟随重定向解析平台与歌曲 ID，跳转链接保留原地址
      jumpUrl = raw
      const finalUrl = await resolveFinalUrl(raw)
      const parsed = parseMusicUrl(finalUrl)
      if (parsed) {
        server = parsed.server
        id = parsed.id
      }
    }
    payload.jump_url = jumpUrl
    payload.server = server
    if (id) Object.assign(payload, await resolveMusic(server, id, event))
  } else if (type === 'VIDEO' && url) {
    Object.assign(payload, await resolveVideoUrl(url))
  } else if (type === 'LOCATION') {
    const name = String(payload.name ?? '').trim()
    const latitude = Number(payload.latitude)
    const longitude = Number(payload.longitude)
    if (name) payload.name = name
    if (Number.isFinite(latitude)) payload.latitude = latitude
    if (Number.isFinite(longitude)) payload.longitude = longitude
  } else if (type === 'TWEET' && url) {
    Object.assign(payload, parseTweetUrl(url))
  }
  return { type, payload } as PostExtension
}