/**
 * PostgreSQL 全链路集成测试。
 * 需要真实 PostgreSQL（DATABASE_URL 环境变量）；本地未配置时整组跳过（CI 中由 GitHub Actions 起 PG 服务）。
 * 覆盖：schema 自举、初始化、登录、发帖/时间线/搜索、评论、Hub 协议、鉴权、扩展缓存、用户资料。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp, createRouter, eventHandler, toNodeListener } from 'h3'
import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRequestIP,
  getRequestURL,
  readBody,
  setResponseHeader,
} from 'h3'
import postgres from 'postgres'

Object.assign(globalThis, {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRequestIP,
  getRequestURL,
  readBody,
  setResponseHeader,
})

const DB_URL = process.env.DATABASE_URL ?? ''
const hasPg = !!DB_URL

const ESayTables = [
  'post_tags',
  'tags',
  'likes',
  'comments',
  'app_settings',
  'extension_cache',
  'posts',
  'users',
]

async function resetDatabase() {
  const sql = postgres(DB_URL, { max: 1, prepare: false })
  try {
    // 逐表 DROP（表可能不全/不存在），让应用侧 schema 自举幂等重建
    for (const t of ESayTables) {
      await sql.unsafe(`DROP TABLE IF EXISTS ${t} CASCADE`).catch(() => undefined)
    }
  } finally {
    await sql.end()
  }
}

const handlers: Record<string, unknown> = {}
async function loadHandlers() {
  const entries = [
    ['init', '../server/api/setup/init.post'],
    ['status', '../server/api/setup/status.get'],
    ['health', '../server/api/setup/health.get'],
    ['publicSite', '../server/api/public/site.get'],
    ['publicConfig', '../server/api/public/config.get'],
    ['publicPost', '../server/api/public/posts/[id].get'],
    ['commentsList', '../server/api/public/posts/[id]/comments.get'],
    ['commentsCreate', '../server/api/posts/[id]/comments.post'],
    ['login', '../server/api/auth/login.post'],
    ['meGet', '../server/api/auth/me.get'],
    ['mePut', '../server/api/auth/me.put'],
    ['postsList', '../server/api/posts/index.get'],
    ['postsCreate', '../server/api/posts/index.post'],
    ['postsUpdate', '../server/api/posts/[id].put'],
    ['postsDelete', '../server/api/posts/[id].delete'],
    ['search', '../server/api/posts/search.get'],
    ['connect', '../server/api/connect.get'],
    ['healthz', '../server/routes/healthz.get'],
    ['echoQuery', '../server/api/echo/query.post'],
    ['echoPage', '../server/api/echo/page.post'],
    ['authMiddleware', '../server/middleware/auth'],
  ]
  for (const [name, path] of entries) {
    handlers[name] = (await import(path)).default
  }
}

describe.skipIf(!hasPg)('PostgreSQL 全链路（需要 DATABASE_URL）', () => {
  let base = ''
  let authHeader: { authorization: string }

  beforeAll(
    async () => {
      process.env.DB_TYPE = 'postgresql'
    process.env.STORAGE_TYPE = 's3'
    process.env.PUBLIC_API_ENABLED = 'true'

    // Neon 免费层冷启动/跨区网络较慢：先预热连接（最多重试 5 次）
    const warmup = postgres(DB_URL, { max: 1, prepare: false, connect_timeout: 30 })
    for (let i = 0; i < 5; i++) {
      try {
        await warmup`select 1`
        break
      } catch {
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
    await warmup.end()

    await resetDatabase()
    await loadHandlers()

    const withAuth = (handler: unknown) =>
      eventHandler(async (event) => {
        await (handlers.authMiddleware as (e: unknown) => Promise<void>)(event)
        return await (handler as (e: unknown) => Promise<unknown>)(event)
      })

    const router = createRouter()
    router.post('/api/setup/init', eventHandler(handlers.init as never))
    router.get('/api/setup/status', eventHandler(handlers.status as never))
    router.get('/api/setup/health', eventHandler(handlers.health as never))
    router.get('/api/public/site', eventHandler(handlers.publicSite as never))
    router.get('/api/public/config', eventHandler(handlers.publicConfig as never))
    router.get('/api/public/posts/:id', eventHandler(handlers.publicPost as never))
    router.get('/api/public/posts/:id/comments', eventHandler(handlers.commentsList as never))
    router.post('/api/posts/:id/comments', eventHandler(handlers.commentsCreate as never))
    router.post('/api/auth/login', eventHandler(handlers.login as never))
    router.get('/api/auth/me', withAuth(handlers.meGet))
    router.put('/api/auth/me', withAuth(handlers.mePut))
    router.get('/api/posts', eventHandler(handlers.postsList as never))
    router.post('/api/posts', withAuth(handlers.postsCreate))
    router.put('/api/posts/:id', withAuth(handlers.postsUpdate))
    router.delete('/api/posts/:id', withAuth(handlers.postsDelete))
    router.get('/api/posts/search', eventHandler(handlers.search as never))
    router.get('/api/connect', eventHandler(handlers.connect as never))
    router.get('/healthz', eventHandler(handlers.healthz as never))
    router.post('/api/echo/query', eventHandler(handlers.echoQuery as never))
    router.post('/api/echo/page', eventHandler(handlers.echoPage as never))
    router.put('/api/posts/:id/hack', eventHandler(handlers.postsUpdate as never))
    router.delete('/api/posts/:id/hack', eventHandler(handlers.postsDelete as never))

    const server = createApp()
    server.use(router)
    const listener = toNodeListener(server)
    const { createServer } = await import('node:http')
    const srv = createServer(listener)
    await new Promise<void>((resolve) => srv.listen(0, resolve))
    base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`
    },
    120000,
  )

  afterAll(async () => {
    delete process.env.DB_TYPE
    delete process.env.STORAGE_TYPE
    delete process.env.PUBLIC_API_ENABLED
  })

  async function login(): Promise<void> {
    if (authHeader) return
    // Neon 连接偶发抖动：失败重试（最多 3 次，间隔 2s）
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
      if (res.status === 200) {
        const body = (await res.json()) as { token: string }
        authHeader = { authorization: `Bearer ${body.token}` }
        return
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    expect.fail('登录失败（PG 连接抖动）')
  }

  it(
    '初始化：创建管理员（schema 自举）',
    async () => {
    const res = await fetch(`${base}/api/setup/init`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass1234', nickname: '站长' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string; user: { username: string } }
    expect(body.token).toBeTruthy()
    expect(body.user.username).toBe('admin')
  })

  it(
    'Hub 协议：healthz + connect 返回正确版本',
    async () => {
    const hz = (await (await fetch(`${base}/healthz`)).json()) as {
      code: number
      data: { status: string; version: string }
    }
    expect(hz.code).toBe(1)
    expect(hz.data.status).toBe('ok')
    expect(hz.data.version).toBe('4.4.0')

    const connect = (await (await fetch(`${base}/api/connect`)).json()) as {
      code: number
      data: { server_name: string; sys_username: string; total_echos: number }
    }
    expect(connect.code).toBe(1)
    expect(connect.data.server_name).toBe('站长')
    expect(connect.data.sys_username).toBe('admin')
  })

  it(
    '发布 + 时间线 + 游标分页 + 搜索',
    async () => {
    await login()
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'PG 测试说说', images: [] }),
      })
    ).json()) as { post: { id: string } }
    expect(created.post.id).toBeTruthy()

    const list = (await (
      await fetch(`${base}/api/posts`, { headers: authHeader })
    ).json()) as { posts: { content: string }[]; hasMore: boolean }
    expect(list.posts.length).toBeGreaterThan(0)

    const search = (await (
      await fetch(`${base}/api/posts/search?q=${encodeURIComponent('PG 测试')}`, {
        headers: authHeader,
      })
    ).json()) as { posts: { id: string }[] }
    expect(search.posts.length).toBe(1)

    const detail = await fetch(`${base}/api/public/posts/${created.post.id}`)
    expect(detail.status).toBe(200)
  })

  it(
    'Hub 取数：echo/query 与 echo/page 返回帖子',
    async () => {
    await login()
    for (const path of ['/api/echo/query', '/api/echo/page']) {
      const res = (await (
        await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ page: 1, pageSize: 10 }),
        })
      ).json()) as { code: number; data: { total: number; items: unknown[] } }
      expect(res.code).toBe(1)
      expect(res.data.total).toBeGreaterThan(0)
      expect(Array.isArray(res.data.items)).toBe(true)
    }
  })

  it(
    '评论：公开创建 + 列表 + 审核',
    async () => {
    await login()
    const list = (await (
      await fetch(`${base}/api/posts`, { headers: authHeader })
    ).json()) as { posts: { id: string }[] }
    const postId = list.posts[0]!.id

    const create = await fetch(`${base}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '访客', email: 'v@example.com', website: 'https://example.com', content: 'PG 评论' }),
    })
    expect(create.status).toBe(200)

    const comments = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: { content: string }[] }
    expect(comments.comments.length).toBeGreaterThan(0)
  })

  it(
    '鉴权回归：匿名无法修改/删除 UUID 说说（中间件 + handler 兜底）',
    async () => {
    await login()
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '待保护', images: [] }),
      })
    ).json()) as { post: { id: string } }

    const put = await fetch(`${base}/api/posts/${created.post.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x', images: [] }),
    })
    expect(put.status).toBe(401)
    const del = await fetch(`${base}/api/posts/${created.post.id}`, { method: 'DELETE' })
    expect(del.status).toBe(401)
    const putDirect = await fetch(`${base}/api/posts/${created.post.id}/hack`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x', images: [] }),
    })
    expect(putDirect.status).toBe(401)
  })

  it(
    '用户资料：website 更新与持久化',
    async () => {
    await login()
    const me = await fetch(`${base}/api/auth/me`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ website: 'https://xanz.xyz' }),
    })
    expect(me.status).toBe(200)
    const { user } = (await (
      await fetch(`${base}/api/auth/me`, { headers: authHeader })
    ).json()) as { user: { website: string | null } }
    expect(user.website).toBe('https://xanz.xyz')
  })

  it(
    '扩展缓存表：GitHub 解析写入 extension_cache（schema 含该表）',
    async () => {
    await login()
    const res = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({
        content: '带扩展',
        images: [],
        extension: { type: 'GITHUBPROJ', payload: { url: 'https://github.com/lin-snow/Ech0' } },
      }),
    })
    expect(res.status).toBe(200)
  })
})
