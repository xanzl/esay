import { readBody } from 'h3'
import type { H3Event } from 'h3'
import { queryEchos, type EchoQueryBody } from '../../utils/echo-query'

/**
 * ech0 Hub 取数协议端点：POST /api/echo/query（公开，新版协议）。
 * body/响应字段对齐 ech0 的 EchoQueryDto / PageQueryResult。
 */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<EchoQueryBody>(event).catch(() => ({} as EchoQueryBody))) ?? ({} as EchoQueryBody)
  return await queryEchos(event, body)
})
