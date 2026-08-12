import { hubResult, HUB_PROTOCOL_VERSION } from '../utils/hub-protocol'

/** ech0 Hub 探活端点：GET /healthz（非 /api 前缀） */
export default defineEventHandler(() => {
  return hubResult({ status: 'ok', version: HUB_PROTOCOL_VERSION })
})