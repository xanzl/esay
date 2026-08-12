/** ech0 Hub 实例兼容协议版本（hub 要求 version ≥ 4.4.0 才收录） */
export const HUB_PROTOCOL_VERSION = '4.4.0'

export const HUB_SUCCESS_CODE = 1

/** ech0 风格统一响应信封 */
export function hubResult<T>(data: T, msg = 'ok') {
  return { code: HUB_SUCCESS_CODE, msg, data }
}