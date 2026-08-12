import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { probeStorage, type ProbeResult } from '../../utils/storage'
import { getStorageConfig, type StorageConfig } from '../../utils/storage-config'

/** 存储连接测试（站长，保存前试连）。密钥未填时沿用已保存的密钥 */
export default defineEventHandler(async (event: H3Event): Promise<ProbeResult> => {
  const body = (await readBody<Partial<StorageConfig>>(event)) ?? {}
  const current = await getStorageConfig(event)
  const config: StorageConfig = {
    type: body.type === 's3' ? 's3' : 'r2',
    s3_endpoint: String(body.s3_endpoint ?? '').trim(),
    s3_region: String(body.s3_region ?? 'us-east-1').trim() || 'us-east-1',
    s3_bucket: String(body.s3_bucket ?? '').trim(),
    s3_access_key_id: String(body.s3_access_key_id ?? '').trim(),
    s3_secret_access_key:
      String(body.s3_secret_access_key ?? '').trim() || current.s3_secret_access_key,
  }
  if (config.type !== 's3') {
    throw createError({ statusCode: 400, statusMessage: '仅支持测试 S3 配置' })
  }
  return await probeStorage(config)
})