<script setup lang="ts">
const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const api = useApi()
const toast = useToast()
const auth = useAuthStore()

const open = ref(false)
const creating = ref(false)
const newTagInput = ref('')
const newTagRef = ref<HTMLInputElement | null>(null)
const existing = ref<Array<{ id: string; name: string }>>([])
const loaded = ref(false)
const dragIndex = ref<number | null>(null)
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const rootRef = ref<HTMLElement | null>(null)

useClickOutside(rootRef, () => {
  if (open.value) {
    open.value = false
    creating.value = false
  }
})

async function loadTags() {
  if (loaded.value) return
  try {
    const res = await api<{ tags: Array<{ id: string; name: string }> }>('/api/tags', {
      auth: false,
    })
    existing.value = res.tags
    loaded.value = true
  } catch {
    /* ignore */
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    loadTags().catch(() => {})
    creating.value = false
    newTagInput.value = ''
  }
}

function startCreate() {
  creating.value = true
  nextTick(() => newTagRef.value?.focus())
}

function createTag() {
  const name = newTagInput.value.trim().slice(0, 20)
  if (!name) {
    creating.value = false
    return
  }
  if (props.modelValue.includes(name)) {
    toast.info('该标签已选中')
    newTagInput.value = ''
    return
  }
  if (props.modelValue.length >= 10) {
    toast.info('最多 10 个标签')
    return
  }
  emit('update:modelValue', [...props.modelValue, name])
  // 新建的标签进入已存列表（服务端会在保存时落库）
  if (!existing.value.some((t: { id: string; name: string }) => t.name === name)) {
    existing.value.push({ id: '', name })
  }
  newTagInput.value = ''
  creating.value = false
}

function toggleTag(tag: { id: string; name: string }) {
  if (props.modelValue.includes(tag.name)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((n) => n !== tag.name),
    )
  } else {
    if (props.modelValue.length >= 10) {
      toast.info('最多 10 个标签')
      return
    }
    emit('update:modelValue', [...props.modelValue, tag.name])
  }
}

function removeName(name: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((n) => n !== name),
  )
}

function onDragStart(index: number) {
  dragIndex.value = index
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === index) return
  const list = [...props.modelValue]
  const [moved] = list.splice(from, 1)
  list.splice(index, 0, moved)
  emit('update:modelValue', list)
}

async function deleteTag(tag: { id: string; name: string }) {
  if (!auth.loggedIn) {
    toast.info('登录后才能删除标签')
    return
  }
  if (!window.confirm(`确定删除标签「#${tag.name}」吗？删除后该标签会从所有说说上移除。`)) return
  try {
    if (tag.id) {
      await api(`/api/tags/${tag.id}`, { method: 'DELETE' })
    }
    existing.value = existing.value.filter((t: { id: string; name: string }) => t.name !== tag.name)
    removeName(tag.name)
    toast.success('标签已删除')
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

function startLongPress(tag: { id: string; name: string }) {
  cancelLongPress()
  longPressTimer.value = setTimeout(() => {
    deleteTag(tag).catch(() => {})
  }, 500)
}

function cancelLongPress() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function onContextMenu(event: MouseEvent, tag: { id: string; name: string }) {
  event.preventDefault()
  cancelLongPress()
  deleteTag(tag).catch(() => {})
}

onBeforeUnmount(cancelLongPress)
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-700 dark:text-gray-400"
      :class="open ? 'border-indigo-300 text-indigo-500 dark:border-indigo-500' : ''"
      @click="toggle"
    >
      <span class="icon-[gravity-ui--tag] text-sm" />
      标签
      <span v-if="modelValue.length" class="rounded-full bg-indigo-100 px-1 text-[10px] text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
        {{ modelValue.length }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute left-1/2 top-full z-40 mt-2 w-64 min-w-64 max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <div
        v-if="modelValue.length"
        class="mb-2 flex flex-wrap gap-1.5 border-b border-gray-100 pb-2 dark:border-gray-800"
      >
        <span
          v-for="(name, index) in modelValue"
          :key="name"
          draggable="true"
          class="inline-flex cursor-grab items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 active:cursor-grabbing dark:bg-indigo-900/40 dark:text-indigo-300"
          :title="'拖动调整顺序'"
          @dragstart="onDragStart(index)"
          @dragover.prevent
          @drop="onDrop(index)"
        >
          #{{ name }}
          <button
            type="button"
            class="inline-flex items-center justify-center hover:text-red-500"
            :aria-label="`移除标签 ${name}`"
            @click="removeName(name)"
          >
            <span class="icon-[ph--x] text-xs" />
          </button>
        </span>
      </div>

      <button
        v-if="!creating"
        type="button"
        class="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        @click="startCreate"
      >
        <span class="icon-[ph--plus] text-sm text-indigo-500" />新建标签
      </button>

      <div v-else class="flex items-center gap-1.5">
        <input
          ref="newTagRef"
          v-model="newTagInput"
          type="text"
          class="input !px-2 !py-1 !text-xs"
          maxlength="20"
          placeholder="标签名，回车确认"
          @keydown.enter.prevent="createTag"
          @keydown.esc="creating = false"
        />
        <button type="button" class="shrink-0 text-xs text-indigo-500 hover:underline" @click="createTag">确认</button>
      </div>

      <div class="mt-1.5 max-h-48 overflow-y-auto">
        <button
          v-for="tag in existing"
          :key="tag.name"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition"
          :class="
            modelValue.includes(tag.name)
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          "
          @click="toggleTag(tag)"
          @pointerdown="startLongPress(tag)"
          @pointerup="cancelLongPress"
          @pointerleave="cancelLongPress"
          @contextmenu.prevent="onContextMenu($event, tag)"
        >
          <span class="min-w-0 flex-1 truncate">#{{ tag.name }}</span>
          <span
            v-if="modelValue.includes(tag.name)"
            class="icon-[ph--check] text-sm text-indigo-500"
          />
        </button>
        <p v-if="!existing.length" class="py-2 text-center text-xs text-gray-400">
          还没有已保存的标签
        </p>
      </div>

      <p class="mt-2 border-t border-gray-100 pt-1.5 text-[10px] leading-relaxed text-gray-400 dark:border-gray-800">
        点击选择 · 长按或右键删除 · 拖动已选标签调整顺序
      </p>
    </div>
  </div>
</template>