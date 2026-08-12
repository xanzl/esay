import type { H3Event } from 'h3'
import { getRepo } from '../db/client'
import { requestOrigin } from './http'
import { getConfig } from './config'
import { hubResult } from './hub-protocol'
import type { PostExtension } from '../db/types'

export const ECHO_QUERY_MAX_FETCH = 500

export interface EchoQueryBody {
  page?: number
  pageSize?: number
  search?: string
  tagIds?: string[]
  sortBy?: string
  sortOrder?: string
  dateFrom?: number
  dateTo?: number
}

interface HubEchoFile {
  id: string
  echo_id: string
  file_id: string
  sort_order: number
  file: {
    id: string
    key: string
    storage_type: string
    url: string
    name: string
    content_type: string
    category: string
    size: number
    width: number
    height: number
  }
}

function guessContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  }
  return map[ext] ?? 'image/jpeg'
}

/** 由平台 + 歌曲 ID 构造 ech0 可解析的源站链接（网易云/QQ；酷狗/酷我 ech0 不支持解析） */
function musicPlatformUrl(server: string, id: string): string {
  const base: Record<string, string> = {
    netease: 'https://music.163.com/#/song?id=',
    tencent: 'https://y.qq.com/n/ryqq/songDetail/',
    kugou: 'https://www.kugou.com/song/#hash=',
    kuwo: 'https://www.kuwo.cn/play_detail/',
  }
  return `${base[server] ?? base.netease}${id}`
}

/**
 * 将本端扩展 payload 适配为 ech0 卡片期望的字段：
 * - GITHUBPROJ：ech0 读 payload.repoUrl 渲染卡片，本端存的是 url
 * - MUSIC：ech0 从 payload.url 用 parseMusicURL 解析平台与 ID（本端 url 是 Meting 音频直链，需换成源站链接）
 * - LOCATION：ech0 读 payload.placeholder，本端存的是 name
 */
function normalizeExtensionForHub(ext: PostExtension | null): PostExtension | null {
  if (!ext) return null
  const type = ext.type
  const payload = { ...ext.payload }
  if (type === 'GITHUBPROJ') {
    if (!payload.repoUrl && payload.url) payload.repoUrl = String(payload.url)
  } else if (type === 'MUSIC') {
    const jumpUrl = String(payload.jump_url ?? '')
    const id = String(payload.id ?? '')
    const server = String(payload.server ?? 'netease')
    const sourceUrl = jumpUrl || (id ? musicPlatformUrl(server, id) : String(payload.url ?? ''))
    if (sourceUrl) payload.url = sourceUrl
  } else if (type === 'LOCATION') {
    if (!payload.placeholder && payload.name) payload.placeholder = String(payload.name)
  }
  return { type, payload }
}

/**
 * ech0 Hub 取数协议核心：对 ech0 的 EchoQueryDto / PageQueryDto 返回统一分页结果。
 * 同时服务 POST /api/echo/query（新版）与 POST /api/echo/page（旧版兼容）。
 */
export async function queryEchos(event: H3Event, body: EchoQueryBody) {
  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.min(Math.max(Number(body.pageSize) || 10, 1), 100)
  const search = String(body.search ?? '').trim()
  const dateFrom = Number(body.dateFrom) > 0 ? Number(body.dateFrom) * 1000 : undefined
  const dateTo = Number(body.dateTo) > 0 ? Number(body.dateTo) * 1000 : undefined

  const repo = getRepo(event)
  let posts = search
    ? await repo.searchPosts(search, ECHO_QUERY_MAX_FETCH)
    : (await repo.listPosts({ limit: ECHO_QUERY_MAX_FETCH, cursor: null })).posts

  posts = posts.filter((p) => !p.private)

  if (dateFrom !== undefined || dateTo !== undefined) {
    posts = posts.filter(
      (p) =>
        (dateFrom === undefined || p.created_at >= dateFrom) &&
        (dateTo === undefined || p.created_at <= dateTo),
    )
  }

  const total = posts.length
  const pagePosts = posts.slice((page - 1) * pageSize, page * pageSize)

  const site = await repo.getSite()
  const username = site?.username ?? ''
  const baseUrl = getConfig(event).appUrl || requestOrigin(event)
  const likeStats = await repo.getLikesInfo(pagePosts.map((p) => p.id), '')

  const items = pagePosts.map((p) => {
    const echoFiles: HubEchoFile[] = p.images.map((img, i) => {
      const key = img.replace(/^\//, '')
      const name = key.split('/').pop() ?? `image-${i}`
      const fileId = `${p.id}-${i}`
      return {
        id: fileId,
        echo_id: p.id,
        file_id: fileId,
        sort_order: i,
        file: {
          id: fileId,
          key,
          storage_type: 'object',
          url: new URL(img, baseUrl).toString(),
          name,
          content_type: guessContentType(name),
          category: 'image',
          size: 0,
          width: 0,
          height: 0,
        },
      }
    })
    return {
      id: p.id,
      content: p.content,
      username,
      created_at: Math.floor(p.created_at / 1000),
      fav_count: likeStats.get(p.id)?.count ?? 0,
      tags: p.tags.map((t) => ({ id: t.id, name: t.name })),
      echo_files: echoFiles,
      layout: echoFiles.length ? 'waterfall' : 'none',
      extension: normalizeExtensionForHub(p.extension),
      private: p.private,
      user_id: '',
    }
  })

  return hubResult({ total, items })
}
