import { createError, readMultipartFormData } from 'h3'
import type { H3Event } from 'h3'
import { getStorage } from '../utils/storage'

const MAX_FILE_SIZE = 8 * 1024 * 1024 // 8MB
const MAX_PARTS = 16 // 单请求 multipart part 数量上限（防内存 DoS）

/** 上传图片（multipart/form-data，字段名 file），返回相对访问路径 */
export default defineEventHandler(async (event: H3Event) => {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0 || parts.length > MAX_PARTS) {
    throw createError({ statusCode: 400, statusMessage: '上传参数无效' })
  }
  const file = parts.find((p) => p.name === 'file')
  if (!file?.data || !file.filename) {
    throw createError({ statusCode: 400, statusMessage: '未接收到文件' })
  }
  if (!file.type || !file.type.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: '仅支持图片文件' })
  }
  if (file.data.byteLength > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: '图片大小不能超过 8MB' })
  }

  const ext = (file.filename.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  // 拒绝 SVG（可含脚本，作为同源静态资源直接访问有 XSS 风险）
  if (ext === 'svg' || file.type === 'image/svg+xml') {
    throw createError({ statusCode: 400, statusMessage: '不支持 SVG 图片' })
  }
  const key = `posts/${crypto.randomUUID()}.${ext}`

  await (await getStorage(event)).put(key, new Uint8Array(file.data), file.type)
  return { url: `/api/files/${key}` }
})
