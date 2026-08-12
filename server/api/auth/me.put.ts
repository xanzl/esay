import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { hashPassword, verifyPassword } from '../../utils/password'
import { toApiUser } from '../../utils/http'
import type { UserPatch } from '../../db/types'

interface UpdateMeBody {
  username?: string
  nickname?: string
  email?: string
  website?: string
  avatar_url?: string
  bio?: string
  current_password?: string
  new_password?: string
}

export default defineEventHandler(async (event: H3Event) => {
  const userId = (event.context as { user: { id: number } }).user.id
  const body = await readBody<UpdateMeBody>(event)
  const repo = getRepo(event)

  const user = await repo.getUserById(userId)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  const patch: UserPatch = {}
  if (body.nickname !== undefined) {
    patch.nickname = String(body.nickname ?? '').trim() || null
  }
  if (body.avatar_url !== undefined) {
    patch.avatar_url = String(body.avatar_url ?? '').trim() || null
  }
  if (body.email !== undefined) {
    const email = String(body.email ?? '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, statusMessage: '邮箱格式不正确' })
    }
    patch.email = email.length > 255 ? email.slice(0, 255) : (email || null)
  }
  if (body.website !== undefined) {
    const website = String(body.website ?? '').trim()
    patch.website = website.length > 255 ? website.slice(0, 255) : (website || null)
  }
  if (body.bio !== undefined) {
    patch.bio = String(body.bio ?? '').trim() || null
  }
  if (body.username !== undefined) {
    const username = String(body.username).trim()
    if (username && username !== user.username) {
      const exists = await repo.getUserByUsername(username)
      if (exists && exists.id !== user.id) {
        throw createError({ statusCode: 400, statusMessage: '该用户名已被占用' })
      }
      patch.username = username
    }
  }

  if (body.new_password) {
    if (!body.current_password || !(await verifyPassword(body.current_password, user.password_hash))) {
      throw createError({ statusCode: 400, statusMessage: '当前密码错误' })
    }
    const next = String(body.new_password)
    if (next.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '新密码至少 6 位' })
    }
    patch.password_hash = await hashPassword(next)
  }

  const updated = await repo.updateUser(userId, patch)
  return { user: updated ? toApiUser(updated) : toApiUser(user) }
})
