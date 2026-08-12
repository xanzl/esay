<script setup lang="ts">
import LocationPicker from '~/components/LocationPicker.vue'

const content = ref('')
const images = ref<string[]>([])
const tagNames = ref<string[]>([])
const extension = ref<PostExtension | null>(null)
const submitting = ref(false)
const moreOpen = ref(false)
const moreRef = ref<HTMLElement | null>(null)
const publishMenuOpen = ref(false)
const publishRef = ref<HTMLElement | null>(null)
const extInput = ref('')
const extMusicServer = ref('netease')
const extLat = ref('')
const extLng = ref('')
const extPicking = ref<string | null>(null)
const extAdding = ref(false)
const extInputRef = ref<HTMLInputElement | null>(null)
const locPickerRef = ref<InstanceType<typeof LocationPicker> | null>(null)
const locValue = computed({
  get: () => ({
    latitude: Number(extLat.value) || 0,
    longitude: Number(extLng.value) || 0,
  }),
  set: (value: { latitude: number; longitude: number }) => {
    extLat.value = String(value.latitude)
    extLng.value = String(value.longitude)
  },
})

// 手动输入经纬度时同步地图标记
watch([extLat, extLng], () => {
  locPickerRef.value?.setPosition(Number(extLat.value) || 0, Number(extLng.value) || 0)
})

const api = useApi()
const posts = usePostsStore()
const toast = useToast()

const DRAFT_KEY = 'esay-publish-draft'

interface PublishDraft {
  content?: string
  images?: string[]
  tagNames?: string[]
  extension?: PostExtension | null
  updatedAt?: number
}

const draftPromptOpen = ref(false)
const pendingDraft = ref<PublishDraft | null>(null)

const draftPreviewText = computed(() => {
  const d = pendingDraft.value
  if (!d) return ''
  const text = (d.content ?? '').trim()
  if (text) return text.length > 50 ? `${text.slice(0, 50)}…` : text
  const parts: string[] = []
  if (d.images?.length) parts.push(`${d.images.length} 张图片`)
  if (d.extension) parts.push('扩展内容')
  return parts.join(' · ')
})

const draftTimeText = computed(() => {
  const at = pendingDraft.value?.updatedAt
  if (!at) return ''
  const diff = Date.now() - at
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return formatDate(at)
})

function detectDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const d = JSON.parse(raw) as PublishDraft
    if (!d || (!d.content && !d.images?.length && !d.extension)) return
    pendingDraft.value = d
    draftPromptOpen.value = true
  } catch {
    /* 草稿损坏时忽略 */
  }
}

function restoreDraft() {
  const d = pendingDraft.value
  if (d) {
    content.value = d.content ?? ''
    images.value = Array.isArray(d.images) ? d.images : []
    tagNames.value = Array.isArray(d.tagNames) ? d.tagNames : []
    extension.value = d.extension ?? null
  }
  draftPromptOpen.value = false
  pendingDraft.value = null
}

function discardDraft() {
  clearDraft()
  draftPromptOpen.value = false
  pendingDraft.value = null
}

let draftTimer: ReturnType<typeof setTimeout> | null = null

function saveDraft() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    if (!content.value.trim() && images.value.length === 0 && !extension.value) {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          content: content.value,
          images: images.value,
          tagNames: tagNames.value,
          extension: extension.value,
          updatedAt: Date.now(),
        }),
      )
    } catch {
      /* 存储满等异常忽略 */
    }
  }, 400)
}

function clearDraft() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  localStorage.removeItem(DRAFT_KEY)
}

watch([content, images, tagNames, extension], saveDraft, { deep: true })
onMounted(detectDraft)
onBeforeUnmount(() => {
  if (draftTimer) clearTimeout(draftTimer)
})

useClickOutside(moreRef, () => {
  moreOpen.value = false
  extPicking.value = null
})
useClickOutside(publishRef, () => {
  publishMenuOpen.value = false
})

const extOptions = [
  { type: 'WEBSITE', label: '网站链接', icon: 'icon-[ph--link]', desc: '展示标题与域名' },
  { type: 'GITHUBPROJ', label: 'GitHub 项目', icon: 'icon-[ph--github-logo]', desc: '展示仓库名称与星标' },
  { type: 'MUSIC', label: '音乐', icon: 'icon-[ph--music-note]', desc: '网易云/QQ 音乐等单曲' },
  { type: 'VIDEO', label: '视频', icon: 'icon-[ph--video-camera]', desc: 'B 站 / YouTube 视频' },
  { type: 'LOCATION', label: '位置', icon: 'icon-[ph--map-pin]', desc: '展示地点与坐标' },
  { type: 'TWEET', label: '推文', icon: 'icon-[ph--bird]', desc: '展示推文链接' },
] as const

function extLabel(type: string): string {
  return extOptions.find((o) => o.type === type)?.label ?? '扩展'
}

const extPlaceholder = computed(() => {
  switch (extPicking.value) {
    case 'GITHUBPROJ':
      return 'https://github.com/username/repo'
    case 'VIDEO':
      return '键入B站/YouTube链接...'
    case 'TWEET':
      return 'https://x.com/username/status/1234567890'
    case 'MUSIC':
      return extMusicServer.value === 'tencent'
        ? '歌曲 ID 或 QQ 音乐分享链接（如 https://c6.y.qq.com/xxx）'
        : '歌曲 ID 或网易云分享链接（如 https://163cn.tv/xxx）'
    default:
      return 'https://example.com'
  }
})

function pickExtension(type: string) {
  extPicking.value = type
  extInput.value = ''
  extLat.value = ''
  extLng.value = ''
  nextTick(() => extInputRef.value?.focus())
}

async function confirmExtension() {
  const type = extPicking.value as PostExtension['type']
  let raw: PostExtension | null = null
  if (type === 'LOCATION') {
    const name = extInput.value.trim()
    if (!name) {
      toast.info('请输入地点名称')
      return
    }
    raw = {
      type,
      payload: {
        name,
        latitude: Number(extLat.value) || 0,
        longitude: Number(extLng.value) || 0,
      },
    }
  } else if (type === 'MUSIC') {
    const id = extInput.value.trim()
    if (!id) {
      toast.info('请输入音乐 ID')
      return
    }
    raw = { type, payload: { server: extMusicServer.value, type: 'song', id } }
  } else {
    const url = extInput.value.trim()
    if (!url) return
    raw = { type, payload: { url } }
  }
  extPicking.value = null
  extInput.value = ''
  extAdding.value = true
  try {
    // 先调预览接口抓取完整元数据（标题/描述/星标等），让预览卡片展示详细信息
    const { extension: enriched } = await api<{ extension: PostExtension | null }>(
      '/api/extension/preview',
      { method: 'POST', body: { ...raw } },
    )
    extension.value = enriched ?? raw
  } catch {
    extension.value = raw
  } finally {
    extAdding.value = false
  }
  toast.success('已添加扩展内容')
}

function removeExtension() {
  extension.value = null
  extPicking.value = null
}

async function publish(isPrivateValue: boolean) {
  const text = content.value.trim()
  if (!text && images.value.length === 0 && !extension.value) {
    toast.info('写点什么再发布吧')
    return
  }
  submitting.value = true
  publishMenuOpen.value = false
  try {
    const { post } = await api<{ post: Post }>('/api/posts', {
      method: 'POST',
      body: {
        content: text,
        images: images.value,
        tag_names: tagNames.value,
        private: isPrivateValue,
        extension: extension.value,
      },
    })
    posts.addPost(post)
    content.value = ''
    images.value = []
    tagNames.value = []
    extension.value = null
    moreOpen.value = false
    clearDraft()
    toast.success(isPrivateValue ? '已私密发布' : '发布成功')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="card p-5">
    <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
      <span class="icon-[ph--pencil] text-lg" />这一刻在想什么？
      <span
        v-if="extension"
        class="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
      >
        {{ extLabel(extension.type) }}
      </span>
    </div>
    <textarea
      v-model="content"
      rows="3"
      class="input w-full resize-none"
      placeholder="支持 Markdown 语法…"
    />
    <div v-if="extension" class="mt-2.5">
      <div class="flex items-center gap-2">
        <ExtensionCard :extension="extension" class="min-w-0 flex-1" />
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          title="移除扩展"
          @click="removeExtension"
        >
          <span class="icon-[ph--x] text-sm" />
        </button>
      </div>
    </div>
    <div class="mt-2.5 flex items-center gap-2">
      <div ref="moreRef" class="relative">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-700 dark:text-gray-400"
          :class="moreOpen ? 'border-indigo-300 text-indigo-500 dark:border-indigo-500' : ''"
          title="更多"
          @click="moreOpen = !moreOpen"
        >
          <span class="icon-[icon-park-solid--more-four] text-sm" />
        </button>
        <div
          v-if="moreOpen"
          class="absolute left-0 top-full z-40 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          @click.stop
        >
          <p class="px-2 pb-1.5 pt-0.5 text-[10px] text-gray-400">附加内容</p>
          <template v-if="!extPicking">
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="opt in extOptions"
                :key="opt.type"
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition"
                :class="
                  extension?.type === opt.type
                    ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-900/40 dark:ring-indigo-500/40'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                "
                @click="pickExtension(opt.type)"
              >
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition"
                  :class="
                    extension?.type === opt.type
                      ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  "
                >
                  <span :class="opt.icon" />
                </span>
                <span
                  class="text-xs"
                  :class="extension?.type === opt.type ? 'font-medium text-indigo-600 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-300'"
                >
                  {{ opt.label }}
                </span>
              </button>
            </div>
          </template>
          <div v-else class="px-1 pb-1">
            <div class="mb-2.5 flex items-center gap-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                :class="
                  extension?.type === extPicking
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                "
              >
                <span :class="extOptions.find((o) => o.type === extPicking)?.icon" />
              </span>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ extLabel(extPicking) }}
              </p>
            </div>
            <template v-if="extPicking === 'MUSIC'">
              <div class="relative mb-2">
                <select
                  v-model="extMusicServer"
                  class="input w-full appearance-none !py-2 !pr-9 !text-sm"
                >
                  <option value="netease">网易云音乐</option>
                  <option value="tencent">QQ 音乐</option>
                </select>
                <span
                  class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
                >
                  <span class="icon-[ph--caret-down]" />
                </span>
              </div>
              <input
                ref="extInputRef"
                v-model="extInput"
                type="text"
                class="input w-full !py-2 !text-sm"
                :placeholder="extPlaceholder"
                @keydown.enter.prevent="confirmExtension"
              />
            </template>
            <template v-else-if="extPicking === 'LOCATION'">
              <input
                ref="extInputRef"
                v-model="extInput"
                type="text"
                class="input mb-2 w-full !py-2 !text-sm"
                placeholder="地点名称"
                @keydown.enter.prevent="confirmExtension"
              />
              <div class="mb-2 flex gap-2">
                <input
                  v-model="extLat"
                  type="text"
                  class="input w-24 min-w-0 !py-2 !text-sm"
                  placeholder="纬度"
                />
                <input
                  v-model="extLng"
                  type="text"
                  class="input w-24 min-w-0 !py-2 !text-sm"
                  placeholder="经度"
                />
              </div>
              <LocationPicker v-model="locValue" ref="locPickerRef" />
            </template>
            <input
              v-else
              ref="extInputRef"
              v-model="extInput"
              type="text"
              class="input w-full !py-2 !text-sm"
              :placeholder="extPlaceholder"
              @keydown.enter.prevent="confirmExtension"
            />
            <div class="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                class="rounded-full px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                @click="extPicking = null"
              >
                取消
              </button>
              <button
                type="button"
                class="btn-primary !rounded-full !px-4 !py-1.5 !text-xs"
                :disabled="extAdding"
                @click="confirmExtension"
              >
                <span v-if="extAdding" class="icon-[ph--spinner] animate-spin mr-1" />
                <span v-else class="icon-[ph--check] mr-1" />
                {{ extAdding ? '解析中…' : '确认添加' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <ImageUploader v-model="images" :limit="9" />
      <TagInput v-model="tagNames" />
    </div>
    <div class="mt-3 flex items-center justify-between">
      <span class="text-xs text-gray-400">支持 Markdown · 最多 9 张图</span>
      <div ref="publishRef" class="relative">
        <button class="btn-primary" :disabled="submitting" @click="publishMenuOpen = !publishMenuOpen">
          <span v-if="submitting" class="icon-[ph--spinner] animate-spin" />
          <span v-else class="icon-[ph--paper-plane-right]" />发布
        </button>
        <div
          v-if="publishMenuOpen"
          class="absolute bottom-full right-0 z-40 mb-2 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="px-2 pb-1 pt-0.5 text-[10px] text-gray-400">选择可见性</p>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="publish(false)"
          >
            <span class="icon-[ph--globe] text-sm" />
            <span class="flex-1">
              公开
              <span class="block text-[10px] text-gray-400">所有人可见，可被 Hub 收录</span>
            </span>
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="publish(true)"
          >
            <span class="icon-[ph--lock] text-sm" />
            <span class="flex-1">
              私密
              <span class="block text-[10px] text-gray-400">仅自己可见</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>

  <BaseModal v-if="draftPromptOpen" @close="discardDraft">
    <h2 class="text-lg font-bold">发现未发布的草稿</h2>
    <div class="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ draftPreviewText }}</p>
      <p class="mt-1 text-xs text-gray-400">{{ draftTimeText }}</p>
    </div>
    <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">检测到本地有保存的草稿，是否恢复？</p>
    <div class="mt-5 flex justify-end gap-2">
      <button class="btn" @click="discardDraft">放弃</button>
      <button class="btn-primary" @click="restoreDraft">恢复</button>
    </div>
  </BaseModal>
</template>
