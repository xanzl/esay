<script setup lang="ts">
type TabKey = 'dashboard' | 'profile' | 'security' | 'comments' | 'hub' | 'storage' | 'instance'

import { fetchHealthz, hubVersionAtLeast } from '~/services/hub'
import { pMapLimit } from '~/utils/hub-utils'

const auth = useAuthStore()
const ui = useUiStore()
const toast = useToast()
const api = useApi()

const activeTab = ref<TabKey>('dashboard')

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'dashboard', label: '控制台', icon: 'icon-[ph--gauge]' },
  { key: 'profile', label: '个人资料', icon: 'icon-[ph--user]' },
  { key: 'instance', label: '实例配置', icon: 'icon-[ph--globe-hemisphere-east]' },
  { key: 'security', label: '安全', icon: 'icon-[ph--shield-check]' },
  { key: 'comments', label: '评论', icon: 'icon-[ph--chat-circle-text]' },
  { key: 'hub', label: 'Hub 实例', icon: 'icon-[ph--link-simple]' },
  { key: 'storage', label: '存储', icon: 'icon-[ph--hard-drives]' },
]

// ---- 控制台 ----
interface Stats {
  posts: number
  today_posts: number
  comments: number
  likes: number
  tags: number
  users: number
}
const stats = ref<Stats | null>(null)
const statsLoading = ref(true)
const animated = ref<Record<string, number>>({})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const dateText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date()),
)

function animateTo(key: string, target: number) {
  const start = performance.now()
  const duration = 700
  const from = animated.value[key] ?? 0
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - p, 3)
    animated.value = { ...animated.value, [key]: Math.round(from + (target - from) * eased) }
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const statCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { key: 'posts', label: '说说总数', value: s.posts, icon: 'icon-[ph--note-pencil]' },
    { key: 'today_posts', label: '今日说说', value: s.today_posts, icon: 'icon-[ph--sun]' },
    { key: 'comments', label: '评论总数', value: s.comments, icon: 'icon-[ph--chat-circle-text]' },
    { key: 'likes', label: '点赞总数', value: s.likes, icon: 'icon-[ph--thumbs-up]' },
    { key: 'tags', label: '标签数', value: s.tags, icon: 'icon-[ph--tag]' },
  ]
})

async function loadDashboard() {
  statsLoading.value = true
  try {
    const data = await api<Stats>('/api/stats')
    stats.value = data
    const cards = [
      { key: 'posts', value: data.posts },
      { key: 'today_posts', value: data.today_posts },
      { key: 'comments', value: data.comments },
      { key: 'likes', value: data.likes },
      { key: 'tags', value: data.tags },
    ]
    for (const card of cards) animateTo(card.key, card.value)
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    statsLoading.value = false
  }
}

// ---- 个人资料 ----
const nickname = ref('')
const email = ref('')
const website = ref('')
const bio = ref('')
const avatarUrl = ref('')
const saving = ref(false)

watch(
  () => auth.user,
  (user: User | null) => {
    if (user) {
      nickname.value = user.nickname ?? user.username
      email.value = user.email ?? ''
      website.value = user.website ?? ''
      bio.value = user.bio ?? ''
      avatarUrl.value = user.avatar_url ?? ''
    }
  },
  { immediate: true },
)

async function saveProfile() {
  saving.value = true
  try {
    await auth.updateMe({
      nickname: nickname.value.trim(),
      email: email.value.trim(),
      website: website.value.trim(),
      bio: bio.value.trim(),
      avatar_url: avatarUrl.value.trim(),
    })
    toast.success('资料已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

// ---- 安全 ----
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)

const turnstileSiteKey = ref('')
const turnstileSecretKey = ref('')
const turnstileSecretSet = ref(false)
const turnstileClearSecret = ref(false)
const turnstileSaving = ref(false)
const turnstileLoaded = ref(false)
const turnstileCommentEnabled = ref(true)
const turnstileLoginEnabled = ref(false)

async function savePassword() {
  if (newPassword.value && newPassword.value.length < 6) {
    toast.error('新密码至少 6 位')
    return
  }
  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的新密码不一致')
    return
  }
  if (newPassword.value && !currentPassword.value) {
    toast.error('修改密码需要验证当前密码')
    return
  }
  passwordSaving.value = true
  try {
    await auth.updateMe({
      current_password: currentPassword.value,
      new_password: newPassword.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toast.success('密码已修改')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    passwordSaving.value = false
  }
}

async function loadTurnstile() {
  if (turnstileLoaded.value) return
  try {
    const { site_key, secret_set, comment_enabled, login_enabled } = await api<{
      site_key: string
      secret_set: boolean
      comment_enabled: boolean
      login_enabled: boolean
    }>('/api/turnstile/settings')
    turnstileSiteKey.value = site_key
    turnstileSecretSet.value = secret_set
    turnstileCommentEnabled.value = comment_enabled
    turnstileLoginEnabled.value = login_enabled
    turnstileLoaded.value = true
  } catch {
    /* ignore */
  }
}

async function saveTurnstile() {
  turnstileSaving.value = true
  try {
    await api('/api/turnstile/settings', {
      method: 'PUT',
      body: {
        site_key: turnstileSiteKey.value,
        secret_key: turnstileSecretKey.value,
        clear_secret: turnstileClearSecret.value,
        comment_enabled: turnstileCommentEnabled.value,
        login_enabled: turnstileLoginEnabled.value,
      },
    })
    turnstileSecretKey.value = ''
    turnstileClearSecret.value = false
    const { secret_set } = await api<{ secret_set: boolean }>('/api/turnstile/settings')
    turnstileSecretSet.value = secret_set
    toast.success('Turnstile 配置已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    turnstileSaving.value = false
  }
}

// ---- 评论 ----
const commentEnabled = ref(true)
const commentRequireApproval = ref(false)
const commentSaving = ref(false)
const commentLoaded = ref(false)

async function loadCommentSettings() {
  if (commentLoaded.value) return
  try {
    const config = await $fetch<PublicConfig>('/api/public/config')
    commentEnabled.value = config.comments_enabled
    commentRequireApproval.value = config.require_approval
    commentLoaded.value = true
  } catch {
    commentLoaded.value = true
  }
}

async function saveCommentSettings() {
  commentSaving.value = true
  try {
    await api('/api/comments/settings', {
      method: 'PUT',
      body: { enable_comment: commentEnabled.value, require_approval: commentRequireApproval.value },
    })
    toast.success('评论设置已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    commentSaving.value = false
  }
}

// ---- Hub ----
const hubInstances = ref<Array<{ id: string; url: string }>>([])
const hubDraftUrl = ref('')
const hubSaving = ref(false)
const hubAdding = ref(false)
const hubLoaded = ref(false)
const hubProbing = ref(false)
const hubStatuses = ref<Record<string, { ok: boolean; label: string; detail: string }>>({})

async function probeHubStatuses() {
  hubProbing.value = true
  const statuses: Record<string, { ok: boolean; label: string; detail: string }> = {}
  await pMapLimit(hubInstances.value, 5, async (inst: { id: string; url: string }) => {
    const h = await fetchHealthz(inst.url)
    if (!h.ok) {
      statuses[inst.url] = { ok: false, label: '离线', detail: h.message }
    } else if (!hubVersionAtLeast(h.version, '4.4.0')) {
      statuses[inst.url] = { ok: false, label: '版本过低', detail: `version ${h.version}` }
    } else {
      statuses[inst.url] = { ok: true, label: '在线', detail: `v${h.version}` }
    }
  })
  hubStatuses.value = statuses
  hubProbing.value = false
}

async function loadHubInstances() {
  if (hubLoaded.value) return
  try {
    const { instances } = await api<{ instances: Array<{ id: string; url: string }> }>(
      '/api/hub/instances',
    )
    hubInstances.value = instances
    hubLoaded.value = true
    probeHubStatuses().catch(() => {})
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

async function addHubInstance() {
  let url = hubDraftUrl.value.trim()
  if (!url) {
    toast.error('请填写实例地址')
    return
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace(/\/+$/, '')
  try {
    new URL(url)
  } catch {
    toast.error('实例地址格式不正确')
    return
  }
  if (hubInstances.value.some((i: { id: string; url: string }) => i.url === url)) {
    toast.error('该实例已存在')
    return
  }

  hubAdding.value = true
  let name = new URL(url).hostname
  try {
    const res = await fetch(`${url}/api/connect`, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as { data?: { server_name?: string } }
      const fetched = data?.data?.server_name?.trim()
      if (fetched) name = fetched
    }
  } catch {
    /* 拉取失败时用域名作为名称 */
  }
  hubInstances.value.push({ id: name, url })
  hubDraftUrl.value = ''
  hubAdding.value = false
  toast.success('已添加，可点击保存')
}

function removeHubInstance(index: number) {
  hubInstances.value.splice(index, 1)
}

async function saveHubInstances() {
  hubSaving.value = true
  try {
    await api('/api/hub/instances', {
      method: 'PUT',
      body: { instances: hubInstances.value },
    })
    toast.success('Hub 实例已保存')
    probeHubStatuses().catch(() => {})
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    hubSaving.value = false
  }
}

// ---- 存储 ----
interface StorageConfig {
  type: 'r2' | 's3'
  s3_endpoint: string
  s3_region: string
  s3_bucket: string
  s3_access_key_id: string
  s3_secret_access_key: string
}
const storageConfig = ref<StorageConfig>({
  type: 'r2',
  s3_endpoint: 'https://s3.amazonaws.com',
  s3_region: 'us-east-1',
  s3_bucket: '',
  s3_access_key_id: '',
  s3_secret_access_key: '',
})
const s3SecretKeyInput = ref('')
const s3SecretSet = ref(false)
const s3ClearSecret = ref(false)
const storageLoaded = ref(false)
const storageSaving = ref(false)
const storageTesting = ref(false)
const storageTestResult = ref<{ ok: boolean; message: string } | null>(null)

async function loadStorageConfig() {
  if (storageLoaded.value) return
  try {
    const data = await api<{
      type: 'r2' | 's3'
      s3_endpoint: string
      s3_region: string
      s3_bucket: string
      s3_access_key_id: string
      s3_secret_access_key_set: boolean
    }>('/api/storage/settings')
    storageConfig.value = {
      type: data.type,
      s3_endpoint: data.s3_endpoint,
      s3_region: data.s3_region,
      s3_bucket: data.s3_bucket,
      s3_access_key_id: data.s3_access_key_id,
      s3_secret_access_key: '',
    }
    s3SecretSet.value = data.s3_secret_access_key_set
    storageLoaded.value = true
  } catch {
    /* ignore */
  }
}

async function testStorage() {
  storageTesting.value = true
  storageTestResult.value = null
  try {
    storageTestResult.value = await api<{ ok: boolean; message: string }>('/api/storage/test', {
      method: 'POST',
      body: {
        ...storageConfig.value,
        s3_secret_access_key: s3SecretKeyInput.value,
      },
    })
  } catch (error) {
    storageTestResult.value = { ok: false, message: getErrorMessage(error) }
  } finally {
    storageTesting.value = false
  }
}

async function saveStorage() {
  storageSaving.value = true
  try {
    await api('/api/storage/settings', {
      method: 'PUT',
      body: {
        ...storageConfig.value,
        s3_secret_access_key: s3SecretKeyInput.value,
        clear_secret: s3ClearSecret.value,
      },
    })
    s3SecretKeyInput.value = ''
    s3ClearSecret.value = false
    const data = await api<{ s3_secret_access_key_set: boolean }>('/api/storage/settings')
    s3SecretSet.value = data.s3_secret_access_key_set
    toast.success('存储配置已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    storageSaving.value = false
  }
}

// ---- 实例配置 ----
interface SiteConfig {
  instance_name: string
  meting_api: string
}
const instanceName = ref('')
const metingApi = ref('')
const instanceLoaded = ref(false)
const instanceSaving = ref(false)
const instanceUrl = computed(() => window.location.origin)

async function loadInstanceConfig() {
  if (instanceLoaded.value) return
  try {
    const cfg = await api<SiteConfig>('/api/site/settings')
    instanceName.value = cfg.instance_name
    metingApi.value = cfg.meting_api
    instanceLoaded.value = true
  } catch {
    /* ignore */
  }
}

async function saveInstanceConfig() {
  instanceSaving.value = true
  try {
    await api('/api/site/settings', {
      method: 'PUT',
      body: { instance_name: instanceName.value, meting_api: metingApi.value },
    })
    toast.success('实例配置已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    instanceSaving.value = false
  }
}

// ---- 切换 ----
function switchTab(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'dashboard' && !stats.value) loadDashboard().catch(() => {})
  if (tab === 'comments') {
    loadCommentSettings().catch(() => {})
    loadTurnstile().catch(() => {})
  }
  if (tab === 'hub') loadHubInstances().catch(() => {})
  if (tab === 'security') loadTurnstile().catch(() => {})
  if (tab === 'storage') loadStorageConfig().catch(() => {})
  if (tab === 'instance') loadInstanceConfig().catch(() => {})
}

function logout() {
  auth.logout()
  toast.info('已退出登录')
  navigateTo('/')
}

onMounted(async () => {
  await auth.ensure()
  if (!auth.loggedIn) {
    ui.openLogin()
    navigateTo('/')
    return
  }
  loadDashboard().catch(() => {})
})
</script>

<template>
  <div class="mx-auto w-full max-w-screen-lg px-3 pb-16 pt-4">
    <div class="card p-4 sm:p-6">
      <header class="mb-5 flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800 md:mb-3">
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            {{ greeting }}，{{ auth.user?.nickname || auth.user?.username }} 👋
          </h1>
          <p class="mt-0.5 text-xs text-gray-400">{{ dateText }}</p>
          <p class="mt-1 text-xs text-gray-400">静等思想与灵感的碰撞</p>
        </div>
        <NuxtLink
          to="/"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <span class="icon-[ph--arrow-left] text-sm" />返回时间线
        </NuxtLink>
      </header>

      <div class="flex flex-col gap-4 md:flex-row">
        <nav class="flex gap-1 overflow-x-auto pb-1 md:w-44 md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
            :class="
              activeTab === tab.key
                ? 'bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            "
            @click="switchTab(tab.key)"
          >
            <span :class="tab.icon" class="text-base" />
            {{ tab.label }}
          </button>
          <button
            type="button"
            class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
            @click="logout"
          >
            <span class="icon-[memory--logout] text-base" />退出登录
          </button>
        </nav>

        <div class="min-w-0 flex-1">
          <!-- 控制台 -->
          <div v-if="activeTab === 'dashboard'">
            <div v-if="statsLoading" class="py-16 text-center text-gray-400">
              <span class="icon-[ph--spinner] animate-spin text-2xl" />
            </div>
            <template v-else>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div
                  v-for="card in statCards"
                  :key="card.key"
                  class="flex flex-col gap-1.5 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <span :class="card.icon" class="text-xl text-indigo-500" />
                  <span class="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {{ animated[card.key] ?? 0 }}
                  </span>
                  <span class="text-xs text-gray-400">{{ card.label }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- 个人资料 -->
          <div v-else-if="activeTab === 'profile'" class="flex flex-col gap-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">站长头像</label>
              <div class="flex items-center gap-4">
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  alt="头像预览"
                  class="h-16 w-16 rounded-full border border-gray-200 object-cover dark:border-gray-700"
                />
                <div
                  v-else
                  class="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500 text-xl font-bold text-white"
                >
                  {{ (nickname || 'M').slice(0, 1) }}
                </div>
                <input v-model="avatarUrl" type="url" class="input flex-1" placeholder="头像图片 URL" />
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">昵称（展示名）</label>
              <input v-model="nickname" type="text" class="input w-full" placeholder="展示在顶部信息卡与 Hub 上的名字" maxlength="30" />
              <p class="mt-1 text-xs text-gray-400">
                登录用户名：{{ auth.user?.username }}（仅用于登录，展示统一使用昵称）
              </p>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">邮箱</label>
              <input v-model="email" type="email" class="input w-full" placeholder="用于接收通知（可选）" maxlength="255" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">个人简介</label>
              <textarea v-model="bio" rows="2" class="input w-full resize-none" placeholder="一句话介绍自己" maxlength="200" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">个人主页链接</label>
              <input v-model="website" type="url" class="input w-full" placeholder="用于自动填充评论和评论通知（待定开发）" maxlength="255" />
            </div>
            <button class="btn-primary self-start" :disabled="saving" @click="saveProfile">
              <span v-if="saving" class="icon-[ph--spinner] animate-spin" />保存资料
            </button>
          </div>

          <!-- 实例配置 -->
          <div v-else-if="activeTab === 'instance'" class="flex flex-col gap-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">实例名称</label>
              <input
                v-model="instanceName"
                type="text"
                class="input w-full"
                maxlength="100"
                placeholder="请输入实例名称"
              />
              <p class="mt-1 text-xs text-gray-400">
                展示在其他 Hub 站点上你的实例名称（/api/connect 的 server_name）。留空时回退为站长昵称或用户名。
              </p>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">实例地址</label>
              <input :value="instanceUrl" type="text" class="input w-full" readonly />
              <p class="mt-1 text-xs text-gray-400">只读展示，实例地址由部署域名决定。</p>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">Meting API（音乐解析）</label>
              <input
                v-model="metingApi"
                type="text"
                class="input w-full"
                maxlength="300"
                placeholder="https://api.injahow.cn/meting/"
              />
              <p class="mt-1 text-xs text-gray-400">
                用于解析音乐扩展的歌曲信息，可换成自建或其他兼容实例。留空使用默认服务。
              </p>
            </div>
            <button class="btn-primary self-start" :disabled="instanceSaving" @click="saveInstanceConfig">
              <span v-if="instanceSaving" class="icon-[ph--spinner] animate-spin" />保存实例配置
            </button>
          </div>

          <!-- 安全 -->
          <div v-else-if="activeTab === 'security'" class="flex flex-col gap-6">
            <div class="flex flex-col gap-3">
              <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-300">修改密码</h2>
              <input v-model="currentPassword" type="password" class="input w-full" placeholder="当前密码" autocomplete="current-password" />
              <input v-model="newPassword" type="password" class="input w-full" placeholder="新密码（至少 6 位）" autocomplete="new-password" />
              <input v-model="confirmPassword" type="password" class="input w-full" placeholder="确认新密码" autocomplete="new-password" />
              <button class="btn-primary self-start" :disabled="passwordSaving" @click="savePassword">
                <span v-if="passwordSaving" class="icon-[ph--spinner] animate-spin" />修改密码
              </button>
            </div>

            <div class="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Turnstile 人机验证</h2>
              <div>
                <label class="mb-1 block text-xs text-gray-400">站点密钥（Site Key，公开）</label>
                <input v-model="turnstileSiteKey" type="text" class="input w-full" maxlength="255" placeholder="0x4AAAAAAA…" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-400">密钥（Secret Key，仅存服务端）</label>
                <div class="flex gap-2">
                  <input
                    v-model="turnstileSecretKey"
                    type="password"
                    class="input min-w-0 flex-1"
                    maxlength="255"
                    :placeholder="turnstileClearSecret ? '将清除已保存的密钥' : turnstileSecretSet ? '已设置，留空保持不变' : '未设置，输入以启用'"
                  />
                  <button
                    v-if="turnstileSecretSet && !turnstileClearSecret"
                    type="button"
                    class="btn shrink-0 text-red-400 hover:text-red-500"
                    @click="turnstileClearSecret = true"
                  >
                    清除密钥
                  </button>
                  <button
                    v-if="turnstileClearSecret"
                    type="button"
                    class="btn shrink-0"
                    @click="turnstileClearSecret = false"
                  >
                    取消
                  </button>
                </div>
              </div>
              <p class="text-xs text-gray-400">
                在 Cloudflare 控制台 → Turnstile → 你的 widget 中获取。留空则无需验证。
              </p>
              <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                <span class="text-sm text-gray-600 dark:text-gray-300">
                  登录页启用验证码
                  <span class="block text-xs text-gray-400">开启后登录前需通过人机验证</span>
                </span>
                <BaseSwitch v-model="turnstileLoginEnabled" />
              </label>
              <button class="btn-primary self-start" :disabled="turnstileSaving" @click="saveTurnstile">
                <span v-if="turnstileSaving" class="icon-[ph--spinner] animate-spin" />保存 Turnstile 配置
              </button>
            </div>
          </div>

          <!-- 评论 -->
          <div v-else-if="activeTab === 'comments'" class="flex flex-col gap-3">
            <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
              <span class="text-sm text-gray-600 dark:text-gray-300">
                开启评论
                <span class="block text-xs text-gray-400">访客可在说说详情页发表评论</span>
              </span>
              <BaseSwitch v-model="commentEnabled" />
            </label>
            <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
              <span class="text-sm text-gray-600 dark:text-gray-300">
                评论需审核
                <span class="block text-xs text-gray-400">新评论先进入"待审核"，通过后才公开展示</span>
              </span>
              <BaseSwitch v-model="commentRequireApproval" />
            </label>
            <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
              <span class="text-sm text-gray-600 dark:text-gray-300">
                评论启用验证码
                <span class="block text-xs text-gray-400">访客发表评论前需通过人机验证（需先配置 Turnstile 密钥）</span>
              </span>
              <BaseSwitch v-model="turnstileCommentEnabled" />
            </label>
            <button class="btn-primary self-start" :disabled="commentSaving" @click="saveCommentSettings">
              <span v-if="commentSaving" class="icon-[ph--spinner] animate-spin" />保存评论设置
            </button>
          </div>

          <!-- Hub -->
          <div v-else-if="activeTab === 'hub'" class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-300">Hub 实例（探索合流）</h2>
              <button
                type="button"
                class="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                :title="'刷新状态'"
                :disabled="hubProbing"
                @click="probeHubStatuses"
              >
                <span class="icon-[ph--arrows-clockwise] text-base" :class="hubProbing ? 'animate-spin' : ''" />
              </button>
            </div>
            <div v-if="hubInstances.length" class="overflow-x-auto">
              <table class="w-full min-w-[28rem] text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-400">
                    <th class="pb-2 pr-3 font-medium">名称</th>
                    <th class="pb-2 pr-3 font-medium">地址</th>
                    <th class="pb-2 pr-3 font-medium">状态</th>
                    <th class="pb-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="inst in hubInstances"
                    :key="inst.url"
                    class="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td class="max-w-[8rem] truncate py-2 pr-3 font-medium text-gray-700 dark:text-gray-200">
                      {{ inst.id }}
                    </td>
                    <td class="max-w-[12rem] truncate py-2 pr-3">
                      <a
                        :href="inst.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-gray-400 hover:text-indigo-500"
                      >
                        {{ inst.url }}
                      </a>
                    </td>
                    <td class="py-2 pr-3">
                      <span
                        v-if="hubStatuses[inst.url]"
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                        :class="
                          hubStatuses[inst.url].ok
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : 'bg-red-50 text-red-500 dark:bg-red-900/40 dark:text-red-400'
                        "
                        :title="hubStatuses[inst.url].detail"
                      >
                        {{ hubStatuses[inst.url].label }}
                      </span>
                      <span v-else class="text-xs text-gray-300 dark:text-gray-600">检测中…</span>
                    </td>
                    <td class="py-2 text-right">
                      <button
                        type="button"
                        class="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        :aria-label="`移除 ${inst.id}`"
                        :title="'移除'"
                        @click="removeHubInstance(hubInstances.indexOf(inst))"
                      >
                        <span class="icon-[ph--trash] text-sm" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-xs text-gray-400">尚未添加实例，合流页面会提示先配置。</p>
            <div class="flex gap-2">
              <input
                v-model="hubDraftUrl"
                type="text"
                class="input min-w-0 flex-1"
                placeholder="请输入实例地址"
              />
              <button type="button" class="btn shrink-0" :disabled="hubAdding" @click="addHubInstance">
                <span v-if="hubAdding" class="icon-[ph--spinner] animate-spin" />
                {{ hubAdding ? '获取中…' : '添加' }}
              </button>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-primary self-start" :disabled="hubSaving" @click="saveHubInstances">
                <span v-if="hubSaving" class="icon-[ph--spinner] animate-spin" />保存 Hub 实例
              </button>
              <NuxtLink to="/hub" class="text-xs text-indigo-500 hover:underline">去 Hub 看看 →</NuxtLink>
            </div>
          </div>
          <!-- 存储 -->
          <div v-else-if="activeTab === 'storage'" class="flex flex-col gap-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">存储类型</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2.5 text-sm transition"
                  :class="
                    storageConfig.type === 'r2'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                  "
                  @click="storageConfig.type = 'r2'"
                >
                  <span class="icon-[ph--cloud] text-base" />Cloudflare R2
                </button>
                <button
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2.5 text-sm transition"
                  :class="
                    storageConfig.type === 's3'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'
                  "
                  @click="storageConfig.type = 's3'"
                >
                  <span class="icon-[ph--hard-drives] text-base" />S3 兼容
                </button>
              </div>
              <p class="mt-1.5 text-xs text-gray-400">
                {{ storageConfig.type === 'r2' ? '使用 Worker 自带的 R2 绑定（moment-images），无需额外配置。' : '可接入任意 S3 兼容服务（MinIO、腾讯云 COS、阿里云 OSS 等）。' }}
              </p>
            </div>

            <template v-if="storageConfig.type === 's3'">
              <div>
                <label class="mb-1 block text-xs text-gray-400">Endpoint（不带 Bucket 与协议以外的路径）</label>
                <input v-model="storageConfig.s3_endpoint" type="text" class="input w-full" placeholder="https://s3.amazonaws.com" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-xs text-gray-400">Region</label>
                  <input v-model="storageConfig.s3_region" type="text" class="input w-full" placeholder="us-east-1" />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-gray-400">Bucket</label>
                  <input v-model="storageConfig.s3_bucket" type="text" class="input w-full" placeholder="my-bucket" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-400">Access Key ID</label>
                <input v-model="storageConfig.s3_access_key_id" type="text" class="input w-full" placeholder="AKIA…" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-gray-400">Secret Access Key</label>
                <div class="flex gap-2">
                  <input
                    v-model="s3SecretKeyInput"
                    type="password"
                    class="input min-w-0 flex-1"
                    :placeholder="s3ClearSecret ? '将清除已保存的密钥' : s3SecretSet ? '已设置，留空保持不变' : '未设置，输入以启用'"
                  />
                  <button
                    v-if="s3SecretSet && !s3ClearSecret"
                    type="button"
                    class="btn shrink-0 text-red-400 hover:text-red-500"
                    @click="s3ClearSecret = true"
                  >
                    清除密钥
                  </button>
                  <button
                    v-if="s3ClearSecret"
                    type="button"
                    class="btn shrink-0"
                    @click="s3ClearSecret = false"
                  >
                    取消
                  </button>
                </div>
              </div>
              <p class="text-xs text-gray-400">
                建议为存储桶创建专用的最小权限密钥（PutObject / GetObject）。图片仍通过本站
                <code class="rounded bg-gray-100 px-1 dark:bg-gray-800">/api/files/**</code>
                代理访问，无需公开存储桶。
              </p>
            </template>

            <div class="flex items-center gap-3">
              <button type="button" class="btn" :disabled="storageTesting" @click="testStorage">
                <span v-if="storageTesting" class="icon-[ph--spinner] animate-spin" />
                <span v-else class="icon-[ph--plug] mr-1" />测试连接
              </button>
              <button type="button" class="btn-primary" :disabled="storageSaving" @click="saveStorage">
                <span v-if="storageSaving" class="icon-[ph--spinner] animate-spin" />保存配置
              </button>
            </div>
            <p v-if="storageTestResult" class="text-sm" :class="storageTestResult.ok ? 'text-emerald-500' : 'text-red-500'">
              {{ storageTestResult.message }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>