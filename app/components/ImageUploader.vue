<script setup lang="ts">
const props = defineProps<{ limit?: number }>()
const model = defineModel<string[]>({ required: true })

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const uploading = ref<Record<string, boolean>>({})

const api = useApi()
const toast = useToast()

const maxImages = computed(() => props.limit ?? 9)

useClickOutside(rootRef, () => {
  open.value = false
})

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''

  const slots = maxImages.value - model.value.length
  if (slots <= 0) {
    toast.info(`最多上传 ${maxImages.value} 张图片`)
    return
  }

  for (const file of files.slice(0, slots)) {
    if (!file.type.startsWith('image/')) {
      toast.error(`「${file.name}」不是图片文件`)
      continue
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(`「${file.name}」超过 8MB`)
      continue
    }
    const tempId = crypto.randomUUID()
    uploading.value[tempId] = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { url } = await api<{ url: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      })
      model.value = [...model.value, url]
    } catch (error) {
      toast.error(`「${file.name}」上传失败：${getErrorMessage(error)}`)
    } finally {
      delete uploading.value[tempId]
    }
  }
}

function removeAt(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-700 dark:text-gray-400"
      :class="open ? 'border-indigo-300 text-indigo-500 dark:border-indigo-500' : ''"
      @click="open = !open"
    >
      <span class="icon-[ph--image] text-sm" />
      图片
      <span
        v-if="model.length"
        class="rounded-full bg-indigo-100 px-1 text-[10px] text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300"
      >
        {{ model.length }}/{{ maxImages }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <div
        v-if="model.length || Object.keys(uploading).length"
        class="mb-2 grid grid-cols-4 gap-2"
      >
        <div
          v-for="(url, index) in model"
          :key="url"
          class="group relative aspect-square overflow-hidden rounded-lg"
        >
          <img :src="url" alt="图片预览" class="h-full w-full object-cover" />
          <button
            class="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
            aria-label="移除图片"
            @click="removeAt(index)"
          >
            <span class="icon-[ph--x] text-xs" />
          </button>
        </div>
        <div
          v-for="(value, key) in uploading"
          :key="key"
          class="flex aspect-square items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
        >
          <span class="icon-[ph--spinner] animate-spin text-lg text-gray-400" />
        </div>
      </div>

      <button
        v-if="model.length < maxImages"
        type="button"
        class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-600 dark:text-gray-400"
        @click="inputEl?.click()"
      >
        <span class="icon-[ph--upload-simple] text-sm" />选择图片上传
      </button>
      <p v-else class="py-1 text-center text-xs text-gray-400">已达上限（{{ maxImages }} 张）</p>

      <p class="mt-2 text-[10px] leading-relaxed text-gray-400">
        支持 JPG / PNG / GIF / WebP · 单张不超过 8MB
      </p>
    </div>

    <input
      ref="inputEl"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onFiles"
    />
  </div>
</template>