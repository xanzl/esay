import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import { verifyToken } from './jwt'
import { getJwtSecret } from './jwt-secret'

/** 可选认证：携带有效 token 视为站长，否则匿名（用于私密说说的可见性判断） */
export async function isOwner(event: H3Event): Promise<boolean> {
  const header = getHeader(event, 'authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  try {
    await verifyToken(token, await getJwtSecret(event))
    return true
  } catch {
    return false
  }
}