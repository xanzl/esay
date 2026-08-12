import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { setHubInstances } from '../../utils/hub-config'

interface UpdateInstancesBody {
  instances?: Array<{ id?: unknown; url?: unknown }>
}

/** 保存 hub 实例配置（站长） */
export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<UpdateInstancesBody>(event)
  if (!Array.isArray(body.instances)) {
    throw createError({ statusCode: 400, statusMessage: '参数无效' })
  }
  const instances = body.instances
    .filter((i) => typeof i?.id === 'string' && typeof i?.url === 'string')
    .map((i) => ({ id: i.id as string, url: i.url as string }))
  await setHubInstances(event, instances)
  return { ok: true }
})