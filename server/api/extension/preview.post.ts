import { readBody } from 'h3'
import type { H3Event } from 'h3'
import { normalizeExtension } from '../../utils/extension'
import type { PostExtension } from '../../db/types'

/** 扩展预览：确定附加内容时前端调用，返回抓取补全后的完整元数据 */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<PostExtension | null>(event).catch(() => null)) ?? null
  const extension = await normalizeExtension(body, event)
  return { extension }
})