<script setup lang="ts">
const props = defineProps<{ src: string }>()

const audioRef = ref<HTMLAudioElement>()
const progressBar = ref<HTMLElement>()

const playing = ref(false)
const loading = ref(false)
const failed = ref(false)
const current = ref(0)
const duration = ref(0)
const dragging = ref(false)
const dragRatio = ref(0)

const progress = computed(() => {
  if (dragging.value) return dragRatio.value * 100
  if (!duration.value) return 0
  return (current.value / duration.value) * 100
})

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function toggle() {
  const audio = audioRef.value
  if (!audio) return
  if (audio.paused) void audio.play().catch(() => { failed.value = true })
  else audio.pause()
}

function ratioFromClientX(clientX: number): number {
  const bar = progressBar.value
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
}

function onPointerDown(event: PointerEvent) {
  if (!audioRef.value || !duration.value) return
  dragging.value = true
  dragRatio.value = ratioFromClientX(event.clientX)
  progressBar.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) dragRatio.value = ratioFromClientX(event.clientX)
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  const audio = audioRef.value
  if (audio && duration.value) {
    audio.currentTime = dragRatio.value * duration.value
    current.value = audio.currentTime
  }
}

function onOtherPlay(event: Event) {
  const audio = audioRef.value
  if (audio && !audio.paused && (event as CustomEvent<HTMLAudioElement>).detail !== audio) audio.pause()
}

onMounted(() => window.addEventListener('moment:audio-play', onOtherPlay))
onBeforeUnmount(() => {
  window.removeEventListener('moment:audio-play', onOtherPlay)
  audioRef.value?.pause()
})

function onPlay() {
  playing.value = true
  loading.value = false
  window.dispatchEvent(new CustomEvent('moment:audio-play', { detail: audioRef.value }))
}
function onPause() { playing.value = false }
function onWaiting() { loading.value = true }
function onPlaying() { loading.value = false }
function onTimeUpdate() { current.value = audioRef.value?.currentTime ?? 0 }
function onLoadedMetadata() { duration.value = audioRef.value?.duration ?? 0 }
function onError() {
  failed.value = true
  loading.value = false
}
</script>

<template>
  <div v-if="failed" class="mt-3 flex items-center justify-between gap-3 rounded-lg bg-gray-100/70 px-3 py-2.5 dark:bg-gray-800/70">
    <span class="text-xs text-gray-400">音频播放失败</span>
    <slot name="fallback" />
  </div>
  <div v-else class="mt-3 flex items-center gap-3 rounded-lg bg-gray-100/70 px-3 py-2.5 dark:bg-gray-800/70">
    <button
      type="button"
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!duration"
      :aria-label="playing ? '暂停' : '播放'"
      @click="toggle"
    >
      <span v-if="loading" class="icon-[ph--spinner] animate-spin text-lg" />
      <span v-else :class="playing ? 'icon-[ph--pause] text-lg' : 'icon-[ph--play] text-lg'" />
    </button>
    <div
      ref="progressBar"
      class="relative h-1.5 flex-1 cursor-pointer touch-none overflow-hidden rounded-full bg-gray-300/70 dark:bg-gray-600/70"
      role="slider"
      :aria-label="`播放进度 ${Math.round(progress)}%`"
      :aria-valuenow="Math.round(progress)"
      aria-valuemin="0"
      aria-valuemax="100"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="absolute inset-y-0 left-0 rounded-full bg-indigo-500" :style="{ width: `${progress}%` }" />
    </div>
    <span class="w-[88px] shrink-0 text-right text-xs tabular-nums text-gray-400">
      {{ formatTime(current) }} / {{ formatTime(duration) }}
    </span>
  </div>
  <audio
    ref="audioRef"
    :src="src"
    preload="metadata"
    @play="onPlay"
    @pause="onPause"
    @waiting="onWaiting"
    @playing="onPlaying"
    @timeupdate="onTimeUpdate"
    @loadedmetadata="onLoadedMetadata"
    @error="onError"
  />
</template>
