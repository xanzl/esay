import type { H3Event } from 'h3'
import { getStorageConfig } from '../../utils/storage-config'

/** 读取存储配置（站长）：S3 Secret Key 不回显，仅返回是否已设置 */
export default defineEventHandler(async (event: H3Event) => {
  const config = await getStorageConfig(event)
  return {
    type: config.type,
    s3_endpoint: config.s3_endpoint,
    s3_region: config.s3_region,
    s3_bucket: config.s3_bucket,
    s3_access_key_id: config.s3_access_key_id,
    s3_secret_access_key_set: !!config.s3_secret_access_key,
  }
})