<script setup lang="ts">
const keyword = ref('')
const results = ref<Post[]>([])
const loading = ref(false)
const searched = ref(false)

const timeRanges = [
  { key: 'all', label: '全部时间' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
] as const

type TimeKey = (typeof timeRanges)[number]['key']
const timeKey = ref<TimeKey>('all')
const selectedTags = ref<string[]>([])
const allTags = ref<Array<{ id: string; name: string }>>([])
const tagsLoaded = ref(false)

const ui = useUiStore()
const api = useApi()
const toast = useToast()
const route = useRoute()

// 从搜索结果跳转到详情页等页面时自动关闭搜索弹窗
watch(
  () => route.fullPath,
  () => {
    if (ui.showSearch) ui.closeSearch()
  },
)


function sinceOf(key: TimeKey): number | undefined {
  if (key === 'all') return undefined
  const now = new Date()
  if (key === 'today') now.setHours(0, 0, 0, 0)
  if (key === 'week') {
    const day = now.getDay() || 7
    now.setDate(now.getDate() - day + 1)
    now.setHours(0, 0, 0, 0)
  }
  if (key === 'month') {
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
  }
  if (key === 'year') {
    now.setMonth(0, 1)
    now.setHours(0, 0, 0, 0)
  }
  return now.getTime()
}

async function loadTags() {
  if (tagsLoaded.value) return
  try {
    const { tags } = await api<{ tags: Array<{ id: string; name: string }> }>('/api/tags', {
      auth: false,
    })
    allTags.value = tags
    tagsLoaded.value = true
  } catch {
    /* ignore */
  }
}

function toggleTag(name: string) {
  if (selectedTags.value.includes(name)) {
    selectedTags.value = selectedTags.value.filter((n: string) => n !== name)
  } else {
    selectedTags.value = [...selectedTags.value, name]
  }
}

function clearTag(name: string) {
  selectedTags.value = selectedTags.value.filter((n: string) => n !== name)
}

function clearTime() {
  timeKey.value = 'all'
}

async function runSearch(query: string) {
  loading.value = true
  try {
    const since = sinceOf(timeKey.value)
    const { posts } = await api<{ posts: Post[] }>('/api/posts/search', {
      query: {
        q: query,
        since,
        ...(selectedTags.value.length ? { tag: selectedTags.value } : {}),
      },
    })
    results.value = posts
    searched.value = true
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  timeKey.value = 'all'
  selectedTags.value = []
  results.value = []
  searched.value = false
}

function searchNow() {
  runSearch(keyword.value.trim())
}

onMounted(() => {
  loadTags().catch(() => {})
})
</script>

<template>
  <BaseModal @close="ui.closeSearch()">
    <div class="relative mr-8">
      <span
        class="icon-[iconamoon--search] pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        v-model="keyword"
        type="text"
        class="input w-full pl-10 pr-9"
        placeholder="输入关键词搜索历史说说…"
        autofocus
      />
      <button
        v-if="keyword"
        type="button"
        class="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-500 transition hover:bg-gray-300 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        :aria-label="'清空输入'"
        title="清空输入"
        @click="keyword = ''"
      >
        <span class="icon-[ph--x] text-xs" />
      </button>
    </div>

    <div class="mt-4">
      <p class="mb-1.5 text-xs text-gray-400">时间范围</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="range in timeRanges"
          :key="range.key"
          class="rounded-full px-3 py-1 text-xs transition"
          :class="
            timeKey === range.key
              ? 'bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          "
          @click="timeKey = range.key"
        >
          {{ range.label }}
        </button>
      </div>
    </div>

    <div v-if="allTags.length" class="mt-3">
      <p class="mb-1.5 text-xs text-gray-400">标签</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tag in allTags"
          :key="tag.id"
          class="rounded-full px-2.5 py-1 text-xs transition"
          :class="
            selectedTags.includes(tag.name)
              ? 'bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          "
          @click="toggleTag(tag.name)"
        >
          #{{ tag.name }}
        </button>
      </div>
    </div>

    <div
      v-if="timeKey !== 'all' || selectedTags.length"
      class="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2.5 dark:border-gray-800"
    >
      <button
        v-if="timeKey !== 'all'"
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        @click="clearTime"
      >
        时间 · {{ timeRanges.find((r) => r.key === timeKey)?.label }}
        <span class="icon-[ph--x] text-xs" />
      </button>
      <button
        v-for="name in selectedTags"
        :key="name"
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        @click="clearTag(name)"
      >
        #{{ name }}
        <span class="icon-[ph--x] text-xs" />
      </button>
    </div>

    <div class="mt-3 flex justify-end gap-1.5">
      <button
        class="rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        :disabled="!keyword.trim() && timeKey === 'all' && !selectedTags.length"
        @click="clearSearch"
      >
        清空
      </button>
      <button
        class="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
        :disabled="loading"
        @click="searchNow"
      >
        搜索
      </button>
    </div>

    <div class="mt-4 max-h-96 overflow-y-auto pr-1">
      <div v-if="loading" class="flex justify-center py-10">
        <span class="icon-[ph--spinner] animate-spin text-2xl text-gray-400" />
      </div>
      <div v-else-if="results.length" class="flex flex-col gap-3">
        <PostCard v-for="post in results" :key="post.id" :post="post" :actions="false" />
      </div>
      <div v-else-if="searched" class="py-10 text-center text-gray-400">
        <span class="icon-[ph--package] mx-auto mb-3 block text-5xl" />
        <p>没有找到相关说说</p>
      </div>
    </div>
  </BaseModal>
</template>