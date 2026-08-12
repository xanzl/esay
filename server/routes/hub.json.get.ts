import type { H3Event } from 'h3'
import { getHubInstances } from '../utils/hub-config'

/** ech0 Hub 站点配置：GET /hub.json（非 /api 前缀），实例列表由站长在设置页维护 */
export default defineEventHandler(async (event: H3Event) => {
  const instances = await getHubInstances(event)
  return { instances }
})