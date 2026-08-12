import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'

/** 公开 API：已建标签列表（写说说时选择用） */
export default defineEventHandler(async (event: H3Event) => {
  const tags = await getRepo(event).listTags(50)
  return { tags }
})