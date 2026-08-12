# dev.md · 开发备忘

## 双数据库仓库（D1 / PG）：已知坑位

### 现状

数据访问层有两套实现，接口一致（`DbRepo`）：

- `server/db/repo.d1.ts` — Cloudflare D1（SQLite，drizzle-orm/d1）
- `server/db/repo.pg.ts` — PostgreSQL（drizzle-orm/postgres-js）

### 已完成的合并（2026-08）

转换/校验层已抽到 **`server/db/repo.shared.ts`**（行映射、`parseImages`/`parseExtension`/`toPost`/`toTag`/`toUser`/`toComment`、`emailHash`）。
方言差异在共享层收敛，例如 D1 的 `private` 是 integer（`row.private === 1`），PG 是 boolean（`row.private`），共享层统一为
`row.private === true || row.private === 1`。**新增行字段或转换逻辑时只需改共享层**。

### 为什么数据访问层没有继续合并（坑）

方法体（select/insert/update/delete 链式调用）两边几乎逐字相同，但无法工厂化，原因：

- drizzle 的 `DrizzleD1Database` 与 `PostgresJsDatabase` 是**两套不兼容的类型**，`.select().from(table)` 的链式返回类型均不同
- schema 定义（`sqliteTable` vs `pgTable`）天然无法共享
- 强行合并需要 `(db as any)` 遍布全部方法（类型安全全丢）或超复杂条件类型（易错不可维护）

结论：**合并查询样板代码的收益 < 类型安全与回归风险代价**，维持双实现 + 纪律兜底。

### 维护纪律（务必遵守）

1. **改功能要双改**：新增/修改 `DbRepo` 方法时，`repo.d1.ts` 与 `repo.pg.ts` 必须同步
2. **提交前跑 parity 检查**：`pnpm check:repo-parity`（`scripts/check-repo-parity.mjs`，对比两边 async 方法集合，不一致即失败，已接入 CI）
3. **双端测试**：
   - `pnpm test` — D1 全链路（node:sqlite 模拟，本地可跑，33 项）
   - `pnpm test:pg` — PG 全链路（`tests/pg-flow.test.ts`，需要 `DATABASE_URL`，无则跳过；CI 中由 GitHub Actions 起 PostgreSQL 16 服务执行，8 项）

### 环境注意

- **Neon（PG 托管）**：schema 自举必须**逐条执行**（`SCHEMA_STATEMENTS` 数组循环），整串多语句 simple query 在 Neon 连接池（pgbouncer 事务池）上会随机中途失败（建一半表）；连接超时 `connect_timeout` 需 ≥30s（免费层冷启动慢）
- **国内网络**：本地连 Neon 偶发 ETIMEDOUT / 5s 超时属于网络抖动，PG 测试已加连接预热与登录重试；若全部 8 项失败先重跑一次排除抖动
- 两套 schema 文件（`schema.d1.ts` / `schema.pg.ts`）同样需要双改，方法签名检查只覆盖 repo 层

### 其它

- JWT 密钥：推荐显式配置固定值（长度 ≥32 字符，否则被忽略并回退自动生成）。三平台均可从环境变量读取：Cloudflare dashboard 的变量/机密、`wrangler secret put JWT_SECRET`、Vercel/Netlify 平台环境变量。勿写入 `wrangler.toml`（随仓库泄露风险；线上 secret 已与旧 vars 值一致，已发 token 不失效）
