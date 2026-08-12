import { createError, getHeader, getRequestIP, getRouterParam, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../../db/client'
import { isValidUuid } from '../../../utils/uuidv7'
import { checkRateLimit } from '../../../utils/ratelimit'
import { verifyTurnstile } from '../../../utils/turnstile'
import { getCommentSettings } from '../../../utils/comment-settings'

const MAX_NICKNAME = 50
const MAX_EMAIL = 255
const MAX_WEBSITE = 255
const MAX_CONTENT = 1000

interface CreateCommentBody {
  nickname?: string
  email?: string
  website?: string
  content?: string
  parent_id?: string
  turnstile_token?: string
}

function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip)
  return crypto.subtle
    .digest('SHA-256', bytes)
    .then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''))
}

/** 创建评论：访客可评论（Turnstile + IP 限流），是否待审核取决于站点设置 */
export default defineEventHandler(async (event: H3Event) => {
  const postId = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(postId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }

  const repo = getRepo(event)
  const post = await repo.getPost(postId)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }

  const settings = await getCommentSettings(event)
  if (!settings.enable_comment) {
    throw createError({ statusCode: 403, statusMessage: '评论功能已关闭' })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!checkRateLimit(event, `comment:${ip}`, 8, 10 * 60 * 1000)) {
    throw createError({ statusCode: 429, statusMessage: '评论过于频繁，请稍后再试' })
  }

  const body = await readBody<CreateCommentBody>(event)
  const nickname = String(body.nickname ?? '').trim()
  const email = String(body.email ?? '').trim()
  const website = String(body.website ?? '').trim()
  const content = String(body.content ?? '').trim()
  const parentId = body.parent_id ? String(body.parent_id).trim() : ''

  if (!content) {
    throw createError({ statusCode: 400, statusMessage: '评论内容不能为空' })
  }
  if (content.length > MAX_CONTENT) {
    throw createError({ statusCode: 400, statusMessage: `评论不能超过 ${MAX_CONTENT} 字` })
  }
  if (nickname.length > MAX_NICKNAME) {
    throw createError({ statusCode: 400, statusMessage: `昵称不能超过 ${MAX_NICKNAME} 字` })
  }
  if (email.length > MAX_EMAIL) {
    throw createError({ statusCode: 400, statusMessage: `邮箱不能超过 ${MAX_EMAIL} 字` })
  }
  if (website.length > MAX_WEBSITE) {
    throw createError({ statusCode: 400, statusMessage: `网址不能超过 ${MAX_WEBSITE} 字` })
  }
  // 仅允许 http/https 协议，拒绝 javascript: 等可执行 scheme（防存储型 XSS）
  if (website) {
    let parsed: URL
    try {
      parsed = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
    } catch {
      parsed = null as unknown as URL
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      throw createError({ statusCode: 400, statusMessage: '网址格式不正确' })
    }
  }

  if (!(await verifyTurnstile(event, String(body.turnstile_token ?? ''), 'comment'))) {
    throw createError({ statusCode: 403, statusMessage: '人机验证未通过，请刷新后重试' })
  }

  // 两级盖楼：parent 必须存在、属于同一篇说说、且为顶层评论
  let normalizedParentId: string | null = null
  if (parentId) {
    if (!isValidUuid(parentId)) {
      throw createError({ statusCode: 400, statusMessage: '无效的父评论 ID' })
    }
    const parent = await repo.getComment(parentId)
    if (!parent || parent.post_id !== postId) {
      throw createError({ statusCode: 400, statusMessage: '回复的评论不存在' })
    }
    normalizedParentId = parent.parent_id ?? parent.id
  }

  const userAgent = getHeader(event, 'user-agent') ?? ''
  const comment = await repo.createComment({
    postId,
    parentId: normalizedParentId,
    nickname: nickname || '匿名',
    email,
    website,
    content,
    status: settings.require_approval ? 'pending' : 'approved',
    ipHash: await hashIp(`${ip}:${userAgent.slice(0, 64)}`),
    now: Date.now(),
  })
  return { comment }
})