import { AwsClient } from 'aws4fetch'
import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { getEnv } from './env'
import { getStorageConfig, type StorageConfig } from './storage-config'

export interface StoredObject {
  body: ReadableStream
  contentType: string
}

export interface ProbeResult {
  ok: boolean
  message: string
}

export interface StorageAdapter {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<StoredObject | null>
  probe(): Promise<ProbeResult>
}

function r2Adapter(bucket: R2Bucket): StorageAdapter {
  return {
    async put(key, data, contentType) {
      await bucket.put(key, data, { httpMetadata: { contentType } })
    },
    async get(key) {
      const object = await bucket.get(key)
      if (!object) return null
      return {
        body: object.body as unknown as ReadableStream,
        contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      }
    },
    async probe() {
      try {
        await bucket.head('__moment_probe__')
        return { ok: true, message: 'R2 连接正常' }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

function s3Adapter(cfg: Pick<StorageConfig, 's3_endpoint' | 's3_region' | 's3_bucket' | 's3_access_key_id' | 's3_secret_access_key'>): StorageAdapter {
  const endpoint = (cfg.s3_endpoint || 'https://s3.amazonaws.com').replace(/\/+$/, '')
  const bucket = cfg.s3_bucket
  const client = new AwsClient({
    accessKeyId: cfg.s3_access_key_id ?? '',
    secretAccessKey: cfg.s3_secret_access_key ?? '',
    region: cfg.s3_region ?? 'us-east-1',
    service: 's3',
  })
  const url = (key: string) => `${endpoint}/${bucket}${key ? `/${key}` : ''}`

  return {
    async put(key, data, contentType) {
      const request = new Request(url(key), {
        method: 'PUT',
        body: data as unknown as ArrayBuffer,
        headers: { 'Content-Type': contentType },
      })
      const response = await fetch(url(key), await client.sign(request))
      if (!response.ok) {
        throw new Error(`S3 上传失败 (${response.status})`)
      }
    },
    async get(key) {
      const request = new Request(url(key))
      const response = await fetch(url(key), await client.sign(request))
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`S3 读取失败 (${response.status})`)
      }
      return {
        body: response.body as ReadableStream<Uint8Array>,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      }
    },
    async probe() {
      try {
        const request = new Request(url(''), { method: 'HEAD' })
        const response = await fetch(url(''), {
          ...(await client.sign(request)),
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok || response.status === 403 || response.status === 404) {
          return { ok: true, message: `S3 连接正常（HTTP ${response.status}）` }
        }
        return { ok: false, message: `S3 返回异常状态（HTTP ${response.status}）` }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

/** 选择存储适配器：后台配置优先，其次环境变量，默认 R2 */
export async function getStorage(event: H3Event): Promise<StorageAdapter> {
  const config = await getStorageConfig(event)
  const env = getEnv(event)
  if (config.type === 's3' && config.s3_access_key_id && config.s3_bucket) {
    return s3Adapter(config)
  }
  if (env.STORAGE_TYPE === 's3' && env.S3_ACCESS_KEY_ID && env.S3_BUCKET) {
    return s3Adapter({
      s3_endpoint: env.S3_ENDPOINT ?? '',
      s3_region: env.S3_REGION ?? 'us-east-1',
      s3_bucket: env.S3_BUCKET ?? '',
      s3_access_key_id: env.S3_ACCESS_KEY_ID ?? '',
      s3_secret_access_key: env.S3_SECRET_ACCESS_KEY ?? '',
    })
  }
  if (!env.R2) {
    throw new Error('未配置 R2 存储绑定（R2）')
  }
  return r2Adapter(env.R2)
}

/** 按给定配置测试连接（保存前试连用），可空密钥走 R2 判断 */
export async function probeStorage(config: StorageConfig): Promise<ProbeResult> {
  if (config.type === 's3' && config.s3_access_key_id && config.s3_bucket) {
    return s3Adapter(config).probe()
  }
  return { ok: false, message: '未提供完整的 S3 配置（Access Key 与 Bucket 必填）' }
}