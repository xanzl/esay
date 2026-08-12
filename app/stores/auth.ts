import type { FetchOptions } from 'ofetch'

const TOKEN_KEY = 'moment-token'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null as User | null,
  }),

  getters: {
    loggedIn: (state) => !!state.token,
  },

  actions: {
    init() {
      if (import.meta.client) {
        const token = localStorage.getItem(TOKEN_KEY)
        if (token) this.token = token
      }
    },

    /** 保证用户信息已加载（登录状态未知时调用；自动先恢复本地 token） */
    async ensure() {
      this.init()
      if (!this.token) return
      if (!this.user) {
        try {
          await this.fetchMe()
        } catch {
          this.logout()
        }
      }
    },

    async fetchMe() {
      try {
        const { user } = await $fetch<{ user: User | null }>('/api/auth/me', {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        })
        this.user = user
        if (!user) this.logout()
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401) this.logout()
        throw error
      }
    },

    async login(username: string, password: string, turnstileToken = '') {
      const { token, user } = await $fetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { username, password, turnstile_token: turnstileToken },
      })
      this.token = token
      this.user = user
      if (import.meta.client) localStorage.setItem(TOKEN_KEY, token)
    },

    async updateMe(payload: Record<string, unknown>) {
      const { user } = await $fetch<{ user: User }>('/api/auth/me', {
        method: 'PUT',
        body: payload,
        headers: { Authorization: `Bearer ${this.token}` },
      })
      this.user = user
    },

    logout() {
      this.token = ''
      this.user = null
      if (import.meta.client) localStorage.removeItem(TOKEN_KEY)
    },
  },
})
