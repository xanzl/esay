<script setup lang="ts">
type GridItem = { id: string | number } & Record<string, unknown>

const props = withDefaults(
  defineProps<{
    items: GridItem[]
    estimate: (item: GridItem) => number
    /** 固定在第一列顶部、不参与分发的项数（如站长卡片、发布框） */
    pinned?: number
  }>(),
  { pinned: 0 },
)

const buckets = ref<GridItem[][]>([])
const colHeights = ref<number[]>([])
const measured = new Map<string, number>()
const els = new Map<string, HTMLElement>()
let raf = 0
let ro: ResizeObserver | null = null

function colCount() {
  if (typeof window === 'undefined') return 1
  if (window.innerWidth >= 1280) return 4
  if (window.innerWidth >= 1024) return 3
  if (window.innerWidth >= 640) return 2
  return 1
}

function heightOf(item: GridItem) {
  return measured.get(String(item.id)) ?? props.estimate(item)
}

function shortest() {
  if (!colHeights.value.length) return 0
  return colHeights.value.indexOf(Math.min(...colHeights.value))
}

function distribute(items: GridItem[]) {
  const n = colCount()
  const pinned = items.slice(0, props.pinned)
  const rest = items.slice(props.pinned)
  const cols: GridItem[][] = Array.from({ length: n }, () => [])
  const hs = new Array(n).fill(0)
  if (pinned.length) {
    cols[0].push(...pinned)
    hs[0] = pinned.reduce((s, it) => s + heightOf(it), 0)
  }
  for (const item of rest) {
    const i = hs.indexOf(Math.min(...hs))
    cols[i].push(item)
    hs[i] += heightOf(item)
  }
  colHeights.value = hs
  buckets.value = cols
}

watch(
  () => props.items,
  (items: GridItem[]) => {
    if (!items.length) {
      buckets.value = []
      return
    }
    const existing = new Set(buckets.value.flat().map((i: GridItem) => String(i.id)))
    const all = items.map((i: GridItem) => String(i.id))
    const isAppend =
      buckets.value.length > 0 &&
      all.length > existing.size &&
      all.slice(0, existing.size).every((id: string) => existing.has(id))
    const pinnedIds = items.slice(0, props.pinned).map((i: GridItem) => String(i.id))
    const col0Pinned =
      buckets.value[0]?.slice(0, props.pinned).map((i: GridItem) => String(i.id)) ?? []
    const pinnedStable =
      col0Pinned.length === pinnedIds.length &&
      col0Pinned.every((id: string, index: number) => id === pinnedIds[index])
    if (isAppend && pinnedStable) {
      for (const item of items.filter((i: GridItem) => !existing.has(String(i.id)))) {
        const i = shortest()
        buckets.value[i].push(item)
        colHeights.value[i] += heightOf(item)
      }
    } else {
      distribute(items)
    }
    observe()
  },
  { immediate: true },
)

function setEl(id: string, el: HTMLElement | null) {
  if (el) els.set(id, el)
  else els.delete(id)
}

function onEntry(entries: ResizeObserverEntry[]) {
  let changed = false
  for (const entry of entries) {
    const id = (entry.target as HTMLElement).dataset.id
    if (!id) continue
    const h = Math.round(entry.contentRect.height)
    if (Math.abs((measured.get(id) ?? 0) - h) > 24) {
      measured.set(id, h)
      changed = true
    }
  }
  if (changed) scheduleRebalance()
}

function scheduleRebalance() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const hs = buckets.value.map((col: GridItem[]) => col.reduce((s: number, it: GridItem) => s + heightOf(it), 0))
    if (hs.length && Math.max(...hs) - Math.min(...hs) > 260) distribute(props.items)
  })
}

function observe() {
  ro?.disconnect()
  ro = new ResizeObserver(onEntry)
  els.forEach((el) => ro!.observe(el))
}

function onWindowResize() {
  if (colCount() !== buckets.value.length) {
    distribute(props.items)
    observe()
  }
}

onMounted(() => window.addEventListener('resize', onWindowResize))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  ro?.disconnect()
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="flex items-start gap-4">
    <div v-for="(col, i) in buckets" :key="i" class="flex min-w-0 flex-1 flex-col gap-4">
      <div
        v-for="item in col"
        :key="item.id"
        :ref="(el: Element | ComponentPublicInstance | null) => setEl(String(item.id), el as HTMLElement | null)"
        :data-id="String(item.id)"
        class="min-w-0"
      >
        <slot name="default" :item="item" />
      </div>
    </div>
  </div>
</template>
