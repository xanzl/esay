import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { getStorageConfig, setStorageConfig, type StorageConfig } from '../../utils/storage-config'

interface UpdateStorageBody {
  type?: unknown
  s3_endpoint?: unknown
  s3_region?: unknown
  s3_bucket?: unknown
  s3_access_key_id?: unknown
  s3_secret_access_key?: unknown
  clear_secret?: unknown
}

/** 保存存储配置（站长）。Secret Key 留空表示保留原值，clear_secret=true 表示清除 */
export default defineEventHandler(async (event: H3Event) => {
  const body = (await readBody<UpdateStorageBody>(event)) ?? {}
  if (body.type !== 'r2' && body.type !== 's3') {
    throw createError({ statusCode: 400, statusMessage: '存储类型无效' })
  }

  const current = await getStorageConfig(event)
  let secretKey = current.s3_secret_access_key
  if (body.clear_secret === true) {
    secretKey = ''
  } else {
    const input = String(body.s3_secret_access_key ?? '').trim()
    if (input) secretKey = input
  }

  const config: StorageConfig = {
    type: body.type,
    s3_endpoint: String(body.s3_endpoint ?? '').trim(),
    s3_region: String(body.s3_region ?? 'us-east-1').trim() || 'us-east-1',
    s3_bucket: String(body.s3_bucket ?? '').trim(),
    s3_access_key_id: String(body.s3_access_key_id ?? '').trim(),
    s3_secret_access_key: secretKey,
  }
  await setStorageConfig(event, config)
  return { ok: true }
})