import type { H3Event } from 'h3'
import { getRepo } from '../db/client'
import { requestOrigin } from '../utils/http'
import { getConfig } from '../utils/config'
import { hubResult, HUB_PROTOCOL_VERSION } from '../utils/hub-protocol'
import { getInstanceName } from '../utils/site-config'

/**
 * ech0 Connect 协议端点：GET /api/connect（公开，供 Hub 取站点元信息）。
 * 字段对齐 ech0 的 Connect 模型。
 */
export default defineEventHandler(async (event: H3Event) => {
  const config = getConfig(event)
  const repo = getRepo(event)
  const site = await repo.getSite()
  const baseUrl = config.appUrl || requestOrigin(event)
  const now = Date.now()
  const dayStart = now - (now % 86400000)
  const [totalEchos, todayEchos] = await Promise.all([
    repo.countPosts(),
    repo.countPostsSince(dayStart),
  ])

  return hubResult({
    server_name: await getInstanceName(event),
    server_url: baseUrl,
    logo: site?.avatar_url || '',
    total_echos: totalEchos,
    today_echos: todayEchos,
    sys_username: site?.username || '',
    version: HUB_PROTOCOL_VERSION,
  })
})