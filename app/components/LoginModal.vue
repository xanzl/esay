<script setup lang="ts">
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const loginTurnstileEnabled = ref(false)
const turnstileSiteKey = ref('')
const turnstileWidgetId = ref<string | null>(null)
const turnstileStatus = ref<'idle' | 'pending' | 'verified'>('idle')
const turnstileMount = ref<HTMLElement | null>(null)
let turnstileLoaded = false

const auth = useAuthStore()
const ui = useUiStore()
const toast = useToast()
const api = useApi()

async function loadConfig() {
  try {
    const config = await api<PublicConfig>('/api/public/config', { auth: false })
    loginTurnstileEnabled.value = config.login_turnstile_enabled === true
    turnstileSiteKey.value = config.turnstile_site_key ?? ''
  } catch {
    /* ignore */
  }
}

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const existing = document.querySelector('script[src*="turnstile/v0/api.js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => resolve())
    document.head.appendChild(script)
  })
}

async function renderTurnstile() {
  if (!loginTurnstileEnabled.value || !turnstileSiteKey.value) return
  if (!turnstileLoaded) {
    await loadTurnstileScript()
    turnstileLoaded = true
  }
  await nextTick()
  const mount = turnstileMount.value
  const ts = window.turnstile
  if (!mount || !ts) return
  if (turnstileWidgetId.value) {
    ts.reset(turnstileWidgetId.value)
    return
  }
  const widgetId = ts.render(mount, {
    sitekey: turnstileSiteKey.value,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    action: 'login',
    callback: () => {
      turnstileStatus.value = 'verified'
      doLogin().catch(() => {})
    },
    'error-callback': () => {
      resetTurnstile()
      toast.error('人机验证失败，请重试')
    },
    'expired-callback': () => {
      resetTurnstile()
      toast.error('验证已过期，请重新验证')
    },
  })
  turnstileWidgetId.value = String(widgetId)
}

function resetTurnstile() {
  const ts = window.turnstile
  if (turnstileWidgetId.value && ts) {
    ts.reset(turnstileWidgetId.value)
  }
  turnstileWidgetId.value = null
  turnstileStatus.value = 'idle'
}

async function doLogin() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const ts = window.turnstile
    const token =
      loginTurnstileEnabled.value && turnstileWidgetId.value && ts
        ? (ts.getResponse(turnstileWidgetId.value) ?? '')
        : ''
    await auth.login(username.value.trim(), password.value, token)
    ui.closeLogin()
    toast.success('登录成功')
  } catch (err) {
    resetTurnstile()
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (loginTurnstileEnabled.value && turnstileStatus.value !== 'verified') {
    turnstileStatus.value = 'pending'
    await renderTurnstile()
    return
  }
  await doLogin()
}

onMounted(() => {
  loadConfig().catch(() => {})
})

onBeforeUnmount(() => {
  const ts = window.turnstile
  if (turnstileWidgetId.value && ts) {
    ts.remove(turnstileWidgetId.value)
  }
})
</script>

<template>
  <BaseModal @close="ui.closeLogin()">
    <h2 class="text-lg font-bold">登录</h2>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">登录后即可发布说说</p>

    <form class="mt-4 flex flex-col gap-3" @submit.prevent="submit">
      <input
        v-model="username"
        type="text"
        class="input"
        placeholder="用户名"
        autocomplete="username"
      />
      <input
        v-model="password"
        type="password"
        class="input"
        placeholder="密码"
        autocomplete="current-password"
      />
      <div
        v-if="loginTurnstileEnabled && turnstileStatus === 'pending'"
        ref="turnstileMount"
        class="flex min-h-16 items-center justify-center"
      />
      <p v-if="loginTurnstileEnabled && turnstileStatus === 'pending'" class="text-xs text-gray-400">
        请先完成人机验证
      </p>
      <p v-if="error" class="text-sm text-rose-500">{{ error }}</p>
      <button class="btn-primary w-full justify-center" type="submit" :disabled="loading">
        <span v-if="loading" class="icon-[ph--spinner] animate-spin" />{{ loading ? '登录中…' : '登录' }}
      </button>
    </form>
  </BaseModal>
</template>
