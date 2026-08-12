<script setup lang="ts">
const props = defineProps<{ images: string[] }>()

const count = computed(() => props.images.length)
const activeIndex = ref<number | null>(null)
const activeImage = computed(() =>
  activeIndex.value === null ? null : props.images[activeIndex.value],
)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
const imageStage = ref<HTMLElement | null>(null)
const lightboxImage = ref<HTMLImageElement | null>(null)
const imageStyle = computed(() => ({
  cursor: zoom.value > 1 ? (dragging.value ? 'grabbing' : 'grab') : 'zoom-in',
  touchAction: zoom.value > 1 ? 'none' : 'auto',
  transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${zoom.value})`,
}))
let previousOverflow = ''
let touchStartX = 0
let dragOffsetX = 0
let dragOffsetY = 0

const gridClass = computed(() => {
  if (count.value === 1) return 'grid-cols-1'
  if (count.value <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
})

function open(index: number) {
  activeIndex.value = index
}

function close() {
  activeIndex.value = null
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  dragging.value = false
}

function clampPan() {
  const stage = imageStage.value
  const image = lightboxImage.value
  if (!stage || !image || zoom.value <= 1) {
    panX.value = 0
    panY.value = 0
    return
  }
  const maxX = Math.max(0, (image.offsetWidth * zoom.value - stage.clientWidth) / 2)
  const maxY = Math.max(0, (image.offsetHeight * zoom.value - stage.clientHeight) / 2)
  panX.value = Math.min(maxX, Math.max(-maxX, panX.value))
  panY.value = Math.min(maxY, Math.max(-maxY, panY.value))
}

function setZoom(value: number) {
  zoom.value = Math.min(4, Math.max(1, Math.round(value * 4) / 4))
  if (zoom.value === 1) {
    panX.value = 0
    panY.value = 0
  } else {
    nextTick(clampPan)
  }
}

function toggleZoom() {
  setZoom(zoom.value === 1 ? 2 : 1)
}

function onWheel(event: WheelEvent) {
  setZoom(zoom.value + (event.deltaY < 0 ? 0.25 : -0.25))
}

function startPan(event: PointerEvent) {
  if (zoom.value <= 1 || event.button !== 0) return
  dragging.value = true
  dragOffsetX = event.clientX - panX.value
  dragOffsetY = event.clientY - panY.value
  lightboxImage.value?.setPointerCapture(event.pointerId)
}

function movePan(event: PointerEvent) {
  if (!dragging.value) return
  panX.value = event.clientX - dragOffsetX
  panY.value = event.clientY - dragOffsetY
}

function stopPan(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (lightboxImage.value?.hasPointerCapture(event.pointerId)) {
    lightboxImage.value.releasePointerCapture(event.pointerId)
  }
  clampPan()
}

function previous() {
  if (activeIndex.value === null || count.value < 2) return
  activeIndex.value = (activeIndex.value - 1 + count.value) % count.value
}

function next() {
  if (activeIndex.value === null || count.value < 2) return
  activeIndex.value = (activeIndex.value + 1) % count.value
}

function onKeydown(event: KeyboardEvent) {
  if (activeIndex.value === null) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    previous()
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    setZoom(zoom.value + 0.25)
  }
  if (event.key === '-') {
    event.preventDefault()
    setZoom(zoom.value - 0.25)
  }
  if (event.key === '0') {
    event.preventDefault()
    resetView()
  }
}

function onTouchStart(event: TouchEvent) {
  if (zoom.value > 1) return
  touchStartX = event.changedTouches[0]?.clientX ?? 0
}

function onTouchEnd(event: TouchEvent) {
  if (zoom.value > 1) return
  const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX
  if (Math.abs(distance) < 50) return
  if (distance > 0) previous()
  else next()
}

watch(activeIndex, (index: number | null, previousIndex: number | null) => {
  if (index !== previousIndex) resetView()
  if (typeof document === 'undefined') return
  if (index !== null && previousIndex === null) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (index === null && previousIndex !== null) {
    document.body.style.overflow = previousOverflow
  }
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = previousOverflow
})
</script>

<template>
  <div class="grid gap-2" :class="gridClass">
    <button
      v-for="(image, index) in images"
      :key="`${image}-${index}`"
      type="button"
      class="block cursor-zoom-in overflow-hidden rounded-xl bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-gray-800"
      :aria-label="`查看第 ${index + 1} 张图片`"
      @click="open(index)"
    >
      <img
        :src="image"
        :class="count === 1 ? 'max-h-96 w-full object-cover' : 'aspect-square w-full object-cover'"
        alt="说说图片"
        loading="lazy"
      />
    </button>
  </div>

  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="activeImage"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="图片灯箱"
        @click.self="close"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <button
          type="button"
          class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-xl text-white transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white sm:right-5 sm:top-5"
          aria-label="关闭灯箱"
          @click="close"
        >
          <span class="icon-[ph--x]" />
        </button>

        <button
          v-if="count > 1"
          type="button"
          class="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-2xl text-white transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white sm:left-5"
          aria-label="上一张图片"
          @click="previous"
        >
          <span class="icon-[ph--caret-left]" />
        </button>

        <div
          ref="imageStage"
          class="absolute inset-12 flex items-center justify-center overflow-hidden sm:inset-16"
          @click.self="close"
          @wheel.prevent="onWheel"
        >
          <img
            :key="activeImage"
            ref="lightboxImage"
            :src="activeImage"
            :style="imageStyle"
            alt="说说图片大图"
            class="max-h-full max-w-full select-none object-contain will-change-transform"
            :class="dragging ? '' : 'transition-transform duration-150'"
            draggable="false"
            @click.stop
            @dblclick.stop="toggleZoom"
            @pointerdown="startPan"
            @pointermove="movePan"
            @pointerup="stopPan"
            @pointercancel="stopPan"
          />
        </div>

        <button
          v-if="count > 1"
          type="button"
          class="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-2xl text-white transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white sm:right-5"
          aria-label="下一张图片"
          @click="next"
        >
          <span class="icon-[ph--caret-right]" />
        </button>

        <span
          v-if="count > 1"
          class="absolute bottom-3 rounded-full bg-black/45 px-3 py-1 text-sm text-white sm:bottom-5"
        >
          {{ (activeIndex ?? 0) + 1 }} / {{ count }}
        </span>

        <div
          class="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center rounded-full bg-black/45 p-1 text-white sm:top-5"
          aria-label="图片缩放控制"
        >
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 disabled:opacity-35"
            :disabled="zoom <= 1"
            aria-label="缩小图片"
            title="缩小"
            @click="setZoom(zoom - 0.25)"
          >
            <span class="icon-[ph--minus]" />
          </button>
          <span class="w-14 text-center text-xs tabular-nums">{{ Math.round(zoom * 100) }}%</span>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 disabled:opacity-35"
            :disabled="zoom <= 1"
            aria-label="恢复图片大小"
            title="适应窗口"
            @click="resetView"
          >
            <span class="icon-[ph--corners-in]" />
          </button>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/15 disabled:opacity-35"
            :disabled="zoom >= 4"
            aria-label="放大图片"
            title="放大"
            @click="setZoom(zoom + 0.25)"
          >
            <span class="icon-[ph--plus]" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.18s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
