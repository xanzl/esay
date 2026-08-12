import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { toApiUser } from '../../utils/http'

/** 获取当前登录用户；未登录返回 user: null */
export default defineEventHandler(async (event: H3Event) => {
  const userId = (event.context as { user?: { id: number } }).user?.id
  if (!userId) return { user: null }
  const user = await getRepo(event).getUserById(userId)
  return { user: user ? toApiUser(user) : null }
})
