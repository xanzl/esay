import { v7 as uuidv7 } from 'uuid'

/** 生成 UUIDv7 字符串（与 ech0 一致：按时间有序，可作游标排序键） */
export function generatePostId(): string {
  return uuidv7()
}

/** 校验是否为合法 UUID 格式 */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}