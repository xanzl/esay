/**
 * D1 / PG 双 repo 共享的行转换与校验逻辑。
 * 两个数据访问实现（repo.d1.ts / repo.pg.ts）使用相同的行结构，
 * 转换函数只依赖结构类型（Shape），方言差异（如 D1 integer ↔ PG boolean）在此收敛。
 * 新增字段/转换逻辑时只需改这里，避免双实现漂移。
 */
import { createHash } from 'node:crypto'
import type { CommentRow, PostExtension, PostRow, TagRow, UserRow } from './types'

export interface PostRowShape {
  id: string
  content: string
  images: string
  private: boolean | number
  extension: string | null
  createdAt: number
  updatedAt: number
}

export interface TagRowShape {
  id: string
  name: string
}

export interface UserRowShape {
  id: number
  username: string
  passwordHash: string
  nickname: string | null
  email: string | null
  website: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: number
}

export interface CommentRowShape {
  id: string
  postId: string
  parentId: string | null
  nickname: string
  email: string
  website: string
  content: string
  status: string
  createdAt: number
  updatedAt: number
}

export function parseImages(raw: string): string[] {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function parseExtension(raw: string | null): PostExtension | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (typeof value?.type === 'string' && value?.payload && typeof value.payload === 'object') {
      return { type: value.type, payload: value.payload }
    }
    return null
  } catch {
    return null
  }
}

export function toPost(row: PostRowShape, tags: TagRow[] = []): PostRow {
  return {
    id: row.id,
    content: row.content,
    images: parseImages(row.images),
    private: row.private === true || row.private === 1,
    extension: parseExtension(row.extension),
    tags,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export function toTag(row: TagRowShape): TagRow {
  return { id: row.id, name: row.name }
}

export function toUser(row: UserRowShape): UserRow {
  return {
    id: row.id,
    username: row.username,
    password_hash: row.passwordHash,
    nickname: row.nickname,
    email: row.email,
    website: row.website,
    avatar_url: row.avatarUrl,
    bio: row.bio,
    created_at: row.createdAt,
  }
}

function emailHash(email: string): string {
  const value = email.trim().toLowerCase()
  if (!value) return ''
  return createHash('md5').update(value).digest('hex')
}

export function toComment(row: CommentRowShape): CommentRow {
  return {
    id: row.id,
    post_id: row.postId,
    parent_id: row.parentId,
    nickname: row.nickname,
    website: row.website,
    content: row.content,
    status: row.status as CommentRow['status'],
    avatar: emailHash(row.email),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
