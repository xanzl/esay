import { createError, getRouterParam, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getRepo } from '../../db/client'
import { toApiPost } from '../../utils/http'
import { isValidUuid } from '../../utils/uuidv7'
import { normalizeTagNames } from '../../utils/tags'
import { normalizeExtension } from '../../utils/extension'
import type { PostExtension } from '../../db/types'

interface UpdatePostBody {
  content?: string
  images?: unknown
  tag_names?: unknown
  private?: unknown
  extension?: PostExtension | null
}

const MAX_CONTENT_LENGTH = 5000
const MAX_IMAGES = 9
const IMAGE_PATH_PATTERN = /^\/api\/files\/posts\/[0-9a-f-]{36}\.[a-z0-9]+$/i

export default defineEventHandler(async (event: H3Event) => {
  if (!(event.context as { user?: unknown }).user) {
    throw createError({ statusCode: 401, statusMessage: '未登录或登录已过期' })
  }
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isValidUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的说说 ID' })
  }

  const body = await readBody<UpdatePostBody>(event)
  const content = String(body.content ?? '').trim()
  const images: string[] = Array.isArray(body.images) ? body.images.filter((i) => typeof i === 'string') : []
  const tagNames = normalizeTagNames(body.tag_names)

  if (!content && images.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '内容不能为空' })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `内容不能超过 ${MAX_CONTENT_LENGTH} 字` })
  }
  if (images.length > MAX_IMAGES) {
    throw createError({ statusCode: 400, statusMessage: `最多上传 ${MAX_IMAGES} 张图片` })
  }
  if (images.some((img) => !IMAGE_PATH_PATTERN.test(img))) {
    throw createError({ statusCode: 400, statusMessage: '包含无效的图片地址' })
  }

  const updated = await getRepo(event).updatePost(id, {
    content,
    images,
    tagNames,
    ...(body.private !== undefined ? { private: body.private === true } : {}),
    ...(body.extension !== undefined
      ? { extension: await normalizeExtension(body.extension as PostExtension | null | undefined, event) }
      : {}),
  })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '说说不存在' })
  }
  return { post: toApiPost(updated) }
})
