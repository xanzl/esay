# esay 代码审查报告

**项目**：单用户"说说"系统（Nuxt3 SPA + Nitro/cloudflare_module + Drizzle D1/PG + ech0 Hub 联邦）
**结论**：结构清晰、注释好、测试 32/32 通过，安全基线不弱（参数化 SQL、DOMPurify、bcrypt、IP 哈希）。但存在 **1 个严重鉴权漏洞** 和若干存储型 XSS 风险，建议按序修复。

---

## 🔴 严重

### S1. 匿名可修改/删除任意说说 —— auth 正则与真实 ID 格式不匹配
- **位置**：`server/middleware/auth.ts:19-20`；`server/api/posts/[id].put.ts`；`server/api/posts/[id].delete.ts`
- **问题**：中间件用 `/^\/api\/posts\/\d+$/` 保护 PUT/DELETE，但帖子 ID 是 **UUIDv7**（`server/utils/uuidv7.ts` 只认 v7），该正则永不匹配 → 中间件直接 `return`、不设置 `event.context.user`；而 PUT/DELETE handler 内部**均无自校验**（delete.ts 注释还写着"仅站长可操作"）。帖子 ID 经 `GET /api/posts` 公开返回，任意访客可直接 `DELETE /api/posts/:uuid` 删帖、`PUT` 改帖/翻转 `private`/替换 content 与图片。
- **连带**：PUT 里会跑 `normalizeExtension(...)`（`server/api/posts/[id].put.ts`）→ 未授权即触发抓取任意 URL（见 M1）。
- **建议**：正则改 `/^\/api\/posts\/[0-9a-f-]{36}$/`（与 comments 一致）；同时在两个 handler 内加 `if (!event.context.user) throw createError({ statusCode: 401, statusMessage: '未登录或登录已过期' })` 兜底。

---

## 🟠 高

### H1. 评论 website 字段 → 存储型 XSS
- **位置**：`server/api/posts/[id]/comments.post.ts:55`；`app/components/CommentSection.vue:443`
- **问题**：服务端对 `website` 仅 trim + 截断，无协议白名单；前端渲染 `<a :href="item.website" target="_blank">`。UI 提交路径会在 `CommentSection.vue:103` 补 `https://`，但**直连 API POST** 可写入 `javascript:alert(...)`。评论是公开可发的，站长点击自己评论区里的用户名 → 同源 JS 执行 → 可直接读 `localStorage` 里的 token（见 M2）→ 完全接管。
- **建议**：服务端强制校验——为空或 `/^https?:\/\//i` 才放行（用 `new URL()` 解析，拒绝其它 scheme）；渲染端再兜一层白名单。

### H2. 上传 Content-Type 客户端可控 + 允许 SVG → 存储型 XSS
- **位置**：`server/api/upload.post.ts`（用客户端 `file.type` 做 `image/` 白名单判断并作为存储 Content-Type）；`server/api/files/[...key].get.ts:19-22`
- **问题**：扩展名白名单 `[a-z0-9]` 放行 `svg`；直接访问 `https://站点/api/files/posts/xxx.svg` 时按 `image/svg+xml` 渲染，SVG 内 `<script>` 同源执行。响应头缺 `X-Content-Type-Options: nosniff`。
- **建议**：服务端魔数嗅探（而非信 client MIME）+ 禁止 SVG（或做 SVG 消毒）；响应加 `X-Content-Type-Options: nosniff`。

### H3. 硬编码 JWT_SECRET（设计级风险）
- **位置**：根目录**未跟踪**的 `wrangler.toml:22-28` 在 `vars` 里内置了 `JWT_SECRET = caaebcbe...`；已暂存的 `platforms/wrangler.toml` 仅注释声明 `敏感值用 wrangler secret put 设置`（本身干净）
- **问题**：硬编码密钥当前在未跟踪文件里、未提交，泄漏面比预想小；但注释明确这是"随 Worker 部署、所有实例一致"的**刻意设计**。一旦该文件被 `git add`（或复制共享），任何拿到仓库的人都可伪造管理员 token；且 vars 内置密钥无法轮换。
- **建议**：删除 `vars` 中的 JWT_SECRET，改用 `wrangler secret put JWT_SECRET`；已部署实例轮换密钥；把根目录 `wrangler.toml` 加入 `.gitignore`。

---

## 🟡 中

### M1. 未授权 SSRF（经 S1）＋ `redirect:'follow'`
- **位置**：`server/utils/extension.ts` `fetchWebsiteMeta`（`fetch(site, { redirect: 'follow' })`，6s 超时，无 host 校验）
- **问题**：S1 修复前，任意访客可经 `PUT /api/posts/:uuid` + `WEBSITE` 扩展让服务器回源任意 URL（可跟随重定向）。在 PG+S3 部署（Vercel/Netlify，见 README）下可探测云元数据 `169.254.169.254` 与内网服务；Worker 上受限但仍有任意 GET。
- **建议**：先修 S1；`fetch` 前校验协议仅 http/https、解析 DNS 拒绝私网/环回/链路本地地址，或禁止跟随重定向。

### M2. JWT 存 localStorage
- **位置**：`app/stores/auth.ts:3,57`（`moment-token`）
- **问题**：任何 XSS（H1/H2）＝ token 直接可读＝ 完全接管。单用户自部署可接受，但与上面两处 XSS 叠加后放大。
- **建议**：改 httpOnly + SameSite=Lax cookie 承载 token；至少缩短有效期 + 刷新机制。

### M3. 登录限流可绕过
- **位置**：`server/utils/ratelimit.ts`；`server/api/auth/login.post.ts:18`、`setup/init.post.ts:18`；`server/utils/turnstile.ts:19`
- **问题**：限流是**进程内 Map**（CF 多 isolate 各自独立、可重置），且 key 优先取 `cf-connecting-ip` 头——该头在非 CF 部署下可伪造；`checkRateLimit` 满桶时也不逐出、Map 会无限增长。Turnstile 登录默认关闭（`loginEnabled: false`），默认仅靠"内存限流"挡爆破。
- **建议**：IP 用 `getRequestIP`（可信链）而非原始头；限流落地到 D1/KV；Turnstile 建议默认开启或至少加失败次数硬上限。

### M4. JWT secret 多实例"脑裂" + 缓存永不失效
- **位置**：`server/utils/jwt-secret.ts`（模块级 `cachedSecret`，`setSetting` 竞态）
- **问题**：无显式 env 密钥时，多个冷启动 isolate 并发各自随机生成 secret 并写入 DB，后写覆盖先写、各 isolate 各自缓存 → 同账号在不同 isolate 签发的 token 互不认，登录态间歇失效。当前被 vars 内置密钥掩盖，一旦按 H3 建议移除内置密钥就会触发。
- **建议**：要求必须显式配置 `JWT_SECRET`（缺省拒绝启动），或 DB 初始化用原子 upsert + 写后重读。

---

## 🟢 低

- **L1** `server/utils/echo-query.ts:87`：`filePath.split('/')[2]` 对 `/api/files/posts/x.jpg` 取到 `"files"`，图片名恒错、`guessContentType` 恒 jpeg。应取最后一段。
- **L2** `server/api/connect.get.ts:18`、`stats.get.ts`：`now - now % 86400000` 按 **UTC 零点** 算"今日"，东八区 0–8 点统计差一天。应按站点时区。
- **L3** `upload.post.ts`：`readMultipartFormData` 整包读入内存，无 part 数量/总大小上限 → 内存 DoS 面。
- **L4** `server/api/auth/me.put.ts`：email 只长度校验、无格式校验。
- **L5** `server/utils/uuidv7.ts`：只认 UUIDv7 版本位——过度严格，历史/外部（ech0 互通）数据兼容性风险。
- **L6** `ratelimit.ts`：桶满不清理、无上限保护。
- **L7** `setup/status.get.ts` 每请求 `console.log`；`tiles` 代理无请求频控（可接受但值得注意）。

---

## ♻️ 重构建议

1. **鉴权模式**（对应 S1 根因）：正则白名单与路由文件解耦、极易漏配。建议改为 per-handler `requireOwner()`/`optionalUser()` helper（已有 `optional-auth.ts` 雏形），或 nitro routeRules 显式声明。
2. **双 repo 重复**：`repo.d1.ts` / `repo.pg.ts` 大量重复 SQL，PG 路径无测试。建议用 drizzle 统一查询构建 + 补 PG 单测。
3. **工具位置**：`parseCursor`/`serializeCursor` 定义在 `api/posts/index.get.ts` 却被 `public/posts/index.get.ts` 引用 → 移入 `server/utils/`。
4. **optional-auth 去重**：`api/posts/[id]/comments.get.ts:19-29` 手写 token 校验，与 `optional-auth.ts` 重复。
5. **extension 建模**：`ensurePayload`/`fillDefaults` 较绕，可用 zod 定义 `PostExtension` 联合类型收敛。

## ✅ 做得好的
- SQL 注入防护：全程 drizzle 参数化 + `escapeLike`（`repo.d1.ts:208,213,218`）
- 严格 UUID 校验、输入长度/数量约束（5000 字、9 图）
- Markdown 渲染走 DOMPurify；密码 bcrypt 10 轮；JWT 30 天
- IP 哈希化存储、评论限流 + Turnstile、CORS 仅放开 public/echo/connect/healthz
- 32 个测试覆盖 D1 主链路并全绿

**修复优先级**：S1（改一个正则 + 两个 handler 加 guard，十分钟的事）→ H1 → H2 → M3 → 其余。
