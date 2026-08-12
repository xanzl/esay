<script setup lang="ts">
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const auth = useAuthStore()
const ui = useUiStore()
const api = useApi()
const { theme, toggle } = useTheme()

const siteInfo = ref<SiteInfo | null>(null)

const displayName = computed(() => {
  const user = auth.user
  const site = siteInfo.value
  return user?.nickname || user?.username || site?.nickname || site?.username || '站长'
})
const avatarUrl = computed(() => auth.user?.avatar_url || siteInfo.value?.avatar_url || null)
const bio = computed(() => auth.user?.bio ?? siteInfo.value?.bio ?? null)

async function loadSiteInfo() {
  if (auth.loggedIn) return
  try {
    siteInfo.value = await api<SiteInfo | null>('/api/public/site', { auth: false })
  } catch {
    siteInfo.value = null
  }
}

onMounted(() => loadSiteInfo())
watch(
  () => auth.loggedIn,
  (loggedIn: boolean) => {
    if (!loggedIn) loadSiteInfo()
  },
)
</script>

<template>
  <section class="card relative" :class="compact ? 'p-4' : 'p-6'">
    <button
      class="absolute flex items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      :class="compact ? 'right-2 top-2 h-8 w-8' : 'right-3 top-3 h-9 w-9'"
      :aria-label="theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'"
      @click="toggle"
    >
      <span
        :class="theme === 'dark' ? 'icon-[material-symbols--light-mode-outline-rounded]' : 'icon-[material-symbols--dark-mode-outline-rounded]'"
        class="text-lg"
      />
    </button>

    <div class="flex flex-col items-center justify-center text-center">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        alt="站长头像"
        class="rounded-full border-2 border-white object-cover shadow-md dark:border-gray-700"
        :class="compact ? 'h-14 w-14' : 'h-20 w-20'"
      />
      <div
        v-else
        class="flex items-center justify-center rounded-full bg-indigo-500 font-bold text-white shadow-md"
        :class="compact ? 'h-14 w-14 text-lg' : 'h-20 w-20 text-2xl'"
      >
        {{ displayName.slice(0, 1) }}
      </div>

      <h1 class="font-bold" :class="compact ? 'mt-2 text-base' : 'mt-3 text-xl'">
        {{ displayName }}
      </h1>
      <p
        v-if="bio"
        class="mt-1 text-sm text-gray-500 dark:text-gray-400"
        :class="compact ? 'line-clamp-2' : 'max-w-md'"
      >
        {{ bio }}
      </p>

      <div class="flex items-center justify-center gap-2" :class="compact ? 'mt-3' : 'mt-4'">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="搜索"
          @click="ui.openSearch()"
        >
          <span class="icon-[iconamoon--search] text-lg" />
        </button>
        <NuxtLink
          to="/hub"
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="Hub 探索"
        >
          <span class="icon-[ph--globe-hemisphere-east] text-lg" />
        </NuxtLink>
        <button
          v-if="!auth.loggedIn"
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="登录"
          @click="ui.openLogin()"
        >
          <span class="icon-[memory--login] text-lg" />
        </button>
        <NuxtLink
          v-else
          to="/settings"
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="设置"
        >
          <span class="icon-[ph--gear-six] text-lg" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
