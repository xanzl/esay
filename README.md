# esay · 单用户极简说说系统

> **esay** = echo say——想说什么就说什么，轻松一点。
> 开源协议：**MIT**（见 [LICENSE](LICENSE)）｜Hub 协议兼容 [ech0](https://github.com/lin-snow/ech0)（AGPL-3.0）

为个人设计的极简说说系统：记录日常动态、想法或短内容，支持 Markdown 与图片，并可通过公开 API 外嵌到个人博客等任意站点。

- 全栈：Nuxt 3（Nitro 服务端）+ TypeScript
- 样式：TailwindCSS 4（卡片式流式响应式布局）+ @iconify/tailwind4（类名图标）
- 数据库：Drizzle ORM（统一适配 Cloudflare D1 / PostgreSQL）
- 认证：JWT（jose，WebCrypto 签名）+ bcrypt（bcryptjs，纯 JS，Workers 原生兼容）
- 存储：Cloudflare R2 / 任意 S3 兼容服务
- 部署：Cloudflare Workers（主推）、Vercel、Netlify

## 一键部署

> 先把代码推送到 GitHub，再把下面链接中的 `<REPO_URL>` 替换成你的仓库地址（如 `https://github.com/yourname/esay`）即可。

**Cloudflare Workers（主推）** — 自动创建 D1 数据库与 R2 存储桶，首次打开站点按引导初始化管理员：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=<REPO_URL>)

**Vercel** — 需配置 PostgreSQL（`DB_TYPE=postgresql`）+ S3（`STORAGE_TYPE=s3`），见下方环境变量表：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=<REPO_URL>)

**Netlify** — 同上，需 PostgreSQL + S3：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=<REPO_URL>)

> Cloudflare 一键部署要求仓库根目录保留 `wrangler.toml` 且能正常执行 `pnpm build`（Nitro cloudflare_module preset）；Vercel / Netlify 会读取 `vercel.json` / `netlify.toml` 自动切换对应 preset。

## 快速开始（Cloudflare Workers，推荐）

零配置部署：D1 数据库与 R2 存储桶由 wrangler 首次部署时自动创建并绑定，表结构在首次请求时自动创建，管理员账号通过站点初始化页面设置（无需手动建库、跑迁移或配置密钥）。

```bash
# 1. 登录并部署（自动创建 D1 / R2）
wrangler login
pnpm build
pnpm deploy

# 2. 打开站点，在"初始化 esay"页面设置管理员用户名与密码，
#    随后自动登录即可开始使用
```

> 按项目验收要求，不使用 `wrangler dev` 本地调试，所有验证均在真实 Workers 环境（`wrangler deploy`）中进行。

### 可选配置

- `JWT_SECRET`（推荐配置）：JWT 签名密钥。**不配置也能用**——首次请求自动生成并持久化到数据库（跨部署/重启不失效）；但多实例部署（Vercel/Netlify 的函数实例）存在并发生成、登录态偶发失效的窗口，建议显式配置固定值。三种配置方式任选：
  - Cloudflare dashboard：Workers → 你的 Worker → 设置 → 变量与机密 → 添加（普通变量或机密均可，名称 `JWT_SECRET`）
  - `wrangler secret put JWT_SECRET`（dashboard 等效的 CLI 方式）
  - Vercel / Netlify：平台的环境变量设置里添加 `JWT_SECRET`
  - 生成方式见下方「生成 JWT 密钥」
- `wrangler secret put GITHUB_TOKEN`（可选）：GitHub 项目卡片解析携带该 Token，API 配额从 60 次/小时提升至 5000 次/小时；解析结果缓存 24 小时（D1/PG `extension_cache` 表），同一仓库不重复请求
- 自动创建并绑定固定名称的资源：`moment-db`（D1）与 `moment-images`（R2）。**按名复用**：重复 `wrangler deploy` 不会重建资源，数据持久保留；可在仪表盘或 `wrangler d1 list` / `wrangler r2 bucket list` 中查看
- 若出现"重新部署后站点又回到初始化页"：先运行 `wrangler d1 list` 确认是否存在多个 `moment-db`（多为历史手动创建），并检查根目录 `wrangler.toml` 是否被 wrangler 写入了 `database_id`（有则数据已绑定到该库）
- 所有 `/api/*` 响应均带 `Cache-Control: no-store`，不会被浏览器或边缘缓存（若站点启用了 Cache Everything 类规则，也请排除 `/api/*`）

### 生成 JWT 密钥

```bash
# 推荐（64 位十六进制 = 256 bit）
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用 Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> 密钥至少 32 个字符（128 bit）以上，否则会被忽略并回退自动生成（日志会有警告）。更换密钥后所有已登录用户需重新登录。

## Vercel / Netlify 部署

仓库配置已包含根目录 `vercel.json` 与 `netlify.toml`（构建时通过 `NITRO_PRESET` 自动切换到对应 Nitro preset），平台侧按常规 Git 部署即可：

- **Vercel**：Git 导入时识别 `vercel.json`（`NITRO_PRESET=vercel` 构建），输出 Build Output API 目录 `.vercel/output`；`server/api` 与 `server/routes`（`/healthz`、`/hub.json`）全部自动转换为函数
- **Netlify**：`netlify.toml` 指定构建命令与 `publish = "dist"`；Nitro 将全部路由打包进 `.netlify/functions-internal/server` 单一函数（Netlify 自动作为全站 fallback 处理，无需手动 redirects）

平台侧需配置的环境变量：

| 变量 | 说明 |
| --- | --- |
| `DB_TYPE=postgresql` | 使用 PostgreSQL（Neon / Supabase 等） |
| `DATABASE_URL` | PG 连接串，表结构在首次请求时自动创建（无需迁移） |
| `STORAGE_TYPE=s3` | 使用 S3 兼容存储 |
| `S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY` | S3 配置 |
| `JWT_SECRET` | JWT 签名密钥（可选，未配置时自动生成并持久化到数据库；生成方式见上文「生成 JWT 密钥」） |
| `GITHUB_TOKEN` | GitHub API Token（可选，解析 GitHub 项目卡片时使用，避免 60 次/小时限流） |
| `PUBLIC_API_ENABLED` / `APP_URL` | 公开 API 开关 / 站点域名（`APP_URL` 用于图片与 Hub 输出的绝对地址） |

> 本地验证对应平台构建：`NITRO_PRESET=vercel pnpm build` / `NITRO_PRESET=netlify pnpm build`（产物在 `.vercel/output` / `dist` + `.netlify/`）。注意：Vercel 与 Netlify 需要 PostgreSQL + S3，不持有 Cloudflare D1/R2 绑定。

## 环境变量

见 `.env.example`（复制为 `.env` 或配置到平台）。

## 公开 API（无需认证，支持 CORS）

| 接口 | 说明 |
| --- | --- |
| `GET /api/public/posts?cursor=&limit=` | 说说列表（游标分页，返回 `nextCursor` / `hasMore` / `site`） |
| `GET /api/public/posts/:id` | 单条说说详情 |

```bash
curl https://你的域名/api/public/posts
curl https://你的域名/api/public/posts/1
```

- 图片返回绝对地址（基于 `APP_URL`，未配置则回退为请求域名）
- 通过 `PUBLIC_API_ENABLED=false` 可整体关闭

## 内部 API（JWT 认证）

- `POST /api/auth/login` 登录；`GET /api/auth/me` 当前用户；`PUT /api/auth/me` 更新资料/密码
- `GET /api/setup/status` 是否已初始化；`POST /api/setup/init` 首次运行创建管理员（仅用户表为空可调用）
- `GET /api/posts` 时间线（游标分页）；`POST /api/posts` 发布
- `PUT /api/posts/:id` 编辑；`DELETE /api/posts/:id` 删除
- `GET /api/posts/search?q=` 搜索
- `POST /api/upload` 上传图片（multipart，字段名 `file`，≤8MB）
- `GET /api/files/**` 图片代理（读取 R2/S3，长缓存，无需存储桶公开域名）

## 常用命令

```bash
pnpm dev                # 本地开发（无 CF 绑定时数据接口不可用，可配 DB_TYPE=postgresql 联调）
pnpm build              # 构建（默认 cloudflare_module preset）
pnpm typecheck          # TS 类型检查
pnpm test               # D1 全流程集成测试（node:sqlite 模拟绑定，本地可跑）
pnpm db:generate:pg     # 生成 PG 迁移（drizzle-kit，可选）
pnpm db:migrate:pg      # 应用 PG 迁移（可选）
pnpm deploy             # wrangler deploy（读取根目录 wrangler.toml）
```

## 项目结构

```
├── app/                 # 前端（Nuxt srcDir）
│   ├── pages/           # index.vue 时间线 / settings.vue 设置
│   ├── components/      # 信息卡、发布区、说说卡、各弹窗
│   ├── layouts/ stores/ composables/ utils/
├── server/              # 后端（Nitro）
│   ├── api/             # 内部路由 + 公开路由
│   ├── db/              # schema（D1/PG）+ 仓库层
│   ├── middleware/      # 认证 + CORS
│   └── utils/           # env/jwt/password/storage/ratelimit
├── wrangler.toml       # Cloudflare Workers 配置（自动预置 D1/R2 绑定）
├── vercel.json         # Vercel 部署配置（可选）
├── netlify.toml        # Netlify 部署配置（可选）
└── drizzle/             # PG 迁移输出（可选）
```
