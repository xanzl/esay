<script setup lang="ts">
const auth = useAuthStore()
const posts = usePostsStore()
const ui = useUiStore()
const toast = useToast()
const api = useApi()
const { toggle: toggleTheme, theme } = useTheme()

const sentinel = ref<HTMLElement | null>(null)
const setupNeeded = ref<boolean | null>(null)
const dbState = ref<'checking' | 'ok' | 'fail'>('checking')
const dbHealth = ref<DbHealth | null>(null)

type GridItem = { id: string | number; kind?: string } & Record<string, unknown>

/** 瀑布流项：站长卡片固定在首列顶部，登录时追加发布框，其后为说说 */
const gridItems = computed<GridItem[]>(() => {
  const pinned: GridItem[] = [{ id: '__owner__', kind: 'owner' }]
  if (auth.loggedIn) pinned.push({ id: '__publish__', kind: 'publish' })
  return [...pinned, ...posts.items]
})
const pinnedCount = computed(() => 1 + (auth.loggedIn ? 1 : 0))

async function checkDb() {
  dbState.value = 'checking'
  try {
    const health = await api<DbHealth>('/api/setup/health', { auth: false })
    dbHealth.value = health
    dbState.value = health.dbConnected ? 'ok' : 'fail'
  } catch {
    dbHealth.value = {
      dbConnected: false,
      dbType: 'd1',
      reason: 'connect_error',
      message: '无法连接服务端，请检查部署状态',
    }
    dbState.value = 'fail'
  }
}

async function checkStatus() {
  try {
    const { initialized } = await api<{ initialized: boolean }>('/api/setup/status')
    setupNeeded.value = !initialized && !auth.token
    if (initialized) {
      posts.loadInitial().catch((error) => toast.error(getErrorMessage(error)))
    }
  } catch (error) {
    setupNeeded.value = false
    toast.error(getErrorMessage(error))
  }
}

onMounted(async () => {
  auth.init()
  await auth.fetchMe().catch(() => {})
  await checkDb()
  if (dbState.value === 'ok') await checkStatus()
})

useInfiniteScroll(sentinel, () => {
  posts.loadMore().catch(() => {})
})

async function handleDelete(post: Post) {
  if (!window.confirm('确定删除这条说说吗？')) return
  try {
    await api(`/api/posts/${post.id}`, { method: 'DELETE' })
    posts.removePost(post.id)
    toast.success('已删除')
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

async function handleLike(post: Post) {
  try {
    const { liked, count } = await api<{ liked: boolean; count: number }>(
      `/api/posts/${post.id}/like`,
      { method: 'POST' },
    )
    posts.setLike(post.id, liked, count)
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

function handleSetupDone() {
  // 初始化成功后直接切换到主页（信任 init 返回的登录态，不重新请求状态）
  setupNeeded.value = false
  posts.loadInitial().catch((error) => toast.error(getErrorMessage(error)))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 瀑布流高度估算（实际高度由 MasonryGrid 内 ResizeObserver 实测修正）
function estimatePostHeight(item: GridItem) {
  if (item.kind === 'owner') return 250
  if (item.kind === 'publish') return 210
  const post = item as unknown as Post
  let h = 40 // 卡片内边距 p-5
  const text = post.content ?? ''
  const lines = Math.ceil(text.length / 22) * 1.15
  h += lines * 24 + 12 // markdown 内容 + 与图片间的 gap
  const n = post.images?.length ?? 0
  if (n) {
    const rows = n === 1 ? 1 : Math.ceil(n / (n <= 4 ? 2 : 3))
    h += rows * (n === 1 ? 240 : 164) + 8
  }
  if (post.tags?.length) h += 24
  return h + 40 // 底部时间条 + 顶部 gap
}
</script>

<template>
  <div class="mx-auto w-full max-w-screen-2xl px-3 pb-16 pt-2">
    <button
      v-if="dbState !== 'ok' || setupNeeded"
      type="button"
      class="fixed right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:bg-gray-800"
      :aria-label="'切换亮暗模式'"
      @click="toggleTheme"
    >
      <span
        class="text-lg"
        :class="theme === 'dark' ? 'icon-[material-symbols--light-mode-outline-rounded]' : 'icon-[material-symbols--dark-mode-outline-rounded]'"
      />
    </button>

    <template v-if="dbState === 'checking'">
      <div class="py-24 text-center text-gray-400">
        <span class="icon-[ph--spinner] mx-auto mb-3 block animate-spin text-3xl" />
        <p>正在检查数据库连接…</p>
      </div>
    </template>

    <template v-else-if="dbState === 'fail'">
      <div class="py-10">
        <DbSetupGuide :health="dbHealth" @retry="checkDb" />
      </div>
    </template>

    <template v-else-if="setupNeeded">
      <div class="py-10">
        <SetupForm @done="handleSetupDone" />
      </div>
    </template>

    <template v-else>
      <div
        v-if="posts.loading && !posts.items.length"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div v-for="i in 8" :key="i" class="card animate-pulse p-5">
          <div class="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div class="mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="mt-4 aspect-square rounded-xl bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      <MasonryGrid
        v-else-if="gridItems.length"
        :items="gridItems"
        :estimate="estimatePostHeight"
        :pinned="pinnedCount"
      >
        <template #default="{ item }">
          <SiteOwnerCard v-if="item.kind === 'owner'" compact />
          <PublishBox v-else-if="item.kind === 'publish'" />
          <PostCard
            v-else
            :post="item as Post"
            @edit="ui.openEditor(item as Post)"
            @delete="handleDelete"
            @like="handleLike"
          />
        </template>
      </MasonryGrid>

      <div
        v-if="posts.initialized && !posts.loading && !posts.items.length"
        class="py-20 text-center text-gray-400"
      >
        <span class="icon-[ph--package] mx-auto mb-3 block text-5xl" />
        <p>还没有说说，快去发布第一条吧</p>
      </div>

      <div ref="sentinel" class="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <span
          v-if="posts.loading && posts.items.length"
          class="icon-[ph--spinner] animate-spin text-xl"
        />
        <span v-else-if="posts.hasMore">向下滚动加载更多</span>
        <span v-else-if="posts.initialized && posts.items.length">已经到底啦</span>
      </div>
    </template>
  </div>
</template>