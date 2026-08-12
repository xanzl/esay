interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown> | FormData | undefined
  query?: Record<string, string | number | undefined | null>
  headers?: Record<string, string>
  /** 是否携带认证头，默认携带 */
  auth?: boolean
}

/** 统一 API 请求封装：自动携带 JWT，401 时自动退出登录 */
export function useApi() {
  const auth = useAuthStore()

  return async function api<T = unknown>(path: string, options: ApiOptions = {}) {
    const headers: Record<string, string> = { ...(options.headers ?? {}) }
    if (options.auth !== false && auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }
    try {
      return await $fetch<T>(path, { ...options, headers })
    } catch (error) {
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 401) auth.logout()
      throw error
    }
  }
}
