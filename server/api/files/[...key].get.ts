import { createError, getRouterParam, setResponseHeaders } from 'h3'
import type { H3Event } from 'h3'
import { getStorage } from '../../utils/storage'

const SAFE_KEY_PATTERN = /^posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i

/** 图片代理：通过 Worker 读取 R2/S3 对象并返回（带长缓存头，避免为存储桶单独配置公开域名） */
export default defineEventHandler(async (event: H3Event) => {
  const key = getRouterParam(event, 'key') ?? ''
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw createError({ statusCode: 404, statusMessage: '文件不存在' })
  }

  const object = await (await getStorage(event)).get(key)
  if (!object) {
    throw createError({ statusCode: 404, statusMessage: '文件不存在' })
  }

  setResponseHeaders(event, {
    'Content-Type': object.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  return object.body
})
