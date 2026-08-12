import type { H3Event } from 'h3'
import { getSiteConfig } from '../../utils/site-config'

/** 读取实例配置（站长） */
export default defineEventHandler(async (event: H3Event) => {
  return await getSiteConfig(event)
})