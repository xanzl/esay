import type { PostCursor } from '../db/types'
import { isValidUuid } from './uuidv7'

/** 游标编解码：`{createdAt}_{id}` 字符串 ↔ PostCursor（时间线/公开 API 共用） */
export function parseCursor(raw: unknown): PostCursor | null {
  if (typeof raw !== 'string' || !raw) return null
  const [ts, id] = raw.split('_')
  const createdAt = Number(ts)
  if (!Number.isFinite(createdAt) || !isValidUuid(id)) return null
  return { createdAt, id }
}
export function serializeCursor(cursor: PostCursor | null): string | null {
  return cursor ? `${cursor.createdAt}_${cursor.id}` : null
}
