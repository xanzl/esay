<script setup lang="ts">
const content = ref('')
const images = ref<string[]>([])
const tagNames = ref<string[]>([])
const isPrivate = ref(false)
const extension = ref<PostExtension | null>(null)
const extOpen = ref(false)
const extParsing = ref(false)
const extType = ref<PostExtension['type']>('WEBSITE')
const extUrl = ref('')
const extInputRef = ref<HTMLInputElement | null>(null)
const preview = ref(false)
const saving = ref(false)

const ui = useUiStore()
const posts = usePostsStore()
const api = useApi()
const toast = useToast()

const post = computed(() => ui.editingPost)

watch(
  post,
  (value: Post | null) => {
    if (value) {
      content.value = value.content
      images.value = [...value.images]
      tagNames.value = value.tags?.map((t) => t.name) ?? []
      isPrivate.value = value.private === true
      extension.value = value.extension ?? null
      preview.value = false
      extOpen.value = false
      extParsing.value = false
      extUrl.value = ''
    }
  },
  { immediate: true },
)

const extPlaceholder = computed(() => {
  switch (extType.value) {
    case 'GITHUBPROJ':
      return 'https://github.com/username/repo'
    case 'VIDEO':
      return '键入B站/YouTube链接...'
    case 'TWEET':
      return 'https://x.com/username/status/1234567890'
    case 'MUSIC':
      return '歌曲 ID 或网易云分享链接（如 https://163cn.tv/xxx）'
    default:
      return 'https://example.com'
  }
})

async function confirmExt() {
  const type = extType.value
  let raw: PostExtension | null = null
  if (type === 'LOCATION') {
    const name = extUrl.value.trim()
    if (!name) {
      toast.info('请输入地点名称')
      return
    }
    raw = { type, payload: { name, latitude: 0, longitude: 0 } }
  } else {
    const value = extUrl.value.trim()
    if (!value) {
      toast.info('请输入地址或 ID')
      return
    }
    raw = {
      type,
      payload: type === 'MUSIC' ? { server: 'netease', type: 'song', id: value } : { url: value },
    }
  }
  extParsing.value = true
  try {
    const { extension: enriched } = await api<{ extension: PostExtension | null }>(
      '/api/extension/preview',
      { method: 'POST', body: { ...raw } },
    )
    extension.value = enriched ?? raw
  } catch {
    extension.value = raw
  } finally {
    extParsing.value = false
  }
  extUrl.value = ''
  extOpen.value = false
}

async function save() {
  const target = post.value
  if (!target) return
  if (!content.value.trim() && images.value.length === 0 && !extension.value) {
    toast.info('内容不能为空')
    return
  }
  saving.value = true
  try {
    const { post: updated } = await api<{ post: Post }>(`/api/posts/${target.id}`, {
      method: 'PUT',
      body: {
        content: content.value.trim(),
        images: images.value,
        tag_names: tagNames.value,
        private: isPrivate.value,
        extension: extension.value,
      },
    })
    posts.updatePost(updated)
    ui.markEditorSaved()
    ui.closeEditor()
    toast.success('已保存')
  } catch (error) {
    toast.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal v-if="post" @close="ui.closeEditor()">
    <h2 class="text-lg font-bold">编辑说说</h2>

    <div class="mt-4">
      <textarea
        v-if="!preview"
        v-model="content"
        rows="6"
        class="input w-full resize-none"
        placeholder="支持 Markdown 语法…"
      />
      <div v-else class="md-content rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
        <Markdown :content="content" />
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <ImageUploader v-model="images" :limit="9" />
        <TagInput v-model="tagNames" />
      </div>
      <div v-if="extension" class="mt-2.5 flex items-center gap-2">
        <ExtensionCard :extension="extension" class="min-w-0 flex-1" />
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          title="移除扩展"
          @click="extension = null"
        >
          <span class="icon-[ph--x] text-sm" />
        </button>
      </div>
      <div v-else-if="extOpen" class="mt-2.5 rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
        <select v-model="extType" class="input w-full !px-2 !py-1.5 !text-xs">
          <option value="WEBSITE">网站链接</option>
          <option value="GITHUBPROJ">GitHub 项目</option>
          <option value="MUSIC">音乐</option>
          <option value="VIDEO">视频</option>
          <option value="LOCATION">位置</option>
          <option value="TWEET">推文</option>
        </select>
        <input
          ref="extInputRef"
          v-model="extUrl"
          type="text"
          class="input mt-2 w-full !px-2 !py-1.5 !text-xs"
          :placeholder="extPlaceholder"
        />
        <div class="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            @click="extOpen = false"
          >
            取消
          </button>
          <button
            type="button"
            class="btn-primary !rounded-full !px-4 !py-1.5 !text-xs"
            :disabled="extParsing || !extUrl.trim()"
            @click="confirmExt"
          >
            <span v-if="extParsing" class="icon-[ph--spinner] animate-spin mr-1" />
            <span v-else class="icon-[ph--check] mr-1" />
            {{ extParsing ? '解析中…' : '确认添加' }}
          </button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="mt-2.5 inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-400 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-600"
        @click="extOpen = true; nextTick(() => extInputRef?.focus())"
      >
        <span class="icon-[icon-park-solid--more-four] text-sm" />附加内容
      </button>
      <label class="mt-2.5 flex w-fit cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <input v-model="isPrivate" type="checkbox" class="h-4 w-4 rounded border-gray-300 accent-indigo-500" />
        <span class="icon-[ph--lock] text-sm" />私密（仅自己可见）
      </label>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <button class="text-sm text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300" @click="preview = !preview">
        {{ preview ? '返回编辑' : '预览' }}
      </button>
      <div class="flex gap-2">
        <button class="btn" @click="ui.closeEditor()">取消</button>
        <button class="btn-primary" :disabled="saving" @click="save">
          <span v-if="saving" class="icon-[ph--spinner] animate-spin" />保存
        </button>
      </div>
    </div>
  </BaseModal>
</template>
