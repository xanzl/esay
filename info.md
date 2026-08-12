Moment · 单用户说说系统 · 极简规划文档

注意：如果你觉得有可以改进的地方，请向用户提出来判断是否改进

---

一、项目定位

Moment 是一款专为个人设计的极简说说系统。仅服务于单用户（你自己），用于记录日常动态、想法或短内容，并可将内容通过公开 API 外嵌到个人博客等任意站点。

不是多用户社交平台，不含评论、关注、话题、热搜等任何社交功能。

---

二、核心功能

功能 说明
登录 用户名 + 密码（单用户）
发布说说 支持文字 + 最多 9 张图片，支持 Markdown
编辑说说 点击卡片右上角编辑按钮，修改内容或图片
时间线 按发布时间倒序排列，无限滚动加载更多
删除说说 随时删除任意一条
搜索说说 按关键词搜索历史说说
站长信息卡 顶部卡片展示头像、昵称，未登录显示登录+搜索按钮，已登录显示设置+搜索按钮
设置页面 修改站长头像、昵称、密码等
公开 API 无需认证即可获取说说列表/单条，便于外嵌展示

---

三、技术栈

· 全栈框架：Nuxt 3（含 Nitro 服务端）
· 语言：TypeScript
· 样式：TailwindCSS（卡片式流式响应式设计）
· 图标库：@iconify/tailwind（通过类名使用图标）
· 数据库 ORM：Drizzle（统一适配 D1 / PostgreSQL）
· 认证：JWT + bcrypt
· 存储：R2 / S3（图片上传）
· 部署平台：Cloudflare Workers（主推）、Vercel、Netlify

图标库使用说明（@iconify/tailwind）

本项目使用 @iconify/tailwind 作为图标方案，通过类名方式引入图标，无需额外加载字体文件或 SVG 组件。

详细教程参考：在 TailwindCSS 中使用 Iconify 图标

安装

```bash
# Tailwind CSS 3
npm i @iconify/json @iconify/tailwind -D

# Tailwind CSS 4
npm i @iconify/json @iconify/tailwind4 -D
```

配置

Tailwind CSS 3 – 在 tailwind.config.js 中声明插件：

```js
const { addDynamicIconSelectors } = require('@iconify/tailwind')

export default {
  plugins: [addDynamicIconSelectors()]
}
```

Tailwind CSS 4 – 在 main.css 中声明插件：

```css
@import 'tailwindcss';
@plugin "@iconify/tailwind4";
```

使用方式

配置完成后，通过类名即可引入图标：

```html
<!-- 格式：i-{图标库名}-{图标名} -->
<span class="i-ph-magnifying-glass"></span>
<span class="i-ph-pencil-simple"></span>
<span class="i-ph-gear-six"></span>
```

图标颜色与大小

图标颜色和大小由父级或元素本身的文字颜色（color）和字体大小（font-size）控制：

```html
<!-- 设置颜色和大小 -->
<span class="i-ph-magnifying-glass text-rose-500 text-2xl"></span>
```

查找图标

推荐使用 Yesicon 搜索图标，找到心仪的图标后复制类名即可使用。

本项目常用图标

用途 图标库 图标类名
搜索 Iconamoon i-iconamoon-search
登录 Memory i-memory-login
亮色模式 Material Symbols i-material-symbols-light-mode-outline-rounded
暗色模式 Material Symbols i-material-symbols-dark-mode-outline-rounded
点赞 Iconamoon i-iconamoon-like
设置 Phosphor i-ph-gear-six
发布 Phosphor i-ph-paper-plane-right
编辑 Phosphor i-ph-pencil-simple
删除 Phosphor i-ph-trash
图片 Phosphor i-ph-image
日历 Phosphor i-ph-calendar-blank
关闭 Phosphor i-ph-x
加载中 Phosphor i-ph-spinner（配合 animate-spin）

💡 图标库前缀说明：ph = Phosphor，iconamoon = Iconamoon，memory = Memory，material-symbols = Material Symbols

---

四、数据模型（极简）

仅两张表：

· users：id, username, password_hash, avatar_url, bio, created_at
· posts：id, content, images (JSON 数组), created_at, updated_at

---

五、API 设计

内部 API（需 JWT 认证）

· POST /api/auth/login → 登录
· GET /api/auth/me → 获取当前用户信息
· PUT /api/auth/me → 更新用户信息（头像、昵称、密码）
· GET /api/posts → 分页获取说说（游标分页，返回 nextCursor 和 hasMore）
· POST /api/posts → 发布说说
· PUT /api/posts/:id → 编辑说说（内容、图片）
· DELETE /api/posts/:id → 删除
· GET /api/posts/search → 按关键词搜索说说
· POST /api/upload → 上传图片（返回 URL）

公开 API（无需认证，内容外露）

· GET /api/public/posts → 获取说说列表（支持分页，用于外嵌）
· GET /api/public/posts/:id → 获取单条说说详情

公开 API 可配置是否开启，并支持跨域（CORS）。

---

六、前端设计原则

· 卡片式：每条说说为独立圆角卡片，带轻微阴影
· 流式布局：卡片根据屏幕宽度自动排列（移动端 1 列，平板 2 列，桌面 3 列）
· 响应式：移动优先，适配所有尺寸
· 极简：页面结构清晰，聚焦内容

页面布局

```
┌─────────────────────────────────────────────┐
│  ┌───────────────────────────────────────┐  │
│  │           [ 站长头像 ]                │  │  ← 站长信息卡
│  │           站长昵称                    │  │     (固定顶部)
│  │    [🔍]  [🔑登录]                    │  │
│  │    (登录后: [🔍] [⚙️设置])           │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │   ✏️ 这一刻在想什么？                 │  │  ← 发布区域
│  │   [🖼️]  [📤 发布]                    │  │     (仅登录可见)
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📝 今天天气真好！          [✏️]     │  │  ← 说说卡片
│  │  [图片] [图片]                       │  │     (编辑按钮右上角)
│  │  📅 2026-08-08  [🗑️]               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📝 分享一篇文章...          [✏️]     │  │
│  │  📅 2026-08-07  [🗑️]               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  加载更多...                                │
└─────────────────────────────────────────────┘
```

图标使用场景

位置 图标 Iconify 类名
搜索按钮 放大镜 i-iconamoon-search
登录按钮 钥匙 i-memory-login
设置按钮 齿轮 i-ph-gear-six
发布区域 铅笔 i-ph-pencil
添加图片 图片 i-ph-image
发布按钮 发送 i-ph-paper-plane-right
编辑按钮（卡片右上角） 铅笔 i-ph-pencil-simple
删除按钮 垃圾桶 i-ph-trash
时间/日期 日历 i-ph-calendar-blank
空状态 空盒子 i-ph-box
加载中 加载圈 i-ph-spinner（配合 animate-spin）
关闭弹窗 X i-ph-x
登录成功 对勾 i-ph-check-circle
点赞 爱心 i-iconamoon-like
亮色模式切换 太阳 i-material-symbols-light-mode-outline-rounded
暗色模式切换 月亮 i-material-symbols-dark-mode-outline-rounded

核心交互

元素 交互
站长头像（居中） 点击无操作，仅展示
登录按钮 未登录时显示，点击弹出登录弹窗
设置按钮 登录后替代登录按钮，点击进入设置页面
搜索按钮 始终显示，点击弹出搜索框
发布区域 仅登录后可见，位于站长卡片下方
说说编辑按钮 每条卡片右上角，仅登录用户可见，点击弹窗编辑

---

七、部署方案

平台 推荐数据库 推荐存储
Cloudflare Workers（主推） D1 R2
Vercel PostgreSQL（Neon/Supabase） S3 兼容
Netlify PostgreSQL（Neon/Supabase） S3 兼容

部署方式均为 Git 推送或 CLI 一键命令。

---

八、环境变量（关键）

· DB_TYPE：d1 或 postgresql
· DATABASE_URL（PG 时必填）
· STORAGE_TYPE：r2 或 s3
· R2_* 或 S3_* 相关配置
· JWT_SECRET
· ADMIN_USERNAME 和 ADMIN_PASSWORD_HASH（首次初始化用）
· APP_URL（用于公开 API 的完整域名）

---

九、项目结构（三大类）

```
moment/
├── app/                # 前端
│   ├── pages/          # index.vue（时间线），settings.vue
│   ├── components/     # 站长信息卡、发布区域、说说卡片、编辑弹窗、搜索弹窗
│   ├── layouts/        # 默认布局
│   ├── stores/         # Pinia（认证、说说列表）
│   └── composables/    # 无限滚动、API 调用、搜索
├── server/             # 后端 API
│   ├── api/            # 内部路由 + 公开路由
│   ├── db/             # Schema + 适配器（D1/PG）
│   ├── middleware/     # 认证中间件
│   └── utils/          # JWT / bcrypt / 存储适配器
├── platforms/          # wrangler.toml / vercel.json / netlify.toml
├── drizzle/            # 迁移配置
└── 配置文件（nuxt.config.ts, .env.example, README.md）
```

---

十、实施路线图

1. 初始化：Nuxt3 + TypeScript + Tailwind + @iconify/tailwind + Drizzle 配置
2. 数据库与适配器：Schema 定义，D1 与 PG 驱动统一接口
3. 后端 API：登录、增删改查、编辑、搜索、上传、公开接口、用户设置更新
4. 前端页面：登录页、时间线（含站长信息卡）、发布区域、编辑弹窗、设置页、搜索弹窗
5. 存储集成：R2 / S3 直传
6. 平台部署：三个平台分别适配
7. 测试与安全（仅 Cloudflare 真实环境，wrangler deploy）
8. 文档与开源：README、部署指南、API 文档

---

十一、测试与验收（仅 Cloudflare）

测试环境：Cloudflare Workers（wrangler deploy 部署到预览或生产环境）

⚠️ 不使用 wrangler dev，所有测试均在真实 Workers 环境中进行。

功能验收清单

· 未登录时顶部显示「搜索」和「登录」按钮（图标+文字）
· 用户名密码可正常登录
· 登录后顶部显示「搜索」和「设置」按钮（图标+文字）
· 登录后站长信息卡下方出现发布区域
· 可发布纯文字说说
· 可发布带 1-9 张图片的说说
· 时间线按时间倒序排列
· 滚动到底部自动加载更多
· 每条说说卡片右上角显示编辑图标（仅登录可见）
· 可编辑说说内容或图片
· 可删除说说
· 搜索功能可按关键词筛选说说
· 设置页面可修改头像、昵称、密码
· 公开 API 返回正确的 JSON 数据并支持 CORS
· 退出登录后需重新登录

技术验收清单

· TypeScript 类型检查通过（tsc --noEmit）
· wrangler deploy 部署成功
· D1 数据库连接正常
· R2 图片上传与访问正常
· 响应式设计在手机/平板/桌面均正常
· 图标库正常加载，所有图标正确显示

---

十二、公开 API 的使用场景

用户可将公开 API 嵌入：

· 个人博客的"动态"侧栏
· 个人主页的最新状态展示
· 任意支持 fetch 的静态站点

API 返回纯净的 JSON 数据，前端可自由定制样式。

---

文档结束

版本 2.5 · 极简单用户版 · 含图标库及自定义图标 · 仅 Cloudflare 验收