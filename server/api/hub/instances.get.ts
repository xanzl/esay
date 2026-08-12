import type { H3Event } from 'h3'
import { getHubInstances } from '../../utils/hub-config'

/** 获取 hub 实例配置（站长） */
export default defineEventHandler(async (event: H3Event) => {
  const instances = await getHubInstances(event)
  return { instances }
})