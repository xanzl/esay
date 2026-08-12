<script setup lang="ts">
const props = defineProps<{ modelValue: { latitude: number; longitude: number } }>()
const emit = defineEmits<{ 'update:modelValue': [value: { latitude: number; longitude: number }] }>()

const mapEl = ref<HTMLElement | null>(null)
const locating = ref(false)
let map: unknown = null
let marker: unknown = null
let tileLayer: unknown = null
let leafletPromise: Promise<unknown> | null = null

const { theme } = useTheme()

function tileUrl() {
  const style = theme.value === 'dark' ? 'dark' : 'light'
  return `/api/tiles/{z}/{x}/{y}.png?style=${style}`
}

function loadLeaflet(): Promise<unknown> {
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve) => {
    const cssReady = new Promise<void>((res) => {
      if (document.getElementById('moment-leaflet-css')) {
        res()
        return
      }
      const link = document.createElement('link')
      link.id = 'moment-leaflet-css'
      link.rel = 'stylesheet'
      link.href = '/vendor/leaflet/leaflet.css'
      link.onload = () => res()
      link.onerror = () => res()
      document.head.appendChild(link)
    })
    const jsReady = new Promise<void>((res) => {
      if (window.L) {
        res()
        return
      }
      const script = document.createElement('script')
      script.src = '/vendor/leaflet/leaflet.js'
      script.onload = () => res()
      script.onerror = () => res()
      document.head.appendChild(script)
    })
    // 必须等 CSS 也加载完成再初始化地图，否则 Leaflet 层级/瓦片样式缺失导致地图空白
    Promise.all([cssReady, jsReady]).then(() => resolve(window.L))
  })
  return leafletPromise
}

function setPosition(latitude: number, longitude: number, center = false) {
  emit('update:modelValue', { latitude, longitude })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMap = map as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMarker = marker as any
  if (anyMarker?.setLatLng) anyMarker.setLatLng([latitude, longitude])
  if (center && anyMap?.setView) anyMap.setView([latitude, longitude], 15)
}

async function initMap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (await loadLeaflet()) as any
  const el = mapEl.value
  if (!L || !el || map) return
  const lat = props.modelValue.latitude || 34.34
  const lng = props.modelValue.longitude || 108.94
  map = L.map(el, { zoomControl: true }).setView([lat, lng], props.modelValue.latitude ? 15 : 3)
  // 瓦片经服务端代理（CARTO 主源，暗色/亮色主题），OSM 作备用
  tileLayer = L.tileLayer(tileUrl(), {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map)
  marker = L.marker([lat, lng], { draggable: true }).addTo(map)
  ;(marker as { on: (e: string, cb: (ev: { latlng: { lat: number; lng: number } }) => void) => void }).on(
    'dragend',
    (ev) => {
      setPosition(ev.latlng.lat, ev.latlng.lng)
    },
  )
  ;(map as { on: (e: string, cb: (ev: { latlng: { lat: number; lng: number } }) => void) => void }).on(
    'click',
    (ev) => {
      setPosition(ev.latlng.lat, ev.latlng.lng)
    },
  )
}

function locate() {
  if (!navigator.geolocation) {
    useToast().error('当前浏览器不支持定位，请手动选择当前位置')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setPosition(pos.coords.latitude, pos.coords.longitude, true)
      locating.value = false
    },
    () => {
      useToast().error('获取当前位置失败，请手动选择当前位置')
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

defineExpose({ setPosition })

// 主题切换时刷新瓦片层（亮暗瓦片源不同）
watch(
  () => theme.value,
  () => {
    const layer = tileLayer as { setUrl?: (url: string) => void } | null
    if (layer?.setUrl) layer.setUrl(tileUrl())
  },
)

onMounted(() => {
  initMap().catch(() => {})
})
onBeforeUnmount(() => {
  if (map) {
    ;(map as { remove: () => void }).remove()
    map = null
    marker = null
    tileLayer = null
  }
})
</script>

<template>
  <div>
    <div ref="mapEl" class="h-44 w-full rounded-xl border border-gray-200 dark:border-gray-700" />
    <div class="mt-1.5 flex items-center gap-2">
      <span class="min-w-0 flex-1 truncate text-[10px] text-gray-400">
        {{ modelValue.latitude?.toFixed(4) ?? '-' }}, {{ modelValue.longitude?.toFixed(4) ?? '-' }}
      </span>
      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-500 px-3 py-1 text-xs text-white transition hover:bg-indigo-600 disabled:opacity-60"
        :disabled="locating"
        @click="locate"
      >
        <span v-if="locating" class="icon-[ph--spinner] animate-spin" />
        <span v-else class="icon-[ph--crosshair] text-sm" />
        {{ locating ? '定位中…' : '定位到当前位置' }}
      </button>
    </div>
  </div>
</template>