import type { H3Event } from 'h3'
import { getEnv, resolveDbType } from '../../utils/env'
import { getRepo } from '../../db/client'

export interface DbHealth {
  dbConnected: boolean
  dbType: 'd1' | 'postgresql'
  reason?: 'missing_d1_binding' | 'missing_database_url' | 'connect_error'
  message?: string
}

/** 数据库连通性检查：初始化前先确认已连接数据库，失败时返回指导前端引导用户的 reason */
export default defineEventHandler(async (event: H3Event): Promise<DbHealth> => {
  const env = getEnv(event)
  const dbType = resolveDbType(env)

  if (dbType === 'postgresql' && !env.DATABASE_URL) {
    return { dbConnected: false, dbType, reason: 'missing_database_url' }
  }
  if (dbType === 'd1' && !env.DB) {
    return { dbConnected: false, dbType, reason: 'missing_d1_binding' }
  }

  try {
    const repo = getRepo(event)
    const count = await repo.countUsers()
    console.log(`[esay] setup/health dbConnected=true dbType=${dbType} userCount=${count}`)
    return { dbConnected: true, dbType }
  } catch (error) {
    console.error(JSON.stringify({
      message: 'setup/health failed',
      error: error instanceof Error ? error.message : String(error),
    }))
    return {
      dbConnected: false,
      dbType,
      reason: 'connect_error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
})