import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { setSiteConfig } from '../../utils/site-config'

interface UpdateSiteConfigBody {
  instance_name?: unknown
  meting_api?: unknown
}

/** 保存实例配置（站长） */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<UpdateSiteConfigBody>(event)) ?? {}
  const instanceName = String(body.instance_name ?? '').trim()
  const metingApi = String(body.meting_api ?? '').trim()
  if (instanceName.length > 100) {
    throw createError({ statusCode: 400, statusMessage: '实例名称过长' })
  }
  if (metingApi.length > 300) {
    throw createError({ statusCode: 400, statusMessage: 'Meting API 地址过长' })
  }
  await setSiteConfig(event, instanceName, metingApi)
  return { ok: true }
})