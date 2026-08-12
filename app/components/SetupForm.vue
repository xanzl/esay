<script setup lang="ts">
const auth = useAuthStore()
const toast = useToast()
const api = useApi()

const emit = defineEmits<{ done: [] }>()

const username = ref('')
const nickname = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')

function clearError() {
  error.value = ''
}

async function submit() {
  error.value = ''
  const name = username.value.trim()
  if (!name) {
    error.value = '请设置用户名'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    const { token, user } = await api<{ token: string; user: User }>('/api/setup/init', {
      method: 'POST',
      body: { username: name, nickname: nickname.value.trim(), password: password.value },
    })
    auth.token = token
    auth.user = user
    localStorage.setItem('moment-token', token)
    emit('done')
    toast.success('初始化完成，欢迎使用 esay')
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 409) {
      // 站点已被初始化：直接进入主页，引导用户登录
      emit('done')
      toast.error('站点已初始化，请直接登录')
      return
    }
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="card mx-auto w-full max-w-md p-6">
    <div class="mb-6 text-center">
      <span class="icon-[ph--sparkle] mx-auto mb-3 block text-4xl text-emerald-500" />
      <h1 class="text-xl font-bold">初始化 esay</h1>
      <p class="mt-1 text-sm text-gray-500">首次使用，请设置站点管理员账号</p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-semibold" for="setup-username">用户名</label>
        <input
          id="setup-username"
          v-model="username"
          type="text"
          class="input"
          maxlength="20"
          autocomplete="username"
          placeholder="登录用用户名"
          @input="clearError"
        >
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold" for="setup-nickname">昵称（可选）</label>
        <input
          id="setup-nickname"
          v-model="nickname"
          type="text"
          class="input"
          maxlength="20"
          placeholder="展示在主页的名字"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold" for="setup-password">密码</label>
        <input
          id="setup-password"
          v-model="password"
          type="password"
          class="input"
          autocomplete="new-password"
          placeholder="至少 6 位"
          @input="clearError"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold" for="setup-confirm">确认密码</label>
        <input
          id="setup-confirm"
          v-model="confirm"
          type="password"
          class="input"
          autocomplete="new-password"
          placeholder="再次输入密码"
          @input="clearError"
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <span v-if="loading" class="icon-[ph--spinner] animate-spin" />
        <span v-else class="icon-[ph--check] mr-1.5" />
        <template v-if="loading">正在初始化…</template>
        <template v-else>完成初始化</template>
      </button>
    </form>
  </section>
</template>