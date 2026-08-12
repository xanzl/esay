<script setup lang="ts">
const props = defineProps<{ health: DbHealth | null }>()
const emit = defineEmits<{ retry: [] }>()

const title = computed(() => {
  if (props.health?.reason === 'missing_d1_binding') return '未检测到 D1 数据库绑定'
  if (props.health?.reason === 'missing_database_url') return '未配置数据库连接'
  if (props.health?.reason === 'connect_error') return '数据库连接失败'
  return '数据库未连接'
})

const detail = computed<Array<{ step: string; code?: string }>>(() => {
  const reason = props.health?.reason
  if (reason === 'missing_d1_binding') {
    return [
      {
        step: '在 Cloudflare 后台创建 D1 数据库：登录 dash.cloudflare.com → Workers & Pages → D1 → Create database，名称填 esay-db（可自定义）。',
      },
      {
        step: '在 Worker 上绑定该数据库：Workers & Pages → 你的 Worker → Settings → Bindings → Add binding → D1 database，选择刚创建的 esay-db，绑定名称填 DB。',
      },
      {
        step: '确认后请在后台重试当前部署重新部署并生效：',
      },
      {
        step: '如果部署在 Vercel / Netlify（而非 Cloudflare Workers），请改用 PostgreSQL：设置 DB_TYPE=postgresql 与 DATABASE_URL 后重新部署。',
      },
    ]
  }
  if (reason === 'missing_database_url') {
    return [
      {
        step: '当前使用 PostgreSQL 模式但未配置 DATABASE_URL。Vercel / Netlify 部署需要在平台侧配置以下环境变量（值按实际替换）：',
        code: 'DB_TYPE=postgresql\nDATABASE_URL=postgres://用户:密码@主机:5432/数据库\nSTORAGE_TYPE=s3\nS3_ENDPOINT=https://s3.amazonaws.com\nS3_REGION=us-east-1\nS3_BUCKET=你的存储桶\nS3_ACCESS_KEY_ID=你的密钥ID\nS3_SECRET_ACCESS_KEY=你的密钥\nPUBLIC_API_ENABLED=true\nAPP_URL=https://你的域名',
      },
      {
        step: 'Vercel：项目 → Settings → Environment Variables 逐项添加，保存后 Deployments → Redeploy 重新部署。',
      },
      {
        step: 'Netlify：Site configuration → Environment variables 逐项添加，保存后会自动触发重新构建。',
      },
      {
        step: 'JWT_SECRET（可选）可用下方命令生成并同样配置：',
        code: 'openssl rand -hex 32',
      },
      { step: '也可以改用 Cloudflare D1（默认模式），无需配置数据库连接串。' },
      { step: '配置并重新部署后，再点下方"重新检查"。' },
    ]
  }
  if (reason === 'connect_error') {
    return [
      { step: '已配置数据库但连接失败，服务端返回：' },
      { step: '', code: props.health?.message || '未知错误' },
      { step: '请检查连接串是否正确、数据库是否可被公网访问（白名单/防火墙）。' },
    ]
  }
  return [{ step: '无法连接服务端，请稍后重试或重新部署。' }]
})
</script>

<template>
  <section class="card mx-auto w-full max-w-md p-6">
    <div class="mb-5 text-center">
      <span class="icon-[ph--database] mx-auto mb-3 block text-4xl text-amber-500" />
      <h1 class="text-xl font-bold">连接数据库后再开始</h1>
      <p class="mt-1 text-sm text-gray-500">{{ title }}</p>
    </div>

    <ol class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
      <li v-for="(item, index) in detail" :key="index" class="flex flex-col gap-1.5">
        <span v-if="item.step" class="min-w-0">{{ index + 1 }}. {{ item.step }}</span>
        <pre
          v-if="item.code"
          class="w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-2 text-xs leading-relaxed dark:bg-gray-800"
        >{{ item.code }}</pre>
      </li>
    </ol>

    <button type="button" class="btn-primary mt-5 w-full" @click="emit('retry')">
      <span class="icon-[ph--arrows-clockwise] mr-1.5" />重新检查
    </button>
  </section>
</template>