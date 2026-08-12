import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import type { StatementSync } from 'node:sqlite'
import type { D1Database } from '@cloudflare/workers-types'
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

const {
  default: statusHandler,
} = await import('../server/api/setup/status.get')
const { default: initHandler } = await import('../server/api/setup/init.post')
const { default: healthHandler } = await import('../server/api/setup/health.get')
const { default: publicSiteHandler } = await import('../server/api/public/site.get')
const { default: publicConfigHandler } = await import('../server/api/public/config.get')
const { default: publicPostGetHandler } = await import('../server/api/public/posts/[id].get')
const { default: commentsListHandler } = await import('../server/api/public/posts/[id]/comments.get')
const { default: commentsCreateHandler } = await import('../server/api/posts/[id]/comments.post')
const { default: commentsStatusHandler } = await import('../server/api/comments/[id].put')
const { default: commentsSettingsHandler } = await import('../server/api/comments/settings.put')
const { default: commentsDeleteHandler } = await import('../server/api/comments/[id].delete')
const { default: likeHandler } = await import('../server/api/posts/[id]/like.post')
const { default: healthzHandler } = await import('../server/routes/healthz.get')
const { default: hubJsonHandler } = await import('../server/routes/hub.json.get')
const { default: connectHandler } = await import('../server/api/connect.get')
const { default: echoQueryHandler } = await import('../server/api/echo/query.post')
const { default: hubInstancesGetHandler } = await import('../server/api/hub/instances.get')
const { default: hubInstancesPutHandler } = await import('../server/api/hub/instances.put')
const { default: turnstileSettingsGetHandler } = await import('../server/api/turnstile/settings.get')
const { default: turnstileSettingsPutHandler } = await import('../server/api/turnstile/settings.put')
const { default: tagsListHandler } = await import('../server/api/tags/index.get')
const { default: tagsDeleteHandler } = await import('../server/api/tags/[id].delete')
const { default: postsUpdateHandler } = await import('../server/api/posts/[id].put')
const { default: postsDeleteHandler } = await import('../server/api/posts/[id].delete')
const { default: statsHandler } = await import('../server/api/stats.get')
const { default: storageSettingsGetHandler } = await import('../server/api/storage/settings.get')
const { default: storageSettingsPutHandler } = await import('../server/api/storage/settings.put')
const { default: storageTestHandler } = await import('../server/api/storage/test.post')
const { default: siteSettingsGetHandler } = await import('../server/api/site/settings.get')
const { default: siteSettingsPutHandler } = await import('../server/api/site/settings.put')
const { default: searchHandler } = await import('../server/api/posts/search.get')
const { default: extensionPreviewHandler } = await import('../server/api/extension/preview.post')
const { default: tileProxyHandler } = await import('../server/api/tiles/[z]/[x]/[y].get')
const { default: loginHandler } = await import('../server/api/auth/login.post')
const { default: meGetHandler } = await import('../server/api/auth/me.get')
const { default: mePutHandler } = await import('../server/api/auth/me.put')
const { default: postsGetHandler } = await import('../server/api/posts/index.get')
const { default: postsPostHandler } = await import('../server/api/posts/index.post')
const { default: authMiddleware } = await import('../server/middleware/auth')

class FakePrepared {
  private stmt: StatementSync
  private params: (string | number | bigint | Uint8Array | null)[] = []

  constructor(stmt: StatementSync) {
    this.stmt = stmt
  }

  bind(...params: (string | number | bigint | Uint8Array | null)[]): this {
    this.params = params
    return this
  }

  async all() {
    return { results: this.stmt.all(...this.params) }
  }

  async first() {
    return (this.stmt.get(...this.params) as unknown) ?? null
  }

  async run() {
    const info = this.stmt.run(...this.params)
    return {
      success: true,
      meta: {
        changes: info.changes,
        last_row_id: Number(info.lastInsertRowid),
        rows_read: 0,
        rows_written: 0,
      },
    }
  }

  async raw() {
    const rows = this.stmt.all(...this.params)
    return rows.map((r) => Object.values(r))
  }
}

class FakeD1 {
  private db: DatabaseSync
  constructor(db: DatabaseSync) {
    this.db = db
  }
  prepare(sql: string) {
    return new FakePrepared(this.db.prepare(sql))
  }
  async exec(sql: string) {
    this.db.exec(sql)
    return { success: true, meta: {} }
  }
  async batch(stmts: FakePrepared[]) {
    return Promise.all(stmts.map((s) => s.all()))
  }
}

describe('D1 完整流程（node:sqlite 模拟绑定 + 真实 drizzle/h3 代码）', () => {
  const db = new DatabaseSync(':memory:')
  const binding = new FakeD1(db) as unknown as D1Database

  function withCf(handler: (event: any) => unknown) {
    return eventHandler(async (event) => {
      ;(event.context as any)._platform = {
        cloudflare: { env: { DB: binding, DB_TYPE: 'd1', STORAGE_TYPE: 'r2', PUBLIC_API_ENABLED: 'true' } },
      }
      return await handler(event)
    })
  }

  const withAuth = (handler: (event: any) => unknown) =>
    eventHandler(async (event) => {
      ;(event.context as any)._platform = {
        cloudflare: { env: { DB: binding, DB_TYPE: 'd1', STORAGE_TYPE: 'r2', PUBLIC_API_ENABLED: 'true' } },
      }
      await authMiddleware(event)
      return await handler(event)
    })

  const withNoDb = (handler: (event: any) => unknown) =>
    eventHandler(async (event) => {
      ;(event.context as any)._platform = {
        cloudflare: { env: { DB_TYPE: 'd1', STORAGE_TYPE: 'r2', PUBLIC_API_ENABLED: 'true' } },
      }
      return await handler(event)
    })

  const router = createRouter()
  router.get('/api/setup/status', withCf(statusHandler))
  router.get('/api/setup/health', withCf(healthHandler))
  router.get('/api/setup/health/nodb', withNoDb(healthHandler))
  router.post('/api/setup/init', withCf(initHandler))
  router.get('/api/public/site', withCf(publicSiteHandler))
  router.get('/api/public/config', withCf(publicConfigHandler))
  router.get('/api/public/posts/:id', withCf(publicPostGetHandler))
  router.get('/api/public/posts/:id/comments', withCf(commentsListHandler))
  router.post('/api/posts/:id/comments', withCf(commentsCreateHandler))
  router.put('/api/comments/:id', withAuth(commentsStatusHandler))
  router.put('/api/comments/settings', withAuth(commentsSettingsHandler))
  router.delete('/api/comments/:id', withAuth(commentsDeleteHandler))
  router.post('/api/posts/:id/like', withCf(likeHandler))
  router.get('/healthz', withCf(healthzHandler))
  router.get('/hub.json', withCf(hubJsonHandler))
  router.get('/api/connect', withCf(connectHandler))
  router.post('/api/echo/query', withCf(echoQueryHandler))
  router.get('/api/hub/instances', withAuth(hubInstancesGetHandler))
  router.put('/api/hub/instances', withAuth(hubInstancesPutHandler))
  router.get('/api/turnstile/settings', withAuth(turnstileSettingsGetHandler))
  router.put('/api/turnstile/settings', withAuth(turnstileSettingsPutHandler))
  router.get('/api/tags', withCf(tagsListHandler))
  router.delete('/api/tags/:id', withAuth(tagsDeleteHandler))
  router.post('/api/auth/login', withCf(loginHandler))
  router.get('/api/auth/me', withAuth(meGetHandler))
  router.put('/api/auth/me', withAuth(mePutHandler))
  router.get('/api/posts', withCf(postsGetHandler))
  router.post('/api/posts', withAuth(postsPostHandler))
  router.put('/api/posts/:id', withAuth(postsUpdateHandler))
  router.delete('/api/posts/:id', withAuth(postsDeleteHandler))
  // 绕过中间件的直调路由：用于验证 handler 内部鉴权兜底（S1 回归）
  router.put('/api/posts/:id/hack', withCf(postsUpdateHandler))
  router.delete('/api/posts/:id/hack', withCf(postsDeleteHandler))
  router.get('/api/stats', withAuth(statsHandler))
  router.get('/api/storage/settings', withAuth(storageSettingsGetHandler))
  router.put('/api/storage/settings', withAuth(storageSettingsPutHandler))
  router.post('/api/storage/test', withAuth(storageTestHandler))
  router.get('/api/site/settings', withAuth(siteSettingsGetHandler))
  router.put('/api/site/settings', withAuth(siteSettingsPutHandler))
  router.get('/api/posts/search', withCf(searchHandler))
  router.post('/api/extension/preview', withAuth(extensionPreviewHandler))
  router.get('/api/tiles/:z/:x/:y', withCf(tileProxyHandler))

  const server = createApp()
  server.use(router)

  const listener = toNodeListener(server)
  let base = ''

  beforeAll(async () => {
    const http = await import('node:http')
    await new Promise<void>((resolve) => {
      const srv = http.createServer(listener)
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address() as { port: number }
        base = `http://127.0.0.1:${addr.port}`
        resolve()
      })
      afterAll(() => srv.close())
    })
  })

  it('初始状态：未初始化', async () => {
    const res = await fetch(`${base}/api/setup/status`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ initialized: false, userCount: 0 })
  })

  it('数据库健康：已绑定 D1 时连通', async () => {
    const res = await fetch(`${base}/api/setup/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { dbConnected: boolean; dbType: string }
    expect(body.dbConnected).toBe(true)
    expect(body.dbType).toBe('d1')
  })

  it('数据库健康：未绑定 D1 时返回引导原因', async () => {
    const res = await fetch(`${base}/api/setup/health/nodb`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { dbConnected: boolean; reason: string }
    expect(body.dbConnected).toBe(false)
    expect(body.reason).toBe('missing_d1_binding')
  })

  it('初始化：创建管理员并返回 token', async () => {
    const res = await fetch(`${base}/api/setup/init`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass1234', nickname: '站长' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      token: string
      user: { username: string; nickname: string }
      postWriteCount: number
    }
    expect(body.token).toBeTruthy()
    expect(body.user.username).toBe('admin')
    expect(body.user.nickname).toBe('站长')
    expect(body.postWriteCount).toBe(1)
  })

  it('初始化后状态：已初始化（写入持久化）', async () => {
    const res = await fetch(`${base}/api/setup/status`)
    expect(await res.json()).toEqual({ initialized: true, userCount: 1 })
  })

  it('公开站点信息：未登录可读博主身份', async () => {
    const res = await fetch(`${base}/api/public/site`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      username: string
      nickname: string | null
      avatar_url: string | null
      bio: string | null
    }
    expect(body.username).toBe('admin')
    expect(body.nickname).toBe('站长')
  })

  it('重复初始化：409', async () => {
    const res = await fetch(`${base}/api/setup/init`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
    })
    expect(res.status).toBe(409)
  })

  it('登录：正确密码返回 token', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string }
    expect(body.token).toBeTruthy()
  })

  it('登录：错误密码 401', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('JWT 校验：/api/auth/me', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${login.token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { username: string } }
    expect(body.user.username).toBe('admin')
  })

  it('JWT 校验：/api/auth/me 未登录返回 401（中间件保护）', async () => {
    const res = await fetch(`${base}/api/auth/me`)
    expect(res.status).toBe(401)
  })

  it('发帖 + 时间线', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const post = await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '第一条说说', images: [] }),
    })
    expect(post.status).toBe(200)
    const body = (await post.json()) as { post: { id: string } }
    expect(body.post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

    const list = await fetch(`${base}/api/posts`)
    expect(list.status).toBe(200)
    const data = (await list.json()) as { posts: { id: string; content: string }[] }
    expect(data.posts.length).toBe(1)
    expect(data.posts[0].content).toBe('第一条说说')
    expect(data.posts[0].id).toBe(body.post.id)
  })

  it('公开单条详情：按 UUIDv7 获取', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '详情页内容', images: [] }),
      })
    ).json()) as { post: { id: string } }

    const res = await fetch(`${base}/api/public/posts/${created.post.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { post: { id: string; content: string } }
    expect(body.post.id).toBe(created.post.id)
    expect(body.post.content).toBe('详情页内容')

    const bad = await fetch(`${base}/api/public/posts/not-a-uuid`)
    expect(bad.status).toBe(400)
  })

  it('鉴权回归：匿名无法修改/删除 UUID 说说（S1）', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '待保护的说说', images: [] }),
      })
    ).json()) as { post: { id: string } }

    // 1) 完整中间件链路：匿名 PUT/DELETE UUID 路径必须 401（正则需匹配 UUIDv7）
    const put = await fetch(`${base}/api/posts/${created.post.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '被篡改', images: [] }),
    })
    expect(put.status).toBe(401)
    const del = await fetch(`${base}/api/posts/${created.post.id}`, { method: 'DELETE' })
    expect(del.status).toBe(401)

    // 2) 模拟中间件漏配（绕过中间件直调 handler）：handler 内部 guard 必须兜底 401
    const putDirect = await fetch(`${base}/api/posts/${created.post.id}/hack`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '被篡改', images: [] }),
    })
    expect(putDirect.status).toBe(401)
    const delDirect = await fetch(`${base}/api/posts/${created.post.id}/hack`, { method: 'DELETE' })
    expect(delDirect.status).toBe(401)

    // 3) 帖子未被改动、未被删除
    const detail = (await (
      await fetch(`${base}/api/public/posts/${created.post.id}`)
    ).json()) as { post: { content: string } }
    expect(detail.post.content).toBe('待保护的说说')
  })

  it('评论：公开创建 + 公开列表 + 站长删除', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }

    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '评论测试', images: [] }),
      })
    ).json()) as { post: { id: string } }
    const postId = created.post.id

    const comment = await fetch(`${base}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '小明', email: 'x@example.com', website: 'https://x.example', content: '写得不错' }),
    })
    expect(comment.status).toBe(200)
    const commentBody = (await comment.json()) as {
      comment: { id: string; nickname: string; website: string; content: string; status: string; parent_id: string | null; avatar: string }
    }
    expect(commentBody.comment.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(commentBody.comment.nickname).toBe('小明')
    expect(commentBody.comment.website).toBe('https://x.example')
    expect(commentBody.comment.content).toBe('写得不错')
    expect(commentBody.comment.status).toBe('approved')
    expect(commentBody.comment.parent_id).toBeNull()
    const { createHash } = await import('node:crypto')
    expect(commentBody.comment.avatar).toBe(createHash('md5').update('x@example.com').digest('hex'))
    const commentId = commentBody.comment.id

    const listBody = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: { id: string; nickname: string }[] }
    expect(listBody.comments.some((c) => c.id === commentId)).toBe(true)

    const unauth = await fetch(`${base}/api/comments/${commentId}`, { method: 'DELETE' })
    expect(unauth.status).toBe(401)

    const del = await fetch(`${base}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${login.token}` },
    })
    expect(del.status).toBe(200)

    const after = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: unknown[] }
    expect(after.comments.length).toBe(0)
  })

  it('评论：回复盖楼（两级）+ 非法父级校验', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '盖楼测试', images: [] }),
      })
    ).json()) as { post: { id: string } }
    const postId = created.post.id

    const top = (await (
      await fetch(`${base}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: 'A', content: '一楼' }),
      })
    ).json()) as { comment: { id: string } }

    const reply = (await (
      await fetch(`${base}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: 'B', content: '二楼', parent_id: top.comment.id }),
      })
    ).json()) as { comment: { id: string; parent_id: string | null } }
    expect(reply.comment.parent_id).toBe(top.comment.id)

    const badParent = await fetch(`${base}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: 'C', content: '三楼', parent_id: '00000000-0000-7000-8000-000000000000' }),
    })
    expect(badParent.status).toBe(400)

    const list = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: { id: string; parent_id: string | null }[] }
    expect(list.comments.length).toBe(2)
  })

  it('评论审核：需审核开关 + 待审/驳回/通过 + 公开仅见已通过', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const authHeader = { authorization: `Bearer ${login.token}` }

    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '审核测试', images: [] }),
      })
    ).json()) as { post: { id: string } }
    const postId = created.post.id

    const setRes = await fetch(`${base}/api/comments/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ enable_comment: true, require_approval: true }),
    })
    expect(setRes.status).toBe(200)

    const config = (await (
      await fetch(`${base}/api/public/config`)
    ).json()) as { comments_enabled: boolean; require_approval: boolean }
    expect(config.comments_enabled).toBe(true)
    expect(config.require_approval).toBe(true)

    const createdComment = (await (
      await fetch(`${base}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: '游客', content: '请审核' }),
      })
    ).json()) as { comment: { id: string; status: string } }
    expect(createdComment.comment.status).toBe('pending')

    const publicList = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: unknown[] }
    expect(publicList.comments.length).toBe(0)

    const ownerList = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`, { headers: authHeader })
    ).json()) as { comments: { id: string; status: string }[] }
    expect(ownerList.comments.length).toBe(1)
    expect(ownerList.comments[0].status).toBe('pending')

    const approve = await fetch(`${base}/api/comments/${createdComment.comment.id}`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(approve.status).toBe(200)

    const afterApprove = (await (
      await fetch(`${base}/api/public/posts/${postId}/comments`)
    ).json()) as { comments: { id: string; status: string }[] }
    expect(afterApprove.comments.length).toBe(1)
    expect(afterApprove.comments[0].status).toBe('approved')

    const settingsUnauth = await fetch(`${base}/api/comments/settings`, { method: 'PUT' })
    expect(settingsUnauth.status).toBe(401)

    await fetch(`${base}/api/comments/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ enable_comment: true, require_approval: false }),
    })
  })

  it('点赞：切换 + 计数 + 列表携带状态', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '点赞测试', images: [] }),
      })
    ).json()) as { post: { id: string } }
    const postId = created.post.id

    const like = (await (
      await fetch(`${base}/api/posts/${postId}/like`, { method: 'POST' })
    ).json()) as { liked: boolean; count: number }
    expect(like.liked).toBe(true)
    expect(like.count).toBe(1)

    const detail = (await (
      await fetch(`${base}/api/public/posts/${postId}`)
    ).json()) as { post: { like_count: number; liked: boolean } }
    expect(detail.post.like_count).toBe(1)
    expect(detail.post.liked).toBe(true)

    const unlike = (await (
      await fetch(`${base}/api/posts/${postId}/like`, { method: 'POST' })
    ).json()) as { liked: boolean; count: number }
    expect(unlike.liked).toBe(false)
    expect(unlike.count).toBe(0)

    const list = (await (
      await fetch(`${base}/api/posts`)
    ).json()) as { posts: { id: string; like_count: number; liked: boolean }[] }
    const found = list.posts.find((p) => p.id === postId)
    expect(found?.like_count).toBe(0)
    expect(found?.liked).toBe(false)
  })

  it('Hub 协议：/healthz + /api/connect + /api/echo/query + /hub.json', async () => {
    const login = (await (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pass1234' }),
      })
    ).json()) as { token: string }
    const authHeader = { authorization: `Bearer ${login.token}` }

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
    expect(connect.data.total_echos).toBeGreaterThan(0)

    await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hub 可查询的说说', images: [] }),
    })

    const query = (await (
      await fetch(`${base}/api/echo/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 5, search: 'hub 可查询', sortBy: 'created_at', sortOrder: 'desc' }),
      })
    ).json()) as { code: number; data: { total: number; items: { id: string; content: string; created_at: number; username: string; layout: string }[] } }
    expect(query.code).toBe(1)
    expect(query.data.total).toBe(1)
    expect(query.data.items[0].content).toBe('hub 可查询的说说')
    expect(query.data.items[0].created_at).toBeGreaterThan(1700000000)
    expect(query.data.items[0].username).toBe('admin')

    const hubJson = (await (await fetch(`${base}/hub.json`)).json()) as { instances: unknown[] }
    expect(hubJson.instances).toEqual([])

    const putUnauth = await fetch(`${base}/api/hub/instances`, { method: 'PUT' })
    expect(putUnauth.status).toBe(401)

    await fetch(`${base}/api/hub/instances`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ instances: [{ id: 'example', url: 'https://memo.vaaat.com/' }] }),
    })
    const hubJson2 = (await (await fetch(`${base}/hub.json`)).json()) as {
      instances: { id: string; url: string }[]
    }
    expect(hubJson2.instances).toEqual([{ id: 'example', url: 'https://memo.vaaat.com' }])
  })

  it('Turnstile 配置：后台保存后公开配置下发 site key', async () => {
    // 绕过登录限流：直接读库中已持久化的 JWT 密钥签名一个管理员 token
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const putUnauth = await fetch(`${base}/api/turnstile/settings`, { method: 'PUT' })
    expect(putUnauth.status).toBe(401)

    const putRes = await fetch(`${base}/api/turnstile/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ site_key: '0x-test-site-key', secret_key: '0x-test-secret-key' }),
    })
    expect(putRes.status).toBe(200)

    const getRes = (await (
      await fetch(`${base}/api/turnstile/settings`, { headers: authHeader })
    ).json()) as { site_key: string; secret_set: boolean; secret_key?: string }
    expect(getRes.site_key).toBe('0x-test-site-key')
    expect(getRes.secret_set).toBe(true)
    // 密钥不回显
    expect(getRes.secret_key).toBeUndefined()

    // 留空保存 → 保留原密钥
    await fetch(`${base}/api/turnstile/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ site_key: '0x-test-site-key' }),
    })
    const kept = (await (
      await fetch(`${base}/api/turnstile/settings`, { headers: authHeader })
    ).json()) as { secret_set: boolean }
    expect(kept.secret_set).toBe(true)

    // clear_secret → 清除
    await fetch(`${base}/api/turnstile/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ site_key: '0x-test-site-key', clear_secret: true }),
    })
    const cleared = (await (
      await fetch(`${base}/api/turnstile/settings`, { headers: authHeader })
    ).json()) as { secret_set: boolean }
    expect(cleared.secret_set).toBe(false)

    const config = (await (
      await fetch(`${base}/api/public/config`)
    ).json()) as { turnstile_site_key: string }
    expect(config.turnstile_site_key).toBe('0x-test-site-key')

    await fetch(`${base}/api/turnstile/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ site_key: '', secret_key: '', clear_secret: true }),
    })
  })

  it('标签：发帖新建标签 + 已建标签复用 + 编辑更新 + hub query 携带', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '带标签的说说', images: [], tag_names: ['生活', '想法'] }),
      })
    ).json()) as { post: { id: string; tags: { id: string; name: string }[] } }
    expect(created.post.tags.map((t: { name: string }) => t.name).sort((a: string, b: string) => a.localeCompare(b, "zh"))).toEqual(['生活', '想法'])

    const tagsList = (await (
      await fetch(`${base}/api/tags`)
    ).json()) as { tags: { name: string }[] }
    expect(tagsList.tags.some((t) => t.name === '生活')).toBe(true)
    expect(tagsList.tags.some((t) => t.name === '想法')).toBe(true)

    const updated = (await (
      await fetch(`${base}/api/posts/${created.post.id}`, {
        method: 'PUT',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '带标签的说说', images: [], tag_names: ['生活', '新标签'] }),
      })
    ).json()) as { post: { tags: { name: string }[] } }
    expect(updated.post.tags.map((t: { name: string }) => t.name).sort((a: string, b: string) => a.localeCompare(b, "zh"))).toEqual(['生活', '新标签'])

    const query = (await (
      await fetch(`${base}/api/echo/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 50, sortOrder: 'desc' }),
      })
    ).json()) as { data: { items: { id: string; tags: { id: string; name: string }[] }[] } }
    const item = query.data.items.find((i) => i.id === created.post.id)
    expect(item?.tags.map((t: { name: string }) => t.name).sort((a: string, b: string) => a.localeCompare(b, "zh"))).toEqual(['生活', '新标签'])

    const detail = (await (
      await fetch(`${base}/api/public/posts/${created.post.id}`)
    ).json()) as { post: { tags: { id: string; name: string }[] } }
    expect(detail.post.tags.map((t: { name: string }) => t.name)).toEqual(['生活', '新标签'])

    const newTag = detail.post.tags.find((t) => t.name === '新标签')
    const delRes = await fetch(`${base}/api/tags/${newTag!.id}`, {
      method: 'DELETE',
      headers: authHeader,
    })
    expect(delRes.status).toBe(200)

    const tagsAfter = (await (
      await fetch(`${base}/api/tags`)
    ).json()) as { tags: { name: string }[] }
    expect(tagsAfter.tags.some((t) => t.name === '新标签')).toBe(false)
    expect(tagsAfter.tags.some((t) => t.name === '生活')).toBe(true)

    const detailAfter = (await (
      await fetch(`${base}/api/public/posts/${created.post.id}`)
    ).json()) as { post: { tags: { name: string }[] } }
    expect(detailAfter.post.tags.map((t: { name: string }) => t.name)).toEqual(['生活'])
  })

  it('控制台统计：/api/stats（站长）', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))

    const unauth = await fetch(`${base}/api/stats`)
    expect(unauth.status).toBe(401)

    const res = await fetch(`${base}/api/stats`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      posts: number
      today_posts: number
      comments: number
      likes: number
      tags: number
      users: number
    }
    expect(data.users).toBe(1)
    expect(data.posts).toBeGreaterThan(0)
    expect(typeof data.comments).toBe('number')
    expect(typeof data.likes).toBe('number')
    expect(typeof data.tags).toBe('number')
    expect(typeof data.today_posts).toBe('number')
  })

  it('存储配置：后台存取 + S3 连接测试', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const putUnauth = await fetch(`${base}/api/storage/settings`, { method: 'PUT' })
    expect(putUnauth.status).toBe(401)

    const cfg = {
      type: 's3',
      s3_endpoint: 'https://s3.amazonaws.com',
      s3_region: 'us-east-1',
      s3_bucket: 'test-bucket',
      s3_access_key_id: 'AKIA_TEST',
      s3_secret_access_key: 'secret-test',
    }
    const putRes = await fetch(`${base}/api/storage/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    expect(putRes.status).toBe(200)

    const got = (await (
      await fetch(`${base}/api/storage/settings`, { headers: authHeader })
    ).json()) as typeof cfg & { s3_secret_access_key_set: boolean; s3_secret_access_key?: string }
    expect(got.type).toBe(cfg.type)
    expect(got.s3_endpoint).toBe(cfg.s3_endpoint)
    expect(got.s3_region).toBe(cfg.s3_region)
    expect(got.s3_bucket).toBe(cfg.s3_bucket)
    expect(got.s3_access_key_id).toBe(cfg.s3_access_key_id)
    // 密钥不回显
    expect(got.s3_secret_access_key).toBeUndefined()
    expect(got.s3_secret_access_key_set).toBe(true)

    const testRes = await fetch(`${base}/api/storage/test`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ...cfg, s3_bucket: 'no-such-bucket-xyz' }),
    })
    expect(testRes.status).toBe(200)
    const result = (await testRes.json()) as { ok: boolean; message: string }
    expect(typeof result.ok).toBe('boolean')
    expect(typeof result.message).toBe('string')

    await fetch(`${base}/api/storage/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'r2', s3_endpoint: '', s3_region: 'us-east-1', s3_bucket: '', s3_access_key_id: '', s3_secret_access_key: '' }),
    })
  })

  it('实例配置：instance_name 覆盖 connect + 个人资料邮箱', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const meRes = await fetch(`${base}/api/auth/me`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com' }),
    })
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as { user: { email: string | null } }
    expect(meBody.user.email).toBe('owner@example.com')

    const putRes = await fetch(`${base}/api/site/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ instance_name: '测试实例' }),
    })
    expect(putRes.status).toBe(200)

    const got = (await (
      await fetch(`${base}/api/site/settings`, { headers: authHeader })
    ).json()) as { instance_name: string }
    expect(got.instance_name).toBe('测试实例')

    const connect = (await (await fetch(`${base}/api/connect`)).json()) as {
      data: { server_name: string }
    }
    expect(connect.data.server_name).toBe('测试实例')

    // 清理：清空实例名称与邮箱，避免影响其它用例
    await fetch(`${base}/api/site/settings`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ instance_name: '' }),
    })
    await fetch(`${base}/api/auth/me`, {
      method: 'PUT',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    })
  })

  it('搜索：仅时间筛选可搜索，空条件返回 400', async () => {
    const noQuery = await fetch(`${base}/api/posts/search`)
    expect(noQuery.status).toBe(400)

    const byTime = await fetch(`${base}/api/posts/search?since=${Date.now() - 86400000}`)
    expect(byTime.status).toBe(200)
    const body = (await byTime.json()) as { posts: { content: string }[] }
    expect(body.posts.length).toBeGreaterThan(0)
  })

  it('搜索：按标签过滤（含关键词 + 标签组合）', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '带标签的搜索测试', images: [], tag_names: ['搜索标签'] }),
    })
    await fetch(`${base}/api/posts`, {
      method: 'POST',
      headers: { ...authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '无标签的搜索测试', images: [], tag_names: [] }),
    })

    const byTag = (await (
      await fetch(`${base}/api/posts/search?tag=搜索标签`)
    ).json()) as { tagNames: string[]; posts: { content: string }[] }
    expect(byTag.tagNames).toEqual(['搜索标签'])
    expect(byTag.posts.length).toBe(1)
    expect(byTag.posts[0].content).toBe('带标签的搜索测试')

    const combo = (await (
      await fetch(`${base}/api/posts/search?q=搜索测试&tag=搜索标签`)
    ).json()) as { posts: { content: string }[] }
    expect(combo.posts.length).toBe(1)

    const none = (await (
      await fetch(`${base}/api/posts/search?tag=不存在的标签`)
    ).json()) as { posts: unknown[] }
    expect(none.posts.length).toBe(0)
  })

  it('私密说说：仅站长可见（时间线/搜索/详情/hub 过滤）', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '私密说说测试', images: [], tag_names: [], private: true }),
      })
    ).json()) as { post: { id: string; private: boolean } }
    expect(created.post.private).toBe(true)
    const postId = created.post.id

    const anonTimeline = (await (
      await fetch(`${base}/api/posts?limit=50`)
    ).json()) as { posts: { id: string }[] }
    expect(anonTimeline.posts.some((p) => p.id === postId)).toBe(false)

    const ownerTimeline = (await (
      await fetch(`${base}/api/posts?limit=50`, { headers: authHeader })
    ).json()) as { posts: { id: string; private: boolean }[] }
    expect(ownerTimeline.posts.some((p) => p.id === postId && p.private)).toBe(true)

    const anonDetail = await fetch(`${base}/api/public/posts/${postId}`)
    expect(anonDetail.status).toBe(404)

    const ownerDetail = await fetch(`${base}/api/public/posts/${postId}`, { headers: authHeader })
    expect(ownerDetail.status).toBe(200)

    const anonSearch = (await (
      await fetch(`${base}/api/posts/search?q=私密说说测试`)
    ).json()) as { posts: { id: string }[] }
    expect(anonSearch.posts.some((p) => p.id === postId)).toBe(false)

    const hubQuery = (await (
      await fetch(`${base}/api/echo/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 100, sortOrder: 'desc' }),
      })
    ).json()) as { data: { items: { id: string }[] } }
    expect(hubQuery.data.items.some((p) => p.id === postId)).toBe(false)
  })

  it('扩展内容：WEBSITE 发布时补全元数据 + 返回给查询', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const created = (await (
      await fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({
          content: '带网站卡片的说说',
          images: [],
          tag_names: [],
          extension: { type: 'WEBSITE', payload: { url: 'https://example.com/some/page' } },
        }),
      })
    ).json()) as {
      post: {
        id: string
        extension: { type: string; payload: { url: string; title: string; site: string } }
      }
    }
    expect(created.post.extension.type).toBe('WEBSITE')
    // 抓取失败时回退为域名作为标题，site 保持完整 URL
    expect(created.post.extension.payload.site).toBe('https://example.com/some/page')
    expect(typeof created.post.extension.payload.title).toBe('string')
    expect(created.post.extension.payload.title.length).toBeGreaterThan(0)

    const detail = (await (
      await fetch(`${base}/api/public/posts/${created.post.id}`)
    ).json()) as { post: { extension: { type: string } | null } }
    expect(detail.post.extension?.type).toBe('WEBSITE')

    // hub query 返回真实 extension（hub 端会过滤带扩展的帖子，与 ech0 一致）
    const query = (await (
      await fetch(`${base}/api/echo/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 100, sortOrder: 'desc' }),
      })
    ).json()) as { data: { items: { id: string; extension: { type: string } | null }[] } }
    const item = query.data.items.find((i) => i.id === created.post.id)
    expect(item?.extension?.type).toBe('WEBSITE')

    const updated = (await (
      await fetch(`${base}/api/posts/${created.post.id}`, {
        method: 'PUT',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '带网站卡片的说说', images: [], tag_names: [], extension: null }),
      })
    ).json()) as { post: { extension: null } }
    expect(updated.post.extension).toBeNull()
  }, 15000)

  it('音乐链接解析：识别平台与歌曲 ID（纯函数）', async () => {
    const { parseMusicUrl } = await import('../server/utils/extension')
    expect(parseMusicUrl('https://music.163.com/#/song?id=2079782728')).toEqual({
      server: 'netease',
      id: '2079782728',
    })
    expect(parseMusicUrl('https://music.163.com/song?id=2079782728')).toEqual({
      server: 'netease',
      id: '2079782728',
    })
    expect(parseMusicUrl('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV')).toEqual({
      server: 'tencent',
      id: '0039MnYb0qxYhV',
    })
    expect(parseMusicUrl('https://www.kugou.com/song/#hash=abc123')).toEqual({
      server: 'kugou',
      id: 'abc123',
    })
    expect(parseMusicUrl('https://www.kuwo.cn/play_detail/12345678')).toEqual({
      server: 'kuwo',
      id: '12345678',
    })
    expect(parseMusicUrl('https://example.com/random')).toBeNull()
  })

  it('扩展内容：视频/推文/音乐链接解析', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))
    const authHeader = { authorization: `Bearer ${token}` }

    const create = (ext: unknown) =>
      fetch(`${base}/api/posts`, {
        method: 'POST',
        headers: { ...authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '扩展解析测试', images: [], tag_names: [], extension: ext }),
      }).then((r) => r.json() as Promise<{ post: { extension: { type: string; payload: Record<string, string | number> } | null } }>)

    const bili = await create({ type: 'VIDEO', payload: { url: 'https://www.bilibili.com/video/BV1xx411c7mD' } })
    expect(bili.post.extension?.type).toBe('VIDEO')
    expect(bili.post.extension?.payload.videoId).toBe('BV1xx411c7mD')
    expect(bili.post.extension?.payload.type).toBe('bilibili')

    const yt = await create({ type: 'VIDEO', payload: { url: 'https://youtu.be/dQw4w9WgXcQ' } })
    expect(yt.post.extension?.payload.type).toBe('youtube')
    expect(yt.post.extension?.payload.videoId).toBe('dQw4w9WgXcQ')

    const tweet = await create({ type: 'TWEET', payload: { url: 'https://x.com/elonmusk/status/123456789' } })
    expect(tweet.post.extension?.payload.username).toBe('elonmusk')
    expect(tweet.post.extension?.payload.statusId).toBe('123456789')

    const music = await create({ type: 'MUSIC', payload: { server: 'netease', type: 'song', id: '347230' } })
    expect(music.post.extension?.payload.id).toBe('347230')
    // Meting API 为外部服务，离线时回退为无 name；在线时应为 string
    if (music.post.extension?.payload.name !== undefined) {
      expect(typeof music.post.extension?.payload.name).toBe('string')
    }
  }, 15000)

  it('扩展预览接口：返回补全后的完整元数据（需认证）', async () => {
    const secretRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'jwt.secret'`).get() as
      | { value: string }
      | undefined
    expect(secretRow?.value).toBeTruthy()
    const { SignJWT } = await import('jose')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secretRow!.value))

    const unauth = await fetch(`${base}/api/extension/preview`, { method: 'POST' })
    expect(unauth.status).toBe(401)

    const res = await fetch(`${base}/api/extension/preview`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'TWEET', payload: { url: 'https://x.com/a/status/42' } }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { extension: { payload: { username: string; statusId: string } } }
    expect(body.extension.payload.username).toBe('a')
    expect(body.extension.payload.statusId).toBe('42')
  })

  it('OSM 瓦片代理：非法坐标 400，合法坐标 200/502', async () => {
    const bad = await fetch(`${base}/api/tiles/20/0/0`)
    expect(bad.status).toBe(400)

    const bad2 = await fetch(`${base}/api/tiles/5/40/0`)
    expect(bad2.status).toBe(400)

    const ok = await fetch(`${base}/api/tiles/3/4/2`)
    // 测试环境可能无法访问 OSM，接受 200 或 502，但不接受 400
    expect([200, 502]).toContain(ok.status)
  }, 20000)

  it('JWT 密钥已持久化到 app_settings', async () => {
    const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key = 'jwt.secret'`).all()
    expect(rows.length).toBe(1)
    expect((rows[0] as { value: string }).value.length).toBeGreaterThan(32)
  })
})
