import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'

/** 站点公开信息：未登录访客用于展示博主身份（仅非敏感字段） */
export default defineEventHandler(async (event: H3Event) => {
  const site = await getRepo(event).getSite()
  return site
})