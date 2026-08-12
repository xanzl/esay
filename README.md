# esay · 单用户极简说说系统

> **esay** = echo say——轻说。
> 开源协议：**MIT**（见 [LICENSE](LICENSE)）｜Hub 协议兼容 [ech0](https://github.com/lin-snow/ech0)（AGPL-3.0）

为个人设计的极简说说系统：记录日常动态、想法或短内容，支持 Markdown 与图片，并可通过公开 API 外嵌到个人博客等任意站点。

- 全栈：Nuxt 3（Nitro 服务端）+ TypeScript
- 样式：TailwindCSS 4（卡片式流式响应式布局）+ @iconify/tailwind4（类名图标）
- 数据库：Drizzle ORM（统一适配 Cloudflare D1 / PostgreSQL）
- 认证：JWT（jose，WebCrypto 签名）+ bcrypt（bcryptjs，纯 JS，Workers 原生兼容）
- 存储：Cloudflare R2 / 任意 S3 兼容服务
- 部署：Cloudflare Workers（主推）、Vercel、Netlify

## 一键部署

** 一键部署暂不推荐 **

> 推荐流程：先 **Fork** 本仓库 → 用 Fork 后的仓库部署（部署入口详见下方各平台）→ 以后更新只需在 GitHub 上点 **Sync fork** 同步上游，平台自动重新部署。

**Cloudflare Workers（）** — D1 数据库与 R2 存储桶与 worker 集成度最佳，后台绑定后首次打开站点按引导初始化管理员：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/xanzl/esay)

**Vercel** — 需配置 PostgreSQL（`DB_TYPE=postgresql`）+ S3（`STORAGE_TYPE=s3`），见下方环境变量表：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xanzl/esay)

**Netlify** — 同上，需 PostgreSQL + S3：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/xanzl/esay)

> 一键部署按钮指向本仓库；若要长期自动更新，建议 **Fork 后 **再部署，或使用下方「Git 集成」方式关联 fork。

## 快速开始（Cloudflare Workers，推荐）

### 第一步：Fork 仓库

1. 打开 [github.com/xanzl/esay](https://github.com/xanzl/esay)，点击右上角 **Fork**（保留默认设置即可）
2. 后续用你的 fork 部署；更新时在 fork 页面点 **Sync fork → Update branch** 即可同步上游最新代码

### 第二步：创建 Worker 并关联仓库（Git 集成，推荐）

1. Cloudflare dashboard → Workers & Pages → **Create** → 选择 **Git integration（Builds from GitHub）** → Connect GitHub，选择你刚 fork 的仓库
2. 构建命令与输出目录会自动读取 `wrangler.toml` 的 `[build]` 配置，无需手动填写
3. 创建完成后，push 到 fork 的任何改动都会自动重新构建部署

> 也可以直接用右上角一键部署按钮（一次性部署，无自动更新，不推荐）。

### 第三步：后台配置数据库与存储绑定

（表结构在首次请求时自动创建，管理员账号通过站点初始化页面设置）

1. **创建 D1 数据库**：dash.cloudflare.com → Workers & Pages → D1 → Create database，名称 `esay-db`
2. **创建 R2 存储桶**：Workers & Pages → R2 → Create bucket，名称 `esay-images`
3. **绑定到 Worker**：Workers & Pages → 你的 Worker → Settings → Bindings → Add binding：
   - D1 database → 选择 `esay-db`，绑定名称 `DB`
   - R2 bucket → 选择 `esay-images`，绑定名称 `R2`

4. 打开站点，在「初始化 esay」页面设置管理员用户名与密码即可使用。

## 如何更新

新版本通过 GitHub Releases 发布（仓库右上角 Watch → Custom → **Releases** 可收发布通知）。

**数据自动迁移，无需任何手动操作**：表结构在首次请求时自动创建/补列（`CREATE TABLE IF NOT EXISTS` + 幂等 ALTER），升级到新版本后第一次请求即完成迁移，不用跑 migration、不用执行 SQL。

三种更新方式任选：

### 方式一：同步 fork（推荐，网页操作即可）

1. 打开你在 GitHub 上的 **fork 仓库**页面
2. 点击 **Sync fork → Update branch**（把上游最新代码合并到你的 fork）
3. Git 集成检测到更新后**自动重新构建部署**，无需任何其他操作

> 如果你部署的不是 fork（比如一键部署的原仓库），则用方式二或方式三。

### 方式二：一键部署重跑（不推荐）

新版本发布后，重新点一次 README 顶部的一键部署按钮（部署到同一 Worker 名称即可覆盖更新）。注意：后台配置的变量与绑定**需要重新确认**（绑定在后台配置，通常不受影响；变量如被清空需重新添加）。

### 升级前备份（建议）

| 平台 | 备份命令 |
| --- | --- |
| Cloudflare D1 | `wrangler d1 export esay-db --remote --output backup.sql` |
| PostgreSQL | `pg_dump "你的 DATABASE_URL" > backup.sql` |

### 可选配置

- `JWT_SECRET`（推荐配置）：JWT 签名密钥。**不配置也能用**——首次请求自动生成并持久化到数据库（跨部署/重启不失效）；但多实例部署（Vercel/Netlify 的函数实例）存在并发生成、登录态偶发失效的窗口，建议显式配置固定值。三种配置方式任选：
  - Cloudflare dashboard：Workers → 你的 Worker → 设置 → 变量与机密 → 添加（普通变量或机密均可，名称 `JWT_SECRET`）
  - Vercel / Netlify：平台的环境变量设置里添加 `JWT_SECRET`
  - 生成方式见下方「生成 JWT 密钥」
- 在环境变量配置 `GITHUB_TOKEN`（可选）：GitHub 项目卡片解析携带该 Token，API 配额从 60 次/小时提升至 5000 次/小时；解析结果缓存 24 小时（D1/PG `extension_cache` 表），同一仓库不重复请求
- 绑定名称固定为 `DB`（D1）与 `R2`（存储桶），配置错了初始化页会提示；数据持久保留在 `esay-db` / `esay-images` 中（名称可自定义），可在仪表盘查看
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

这里可以注册[Neon](https://neon.com/)使用它家提供的 PostgreSQL 数据库，免费版已够用

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

各平台需要配置的变量见上文「Vercel / Netlify 部署」表格与「可选配置」；本地开发可自行创建 `.env`（变量名同上表）。

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
