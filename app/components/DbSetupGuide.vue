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
        step: '在项目根目录 wrangler.toml 的 d1_databases 中添加（或确认已有）D1 绑定：',
        code: 'd1_databases = [{ binding = "DB", database_name = "moment-db" }]',
      },
      { step: '确认已执行 wrangler login 登录 Cloudflare 账号。' },
      { step: '重新构建并部署：' },
      { step: '', code: 'npm run build && npm run deploy' },
    ]
  }
  if (reason === 'missing_database_url') {
    return [
      { step: '当前使用 PostgreSQL 模式但未配置 DATABASE_URL，请在部署平台（Vercel / Netlify 等）设置环境变量：' },
      { step: '', code: 'DB_TYPE=postgresql\nDATABASE_URL=postgres://…' },
      { step: '也可以改用 Cloudflare D1（默认），无需配置数据库连接串。' },
      { step: '配置后重新部署，再点下方"重新检查"。' },
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
      <li v-for="(item, index) in detail" :key="index" class="flex gap-2">
        <span v-if="item.step" class="min-w-0">{{ index + 1 }}. {{ item.step }}</span>
        <pre
          v-if="item.code"
          class="w-full overflow-x-auto rounded-lg bg-gray-100 p-2 text-xs leading-relaxed dark:bg-gray-800"
        >{{ item.code }}</pre>
      </li>
    </ol>

    <button type="button" class="btn-primary mt-5 w-full" @click="emit('retry')">
      <span class="icon-[ph--arrows-clockwise] mr-1.5" />重新检查
    </button>
  </section>
</template>