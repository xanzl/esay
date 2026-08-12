<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()
const toast = useToast()
const api = useApi()

const post = ref<Post | null>(null)
const site = ref<SiteInfo | null>(null)
const loading = ref(true)
const error = ref('')

const postId = computed(() => String(route.params.id ?? ''))
const nickname = computed(() => site.value?.nickname || site.value?.username || '站长')
const username = computed(() => site.value?.username || '')

async function loadSite() {
  try {
    site.value = await api<SiteInfo | null>('/api/public/site', { auth: false })
  } catch {
    site.value = null
  }
}

async function load() {
  if (!postId.value) {
    error.value = '缺少说说 ID'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { post: postData } = await api<{ post: Post }>(`/api/public/posts/${postId.value}`, {
      auth: false,
    })
    post.value = postData
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) error.value = '说说不存在或已删除'
    else error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

/** 编辑保存成功后静默刷新当前说说（不闪加载态） */
async function refreshPost() {
  if (!postId.value) return
  try {
    const { post: postData } = await api<{ post: Post }>(`/api/public/posts/${postId.value}`, {
      auth: false,
    })
    post.value = postData
  } catch {
    /* 刷新失败保留当前数据 */
  }
}

watch(
  () => ui.editorSavedAt,
  () => {
    if (post.value) refreshPost()
  },
)

async function handleLike() {
  if (!post.value) return
  try {
    const { liked, count } = await api<{ liked: boolean; count: number }>(
      `/api/posts/${post.value.id}/like`,
      { method: 'POST' },
    )
    post.value.like_count = count
    post.value.liked = liked
  } catch (err) {
    toast.error(getErrorMessage(err))
  }
}

function goBack() {
  if (window.history.length > 2) window.history.back()
  else navigateTo('/')
}

async function handleEdit() {
  if (!post.value) return
  const ui = useUiStore()
  ui.openEditor(post.value)
}

async function handleDelete() {
  if (!post.value) return
  if (!window.confirm('确定删除这条说说吗？')) return
  try {
    await api(`/api/posts/${post.value.id}`, { method: 'DELETE' })
    toast.success('已删除')
    navigateTo('/')
  } catch (err) {
    toast.error(getErrorMessage(err))
  }
}

onMounted(() => {
  auth.ensure().catch(() => {})
  loadSite()
  load()
})
</script>

<template>
  <div class="mx-auto w-full max-w-sm px-4 pb-16 pt-4">
    <div v-if="loading" class="py-24 text-center text-gray-400">
      <span class="icon-[ph--spinner] animate-spin text-2xl" />
    </div>

    <div v-else-if="error" class="card py-14 text-center text-gray-500">
      <span class="icon-[ph--magnifying-glass-minus] mx-auto mb-3 block text-4xl" />
      <p>{{ error }}</p>
      <button class="btn mt-4" @click="navigateTo('/')">返回时间线</button>
    </div>

    <template v-else-if="post">
      <article class="w-full">
        <header class="flex items-center gap-2 pb-3 [background-image:linear-gradient(to_right,currentColor_0,currentColor_5px,transparent_5px,transparent_8px)] [background-size:8px_1px] [background-repeat:repeat-x] [background-position:left_bottom] text-gray-200 dark:text-gray-700">
          <img
            v-if="site?.avatar_url"
            :src="site.avatar_url"
            alt="站长头像"
            class="h-10 w-10 rounded-full border border-gray-200 object-cover dark:border-gray-700"
          />
          <span
            v-else
            class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white"
          >
            {{ nickname.slice(0, 1) }}
          </span>
          <div class="flex min-w-0 flex-col">
            <div class="flex items-center gap-1">
              <h2 class="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{{ nickname }}</h2>
              <span class="icon-[material-symbols--verified-rounded] shrink-0 text-sky-500" />
            </div>
            <span class="truncate text-xs text-gray-400">@ {{ username }}</span>
          </div>
          <button
            type="button"
            class="ml-auto shrink-0 cursor-pointer rounded-full border border-gray-200 px-4 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="goBack"
          >
            返回
          </button>
        </header>

        <section class="py-6">
          <Markdown v-if="post.content" :content="post.content" class="mb-4" />
          <PostImageGrid v-if="post.images.length" :images="post.images" />
          <ExtensionCard v-if="post.extension" :extension="post.extension" class="mt-4 block" />
          <div v-if="post.tags?.length" class="mt-4 flex flex-wrap gap-1.5">
            <span
              v-for="tag in post.tags"
              :key="tag.id"
              class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              #{{ tag.name }}
            </span>
          </div>
        </section>

        <div class="flex items-center gap-1.5 pb-2.5 text-xs text-gray-400">
          <span v-if="post.private" class="icon-[ph--lock] text-sm text-amber-500" title="私密" />
          <span class="icon-[ph--calendar-blank] text-sm" />
          <time :datetime="formatDate(post.created_at)">{{ formatDate(post.created_at) }}</time>
          <span v-if="post.updated_at !== post.created_at">· 已编辑</span>
          <div class="ml-auto flex items-center gap-1">
            <button
              type="button"
              class="flex h-6 items-center gap-1 rounded-full px-1 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="post.liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'"
              :title="post.liked ? '取消点赞' : '点赞'"
              :aria-label="post.liked ? '取消点赞' : '点赞'"
              @click="handleLike"
            >
              <span class="icon-[lucide--thumbs-up] text-base" />
              <span v-if="post.like_count > 0">{{ post.like_count }}</span>
            </button>
            <div v-if="auth.loggedIn" class="flex items-center gap-1">
              <button class="icon-btn" title="编辑" @click="handleEdit">
                <span class="icon-[iconamoon--edit] text-base" />
              </button>
              <button class="icon-btn text-rose-500" title="删除" @click="handleDelete">
                <span class="icon-[ph--trash] text-base" />
              </button>
            </div>
          </div>
        </div>

        <div
          class="my-0.5 h-px [background-image:linear-gradient(to_right,currentColor_0,currentColor_5px,transparent_5px,transparent_8px)] [background-size:8px_1px] [background-repeat:repeat-x] [background-position:left_center] text-gray-200 dark:text-gray-700"
        />

        <CommentSection :post-id="post.id" />
      </article>
    </template>
  </div>
</template>