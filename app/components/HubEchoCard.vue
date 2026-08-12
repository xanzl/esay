<script setup lang="ts">
const props = defineProps<{ echo: HubFeedEcho }>()

const toast = useToast()
const favCount = ref<number>(props.echo.fav_count)
const avatarFailed = ref(false)
const likedIds = ref<string[]>([])

const LIKE_LIST_KEY = `${props.echo.server_url}_liked_echo_ids`

watch(
  () => props.echo.fav_count,
  (next: number) => {
    favCount.value = next
  },
)

onMounted(() => {
  try {
    const raw = localStorage.getItem(LIKE_LIST_KEY)
    likedIds.value = raw ? JSON.parse(raw) : []
  } catch {
    likedIds.value = []
  }
})

function persistLiked() {
  try {
    localStorage.setItem(LIKE_LIST_KEY, JSON.stringify(likedIds.value))
  } catch {
    /* ignore */
  }
}

function seedColor(key: string) {
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  let n = 0
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) % 997
  return colors[n % colors.length]
}

function resolveFileUrl(file: { key: string; url?: string }): string {
  if (file.url) return file.url
  return `${props.echo.server_url}/${file.key.replace(/^\//, '')}`
}

async function handleLike() {
  if (likedIds.value.includes(props.echo.id)) return
  try {
    const res = await fetch(`${props.echo.server_url}/api/echo/like/${props.echo.id}`, {
      method: 'PUT',
      credentials: 'omit',
    })
    const data = (await res.json()) as { code: number }
    if (data.code === 1) {
      favCount.value += 1
      likedIds.value.push(props.echo.id)
      persistLiked()
    }
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const images = computed(() => props.echo.echo_files?.filter((f) => f.category === 'image') ?? [])
</script>

<template>
  <div class="card w-full !rounded-lg !p-3 sm:!px-3.5 sm:!py-3.5">
      <div class="mb-3 flex items-center gap-2">
        <div class="shrink-0">
          <img
            v-if="echo.logo && !avatarFailed"
            :src="echo.logo"
            alt=""
            loading="lazy"
            decoding="async"
            class="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-gray-700"
            @error="avatarFailed = true"
          />
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            :style="{ backgroundColor: seedColor(`${echo.server_url}-${echo.username}-${echo.id}`) }"
          >
            {{ (echo.server_name || 'H').slice(0, 1) }}
          </span>
        </div>
      <div class="flex min-w-0 flex-col">
        <div class="flex items-center gap-1">
          <h2 class="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
            <a :href="echo.server_url" target="_blank" rel="noopener noreferrer" class="hover:underline">
              {{ echo.server_name }}
            </a>
          </h2>
          <span class="icon-[material-symbols--verified-rounded] shrink-0 text-sky-500" />
        </div>
      </div>
    </div>

    <div class="py-2">
      <template v-if="echo.layout === 'grid' || echo.layout === 'horizontal' || echo.layout === 'stack'">
        <div class="mb-3">
          <Markdown v-if="echo.content" :content="echo.content" class="text-sm" />
        </div>
        <div v-if="images.length" class="grid grid-cols-2 gap-1.5">
          <a
            v-for="(file, i) in images"
            :key="file.id ?? `${echo.id}-${i}`"
            :href="resolveFileUrl(file)"
            target="_blank"
            rel="noopener noreferrer"
            class="block overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <img :src="resolveFileUrl(file)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </a>
        </div>
      </template>
      <template v-else>
        <div v-if="images.length" class="mb-3 grid grid-cols-2 gap-1.5">
          <a
            v-for="(file, i) in images"
            :key="file.id ?? `${echo.id}-${i}`"
            :href="resolveFileUrl(file)"
            target="_blank"
            rel="noopener noreferrer"
            class="block overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <img :src="resolveFileUrl(file)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </a>
        </div>
        <Markdown v-if="echo.content" :content="echo.content" class="text-sm" />
      </template>
    </div>

    <div class="flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <div class="flex min-w-0 flex-1 items-center overflow-hidden">
        <time class="truncate text-xs text-gray-400">{{ formatDate(echo.createdTs) }}</time>
        <span v-if="echo.tags?.[0]?.name" class="ml-1.5 hidden truncate text-xs text-gray-400 sm:block">
          #{{ echo.tags[0].name }}
        </span>
      </div>

        <div class="relative flex flex-none items-center justify-center gap-1">
          <button
            type="button"
            class="flex h-6 items-center gap-1 rounded-full px-1 transition hover:bg-gray-100 dark:hover:bg-gray-800"
            :class="likedIds.includes(echo.id) ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'"
            :title="likedIds.includes(echo.id) ? '取消点赞' : '点赞'"
            :aria-label="likedIds.includes(echo.id) ? '取消点赞' : '点赞'"
            @click="handleLike"
          >
            <span class="icon-[lucide--thumbs-up] text-base" />
            <span v-if="favCount > 0">{{ favCount > 99 ? '99+' : favCount }}</span>
          </button>
          <a
            :href="`${echo.server_url}/echo/${echo.id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-indigo-500 dark:hover:bg-gray-800"
            title="查看原文"
          >
            <span class="icon-[mdi--arrow-right-bold-outline] text-lg" />
          </a>
        </div>
    </div>
  </div>
</template>