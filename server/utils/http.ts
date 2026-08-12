import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import type { PostRow, PostExtension, UserRow } from '../db/types'
import { getRepo } from '../db/client'
import { getClientIpHash } from './ip'

export interface ApiUser {
  id: number
  username: string
  nickname: string | null
  email: string | null
  website: string | null
  avatar_url: string | null
  bio: string | null
}

export interface ApiPost {
  id: string
  content: string
  images: string[]
  tags: { id: string; name: string }[]
  private: boolean
  extension: PostExtension | null
  created_at: number
  updated_at: number
  like_count: number
  liked: boolean
}

export function toApiUser(user: UserRow): ApiUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    website: user.website,
    avatar_url: user.avatar_url,
    bio: user.bio,
  }
}

export function toApiPost(post: PostRow): ApiPost {
  return {
    id: post.id,
    content: post.content,
    images: post.images,
    tags: post.tags,
    private: post.private,
    extension: post.extension,
    created_at: post.created_at,
    updated_at: post.updated_at,
    like_count: 0,
    liked: false,
  }
}

/** 为单条/多条说说挂载当前访客的点赞数与点赞状态 */
export async function withLikeStats(
  event: H3Event,
  posts: ApiPost | ApiPost[],
): Promise<ApiPost | ApiPost[]> {
  const list = Array.isArray(posts) ? posts : [posts]
  if (!list.length) return posts
  const ipHash = await getClientIpHash(event, 'like')
  const repo = getRepo(event)
  const stats = await repo.getLikesInfo(
    list.map((p) => p.id),
    ipHash,
  )
  for (const p of list) {
    const s = stats.get(p.id)
    if (s) {
      p.like_count = s.count
      p.liked = s.liked
    }
  }
  return posts
}

/** 公开 API 中把相对图片路径转为绝对地址 */
export function toPublicPost(post: PostRow, baseUrl: string): ApiPost {
  const base = new URL('/', baseUrl).toString()
  return {
    ...toApiPost(post),
    images: post.images.map((p) => new URL(p, base).toString()),
  }
}

export function requestOrigin(event: H3Event): string {
  try {
    const url = getRequestURL(event)
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}
