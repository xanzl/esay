import type { H3Event } from 'h3'
import { getEnv } from '../utils/env'
import { createD1Repo } from './repo.d1'
import { createPgRepo } from './repo.pg'
import type { DbRepo } from './types'

/** 按 DB_TYPE 选择 D1 或 PostgreSQL 仓库实现 */
export function getRepo(event: H3Event): DbRepo {
  const env = getEnv(event)
  if ((env.DB_TYPE ?? 'd1') === 'postgresql') {
    if (!env.DATABASE_URL) {
      throw new Error('DB_TYPE=postgresql 时必须配置 DATABASE_URL')
    }
    return createPgRepo(env.DATABASE_URL)
  }
  if (!env.DB) {
    throw new Error('未配置 D1 数据库绑定（DB），或未设置 DATABASE_URL')
  }
  return createD1Repo(env.DB)
}
