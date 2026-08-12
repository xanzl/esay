import { readBody } from 'h3'
import type { H3Event } from 'h3'
import { queryEchos, type EchoQueryBody } from '../../utils/echo-query'

/**
 * ech0 Hub 取数协议兼容端点：POST /api/echo/page（公开，旧版协议，ech0 web 端 Hub 页仍在使用）。
 * 与 ech0 的 GetEchosByPage 一致：body 仅接受 { page, pageSize, search }，返回 PageQueryResult。
 */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<EchoQueryBody>(event).catch(() => ({} as EchoQueryBody))) ?? ({} as EchoQueryBody)
  return await queryEchos(event, body)
})
