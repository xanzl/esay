<script setup lang="ts">
const props = defineProps<{ postId: string }>()

const auth = useAuthStore()
const toast = useToast()
const api = useApi()

const config = ref<PublicConfig>({
  comments_enabled: true,
  require_approval: false,
  turnstile_site_key: '',
  turnstile_enabled: false,
  login_turnstile_enabled: false,
})
const comments = ref<PostComment[]>([])
const loaded = ref(false)
const commentsLoading = ref(false)

const nickname = ref('')
const email = ref('')
const website = ref('')
const content = ref('')
const submitting = ref(false)
const replyTarget = ref<PostComment | null>(null)
const formExpanded = ref(false)

const PROFILE_KEY = 'moment-comment-profile'

function loadProfile() {
  // 站长已登录：自动填充本人信息（昵称/邮箱/主页），无需手动填写
  if (auth.loggedIn && auth.user) {
    nickname.value = auth.user.nickname ?? auth.user.username
    email.value = auth.user.email ?? ''
    website.value = auth.user.website ?? ''
    return
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return
    const p = JSON.parse(raw) as { nickname?: string; email?: string; website?: string }
    if (typeof p.nickname === 'string') nickname.value = p.nickname
    if (typeof p.email === 'string') email.value = p.email
    if (typeof p.website === 'string') website.value = p.website
  } catch {
    /* ignore */
  }
}

/** 渲染兜底：仅放行 http/https 链接，其余一律去掉可点击行为 */
function safeWebsite(raw: string): string {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return raw
  } catch {
    /* ignore */
  }
  return 'about:blank'
}

function saveProfile() {
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ nickname: nickname.value, email: email.value, website: website.value }),
    )
  } catch {
    /* ignore */
  }
}

const turnstileWidgetId = ref<string | null>(null)
const turnstileStatus = ref<'idle' | 'pending' | 'verified'>('idle')
const turnstileMount = ref<HTMLElement | null>(null)
let turnstileLoaded = false

const topLevelComments = computed(() => comments.value.filter((c: PostComment) => !c.parent_id))
const repliesOf = (id: string) => comments.value.filter((c: PostComment) => c.parent_id === id)
const numberOf = (comment: PostComment) =>
  topLevelComments.value.findIndex((c: PostComment) => c.id === comment.id) + 1
const contentLength = computed(() => content.value.length)
const contentTooLong = computed(() => contentLength.value > 1000)
const canSubmit = computed(() => {
  if (submitting.value || contentTooLong.value) return false
  if (!nickname.value.trim() || !content.value.trim()) return false
  return true
})

const statusMeta = (status: PostComment['status']) => {
  if (status === 'pending') return { label: '待审核', cls: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' }
  if (status === 'rejected') return { label: '已驳回', cls: 'bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400' }
  return null
}

function seedColor(id: string) {
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  let n = 0
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 997
  return colors[n % colors.length]
}

/** WeAvatar 头像地址；无邮箱时为空，由调用方回退到彩色首字头像 */
function avatarUrl(hash: string): string {
  if (!hash) return ''
  return `https://weavatar.com/avatar/${hash}?s=96&d=404`
}

const avatarFailed = ref<Set<string>>(new Set())

function markAvatarFailed(id: string) {
  avatarFailed.value = new Set(avatarFailed.value).add(id)
}

function avatarBlock(comment: PostComment) {
  const url = avatarUrl(comment.avatar)
  if (!url || avatarFailed.value.has(comment.id)) {
    return null
  }
  return {
    url,
    initial: (comment.nickname || '匿').slice(0, 1),
    color: seedColor(comment.id),
  }
}

async function load() {
  commentsLoading.value = true
  try {
    const headers: Record<string, string> = {}
    if (auth.loggedIn) headers.authorization = `Bearer ${auth.token}`
    const { comments: list } = await $fetch<{ comments: PostComment[] }>(
      `/api/public/posts/${props.postId}/comments`,
      { headers },
    )
    comments.value = list
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    commentsLoading.value = false
    loaded.value = true
  }
}

async function loadConfig() {
  try {
    config.value = await api<PublicConfig>('/api/public/config', { auth: false })
  } catch {
    config.value = {
      comments_enabled: true,
      require_approval: false,
      turnstile_site_key: '',
      turnstile_enabled: false,
      login_turnstile_enabled: false,
    }
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
  if (!config.value.turnstile_enabled || !config.value.turnstile_site_key) return
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
    sitekey: config.value.turnstile_site_key,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    action: 'comment',
    callback: () => {
      turnstileStatus.value = 'verified'
      sendComment().catch(() => {})
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

/** 提交：需要验证码时先弹出 Turnstile，通过后自动发送 */
async function submit() {
  if (!nickname.value.trim()) {
    toast.error('请填写昵称')
    return
  }
  const text = content.value.trim()
  if (!text) {
    toast.error('请填写评论内容')
    return
  }
  let site = website.value.trim()
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`
  website.value = site
  saveProfile()
  if (config.value.turnstile_enabled && config.value.turnstile_site_key && turnstileStatus.value !== 'verified') {
    turnstileStatus.value = 'pending'
    await renderTurnstile()
    return
  }
  await sendComment()
}

async function sendComment() {
  const ts = window.turnstile
  const turnstileToken =
    config.value.turnstile_enabled && config.value.turnstile_site_key && turnstileWidgetId.value && ts
      ? (ts.getResponse(turnstileWidgetId.value) ?? '')
      : ''
  submitting.value = true
  try {
    const { comment } = await api<{ comment: PostComment }>(
      `/api/posts/${props.postId}/comments`,
      {
        method: 'POST',
        body: {
          nickname: nickname.value.trim(),
          email: email.value.trim(),
          website: website.value.trim(),
          content: content.value.trim(),
          parent_id: replyTarget.value?.id ?? '',
          turnstile_token: turnstileToken,
        },
      },
    )
    comments.value.push(comment)
    content.value = ''
    replyTarget.value = null
    resetTurnstile()
    if (config.value.require_approval) toast.success('评论已提交，等待审核通过后展示')
    else toast.success('评论成功')
  } catch (error) {
    const err = error as { response?: { status?: number } }
    if (err.response?.status === 403) resetTurnstile()
    toast.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function setStatus(comment: PostComment, status: PostComment['status']) {
  try {
    const { comment: updated } = await api<{ comment: PostComment }>(
      `/api/comments/${comment.id}`,
      { method: 'PUT', body: { status } },
    )
    const index = comments.value.findIndex((c: PostComment) => c.id === updated.id)
    if (index !== -1) comments.value[index] = updated
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

async function remove(comment: PostComment) {
  if (!window.confirm(`确定删除「${comment.nickname}」的这条评论吗？`)) return
  try {
    await api(`/api/comments/${comment.id}`, { method: 'DELETE' })
    comments.value = comments.value.filter((c: PostComment) => c.id !== comment.id)
    toast.success('已删除')
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

function startReply(comment: PostComment) {
  const top = comment.parent_id
    ? comments.value.find((c: PostComment) => c.id === comment.parent_id)
    : comment
  replyTarget.value = top ?? comment
  formExpanded.value = true
}

function cancelReply() {
  replyTarget.value = null
}

watch(
  () => auth.loggedIn,
  () => load(),
)

onMounted(async () => {
  loadProfile()
  await loadConfig()
  await Promise.all([load()])
})
</script>

<template>
  <section id="comments" class="w-full">
    <div
      v-if="!config.comments_enabled"
      class="mb-3 rounded-lg border border-gray-200 p-3 text-center text-sm text-gray-400 dark:border-gray-700"
    >
      评论功能已关闭
    </div>

    <template v-else>
      <div class="comment-list-board mb-4">
        <div class="mb-3 mt-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ring-gray-200 text-gray-600 transition-colors hover:bg-gray-100 dark:ring-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            :aria-expanded="formExpanded"
            @click="formExpanded = !formExpanded"
          >
            <span class="icon-[ph--chat-circle-text] text-base" />
            {{ formExpanded ? '收起评论' : '发表评论' }}
          </button>
          <span class="text-sm text-gray-400">{{ comments.length }} 条评论</span>
        </div>

        <form v-if="formExpanded" class="comment-form-panel mb-3" @submit.prevent="submit">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">发表评论</h3>
              <span
                class="icon-[ph--markdown-logo] text-gray-400"
                title="支持 Markdown 语法"
              />
            </div>
            <span class="flex items-center gap-1 text-xs text-gray-400">
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="nickname && content ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'"
              />
              {{ nickname && content ? '可以提交' : '待完善' }}
            </span>
          </div>

          <div
            v-if="replyTarget"
            class="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
          >
            <span class="truncate">
              正在回复 @{{ replyTarget.nickname }}：{{ replyTarget.content.slice(0, 20) }}
            </span>
            <button type="button" class="ml-auto shrink-0" title="取消回复" @click="cancelReply">
              <span class="icon-[ph--x] text-sm" />
            </button>
          </div>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <input
              v-model.trim="nickname"
              type="text"
              class="input"
              maxlength="50"
              placeholder="昵称 *"
              autocomplete="nickname"
            />
            <input
              v-model.trim="email"
              type="email"
              class="input"
              maxlength="255"
              placeholder="邮箱（可选）"
              autocomplete="email"
            />
            <input
              v-model.trim="website"
              type="text"
              class="input col-span-2"
              maxlength="255"
              placeholder="网址（可选）"
              autocomplete="url"
            />
          </div>

          <textarea
            v-model="content"
            rows="4"
            class="input mt-2 w-full resize-none"
            maxlength="1000"
            placeholder="写下你的评论，支持 Markdown…"
          />

          <div
            v-if="config.turnstile_enabled && config.turnstile_site_key && turnstileStatus === 'pending'"
            ref="turnstileMount"
            class="mt-2"
          />
          <p
            v-if="config.turnstile_enabled && config.turnstile_site_key && turnstileStatus === 'pending'"
            class="mt-1 text-xs text-gray-400"
          >
            请完成人机验证，通过后自动提交
          </p>

          <div class="mt-2 flex items-center justify-between">
            <span
              class="text-xs"
              :class="contentTooLong ? 'text-red-500' : 'text-gray-400'"
            >
              {{ contentLength }}/1000
            </span>
            <button
              type="submit"
              class="btn-primary !rounded-full"
              :disabled="!canSubmit"
            >
              <span v-if="submitting" class="icon-[ph--spinner] animate-spin" />
              <span v-else class="icon-[ph--paper-plane-right] mr-1" />
              {{ submitting ? '提交中…' : '发表评论' }}
            </button>
          </div>
        </form>

        <div v-if="commentsLoading && !loaded" class="py-6 text-center text-gray-400">
          <span class="icon-[ph--spinner] animate-spin text-xl" />
        </div>

        <div v-else-if="topLevelComments.length" class="flex flex-col">
          <div
            v-for="item in topLevelComments"
            :key="item.id"
            class="comment-card border-t border-gray-100 py-3 first:border-t-0 dark:border-gray-800"
          >
            <div class="flex gap-3">
              <template v-if="avatarBlock(item)">
                <img
                  :src="avatarBlock(item)!.url"
                  :alt="item.nickname"
                  loading="lazy"
                  class="h-9 w-9 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-700"
                  @error="markAvatarFailed(item.id)"
                />
              </template>
              <span
                v-else
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                :style="{ backgroundColor: seedColor(item.id) }"
              >
                {{ (item.nickname || '匿').slice(0, 1) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                  <span class="text-gray-300 dark:text-gray-600">#{{ numberOf(item) }}</span>
                  <a
                    v-if="item.website"
                    :href="safeWebsite(item.website)"
                    target="_blank"
                    rel="noopener nofollow"
                    class="font-semibold text-indigo-500 hover:underline"
                  >
                    {{ item.nickname }}
                  </a>
                  <span v-else class="font-semibold text-gray-700 dark:text-gray-200">{{ item.nickname }}</span>
                  <time :datetime="formatDate(item.created_at)">{{ formatDate(item.created_at) }}</time>
                  <span
                    v-if="statusMeta(item.status)"
                    class="rounded-full px-1.5 py-0.5 text-[10px]"
                    :class="statusMeta(item.status)!.cls"
                  >
                    {{ statusMeta(item.status)!.label }}
                  </span>
                  <button
                    type="button"
                    class="comment-reply-btn cursor-pointer text-indigo-500 hover:underline"
                    @click="startReply(item)"
                  >
                    回复
                  </button>
                  <template v-if="auth.loggedIn">
                    <button
                      v-if="item.status !== 'approved'"
                      type="button"
                      class="cursor-pointer text-emerald-500 hover:underline"
                      @click="setStatus(item, 'approved')"
                    >
                      通过
                    </button>
                    <button
                      v-if="item.status !== 'rejected'"
                      type="button"
                      class="cursor-pointer text-amber-500 hover:underline"
                      @click="setStatus(item, 'rejected')"
                    >
                      驳回
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer text-red-400 hover:text-red-500"
                      title="删除评论"
                      @click="remove(item)"
                    >
                      <span class="icon-[ph--trash] text-sm" />
                    </button>
                  </template>
                </div>

                <div class="mt-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <Markdown :content="item.content" />
                </div>

                <div
                  v-for="reply in repliesOf(item.id)"
                  :key="reply.id"
                  class="mt-2 flex gap-2 rounded-xl rounded-tl-sm bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
                >
                  <template v-if="avatarBlock(reply)">
                    <img
                      :src="avatarBlock(reply)!.url"
                      :alt="reply.nickname"
                      loading="lazy"
                      class="h-7 w-7 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-700"
                      @error="markAvatarFailed(reply.id)"
                    />
                  </template>
                  <span
                    v-else
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    :style="{ backgroundColor: seedColor(reply.id) }"
                  >
                    {{ (reply.nickname || '匿').slice(0, 1) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                    <a
                      v-if="reply.website"
                      :href="reply.website"
                      target="_blank"
                      rel="noopener nofollow"
                      class="font-semibold text-indigo-500 hover:underline"
                    >
                      {{ reply.nickname }}
                    </a>
                    <span v-else class="font-semibold text-gray-700 dark:text-gray-200">{{ reply.nickname }}</span>
                    <span v-if="reply.nickname !== item.nickname">回复 @{{ item.nickname }}</span>
                    <time :datetime="formatDate(reply.created_at)">{{ formatDate(reply.created_at) }}</time>
                    <span
                      v-if="statusMeta(reply.status)"
                      class="rounded-full px-1.5 py-0.5 text-[10px]"
                      :class="statusMeta(reply.status)!.cls"
                    >
                      {{ statusMeta(reply.status)!.label }}
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer text-indigo-500 hover:underline"
                      @click="startReply(reply)"
                    >
                      回复
                    </button>
                    <template v-if="auth.loggedIn">
                      <button
                        v-if="reply.status !== 'approved'"
                        type="button"
                        class="cursor-pointer text-emerald-500 hover:underline"
                        @click="setStatus(reply, 'approved')"
                      >
                        通过
                      </button>
                      <button
                        v-if="reply.status !== 'rejected'"
                        type="button"
                        class="cursor-pointer text-amber-500 hover:underline"
                        @click="setStatus(reply, 'rejected')"
                      >
                        驳回
                      </button>
                      <button
                        type="button"
                        class="cursor-pointer text-red-400 hover:text-red-500"
                        title="删除评论"
                        @click="remove(reply)"
                      >
                        <span class="icon-[ph--trash] text-sm" />
                      </button>
                    </template>
                  </div>
                  <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    <Markdown :content="reply.content" />
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-else-if="loaded && !formExpanded" class="py-4 text-center text-xs text-gray-400">还没有评论，来抢沙发～</p>
      </div>
    </template>
  </section>
</template>