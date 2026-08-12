<script setup lang="ts">
import type { HubInstance } from '~/utils/hub'
import { fetchHealthz, fetchInstanceConnect, hubVersionAtLeast, loadHubInstances } from '~/services/hub'
import { normalizeHubUrl, pMapLimit, resolveHubLogo } from '~/utils/hub-utils'

interface InstanceSummary {
  instance: HubInstance
  serverName: string
  username: string
  logo: string
  todayEchos: number
  totalEchos: number
}

type GridItem = { id: string | number } & Record<string, unknown>

const feed = useHubMergeFeed()
const { echoList, isPreparing, isLoading, hasMore, fetchErrors } = feed
const auth = useAuthStore()

/** 瀑布流项：以 virtual_key 作为唯一 id（不同实例的说说 id 可能重复） */
const gridItems = computed<GridItem[]>(() =>
  echoList.value.map((echo: HubFeedEcho) => ({ id: echo.virtual_key, echo })),
)

/** 瀑布流高度估算（ResizeObserver 实测修正） */
function estimateHubHeight(item: GridItem) {
  const echo = item.echo as HubFeedEcho
  let h = 26 // 卡片内边距 p-3
  h += 44 // 头部：头像 h-8 + 名称 + mb-3
  h += 12 // 内容区 py-2
  const text = echo.content ?? ''
  if (text) {
    const lines = Math.ceil(text.length / 20) * 1.2
    h += lines * 21
  }
  const n = (echo.echo_files ?? []).filter((f) => f.category === 'image').length
  if (n) {
    h += Math.ceil(n / 2) * 148 + 12
  }
  h += 36 // 底部时间/操作行
  return h
}

const instances = ref<HubInstance[]>([])
const configFailed = ref(false)
const sentinel = ref<HTMLElement | null>(null)

const showOverview = ref(false)
const overviewSummaries = ref<InstanceSummary[]>([])
const overviewLoading = ref(false)
const overviewLoaded = ref(false)

/** 站点元信息（名称/logo，供过滤弹窗展示） */
const instanceMeta = ref<Map<string, { name: string; logo: string }>>(new Map())
const logosMap = ref<Map<string, string>>(new Map())

/** 访客过滤：被隐藏的实例 URL（默认全部展示，偏好存本地） */
const FILTER_KEY = 'esay-hub-hidden-instances'
const hiddenUrls = ref<Set<string>>(new Set())
const showFilter = ref(false)

function loadHiddenUrls() {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return
    const list = JSON.parse(raw) as unknown
    if (Array.isArray(list)) hiddenUrls.value = new Set(list.filter((u) => typeof u === 'string'))
  } catch {
    /* ignore */
  }
}

function persistHiddenUrls() {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify([...hiddenUrls.value]))
  } catch {
    /* ignore */
  }
}

function setHidden(url: string, hidden: boolean) {
  const next = new Set(hiddenUrls.value)
  if (hidden) next.add(url)
  else next.delete(url)
  hiddenUrls.value = next
  persistHiddenUrls()
  applyFilters()
}

function clearFilters() {
  hiddenUrls.value = new Set()
  persistHiddenUrls()
  applyFilters()
}

const filterActiveCount = computed(() => hiddenUrls.value.size)

async function applyFilters() {
  if (!instances.value.length) return
  echoList.value = []
  feed.reset()
  await feed.prepareInstances(instances.value, logosMap.value, hiddenUrls.value)
  await feed.loadEchoListPage()
}

async function bootstrap() {
  configFailed.value = false
  instances.value = await loadHubInstances()
  if (!instances.value.length) {
    configFailed.value = true
    isPreparing.value = false
    return
  }
  loadHiddenUrls()
  const logos = new Map<string, string>()
  const meta = new Map<string, { name: string; logo: string }>()
  await pMapLimit(instances.value, 5, async (inst: HubInstance) => {
    const connect = await fetchInstanceConnect(inst.url)
    if (!connect) return
    const urlKey = normalizeHubUrl(inst.url)
    if (connect.logo) {
      logos.set(urlKey, connect.logo)
      meta.set(urlKey, { name: connect.server_name?.trim() || inst.id, logo: resolveHubLogo(connect.logo, urlKey) })
    } else {
      meta.set(urlKey, { name: connect.server_name?.trim() || inst.id, logo: '' })
    }
  })
  logosMap.value = logos
  instanceMeta.value = meta
  await feed.prepareInstances(instances.value, logos, hiddenUrls.value)
  await feed.loadEchoListPage()
}

async function loadOverview() {
  if (overviewLoaded.value) return
  overviewLoading.value = true
  try {
    const list = await loadHubInstances()
    const summaries: InstanceSummary[] = []
    await pMapLimit(list, 5, async (inst: HubInstance) => {
      const h = await fetchHealthz(inst.url)
      if (!h.ok || !hubVersionAtLeast(h.version, '4.4.0')) return
      const connect = await fetchInstanceConnect(inst.url)
      if (!connect) return
      const urlKey = normalizeHubUrl(inst.url)
      summaries.push({
        instance: inst,
        serverName: connect.server_name?.trim() || inst.id,
        username: connect.sys_username?.trim() ?? '',
        logo: resolveHubLogo(connect.logo, urlKey),
        todayEchos: connect.today_echos ?? 0,
        totalEchos: connect.total_echos ?? 0,
      })
    })
    summaries.sort((a, b) => a.serverName.localeCompare(b.serverName, 'zh-Hans-CN'))
    overviewSummaries.value = summaries
    overviewLoaded.value = true
  } finally {
    overviewLoading.value = false
  }
}

function openOverview() {
  showOverview.value = true
  loadOverview().catch(() => {})
}

onMounted(() => {
  bootstrap().catch(() => {
    configFailed.value = true
  })
})

useInfiniteScroll(sentinel, () => {
  feed.loadEchoListPage().catch(() => {})
})
</script>

<template>
  <div class="mx-auto w-full max-w-screen-2xl px-3 pb-16 pt-2">
    <div class="mb-6 flex items-center gap-2">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <span class="icon-[ph--arrow-left] text-sm" />时间线
      </NuxtLink>
      <h1 class="text-base font-bold text-gray-800 dark:text-gray-100">探索合流</h1>
      <button
        type="button"
        class="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        :class="filterActiveCount ? 'border-indigo-300 text-indigo-500 dark:border-indigo-500' : ''"
        @click="showFilter = true"
      >
        <span class="icon-[ph--funnel-simple] text-sm" />过滤
        <span
          v-if="filterActiveCount"
          class="rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300"
        >
          {{ filterActiveCount }}
        </span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        @click="openOverview"
      >
        <span class="icon-[ph--globe-hemisphere-east] text-sm" />站点概览
      </button>
    </div>

    <div v-if="configFailed" class="py-16 text-center text-sm text-gray-400">
      <span class="icon-[ph--globe-hemisphere-east] mx-auto mb-3 block text-4xl" />
      <p>还没有配置任何实例。</p>
      <p v-if="auth.loggedIn" class="mt-1">
        去
        <NuxtLink to="/settings" class="text-indigo-500 hover:underline">设置</NuxtLink>
        里添加 ech0 兼容实例吧。
      </p>
    </div>

    <template v-else>
      <div
        v-if="isPreparing && !echoList.length"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div v-for="i in 8" :key="i" class="card animate-pulse p-3">
          <div class="mb-3 flex items-center gap-2">
            <div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div class="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div class="mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      <MasonryGrid v-else-if="gridItems.length" :items="gridItems" :estimate="estimateHubHeight">
        <template #default="{ item }">
          <HubEchoCard :echo="(item as GridItem).echo as HubFeedEcho" />
        </template>
      </MasonryGrid>

      <div
        v-else-if="instances.length && hiddenUrls.size === instances.length"
        class="py-16 text-center text-sm text-gray-400"
      >
        <span class="icon-[ph--funnel-simple] mx-auto mb-3 block text-4xl" />
        <p>所有站点都已被隐藏。</p>
        <button type="button" class="mt-2 text-indigo-500 hover:underline" @click="clearFilters">
          全部恢复展示
        </button>
      </div>

      <div ref="sentinel" class="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <span
          v-if="(isPreparing || isLoading) && echoList.length"
          class="icon-[ph--spinner] animate-spin text-xl"
        />
        <span v-else-if="hasMore">向下滚动加载更多</span>
        <span v-else-if="echoList.length">已经到底啦</span>
      </div>

      <div v-if="fetchErrors.length" class="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-400 dark:bg-gray-800/60">
        <p class="mb-1 font-semibold">部分实例不可用：</p>
        <p v-for="(err, i) in fetchErrors" :key="i" class="truncate">
          {{ err.instance.id }} — {{ err.message }}
        </p>
      </div>
    </template>

    <BaseModal v-if="showFilter" @close="showFilter = false">
      <h2 class="mb-1 text-base font-bold">过滤站点</h2>
      <p class="mb-3 text-xs text-gray-400">选择不展示的站点，默认全部展示</p>
      <ul class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        <li
          v-for="inst in instances"
          :key="inst.url"
          class="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700"
        >
          <img
            v-if="instanceMeta.get(normalizeHubUrl(inst.url))?.logo"
            :src="instanceMeta.get(normalizeHubUrl(inst.url))!.logo"
            alt=""
            loading="lazy"
            class="h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-700"
          />
          <span
            v-else
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white"
          >
            {{ (instanceMeta.get(normalizeHubUrl(inst.url))?.name || inst.id).slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
            {{ instanceMeta.get(normalizeHubUrl(inst.url))?.name || inst.id }}
          </span>
          <BaseSwitch
            :model-value="!hiddenUrls.has(normalizeHubUrl(inst.url))"
            @update:model-value="setHidden(normalizeHubUrl(inst.url), !$event)"
          />
        </li>
      </ul>
      <div v-if="filterActiveCount" class="mt-3 flex justify-end">
        <button type="button" class="text-xs text-indigo-500 hover:underline" @click="clearFilters">
          全部恢复展示
        </button>
      </div>
    </BaseModal>

    <BaseModal v-if="showOverview" @close="showOverview = false">
      <h2 class="mb-3 text-base font-bold">活跃站点</h2>
      <div v-if="overviewLoading && !overviewSummaries.length" class="py-8 text-center text-gray-400">
        <span class="icon-[ph--spinner] animate-spin text-xl" />
      </div>
      <ul v-else-if="overviewSummaries.length" class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        <li
          v-for="s in overviewSummaries"
          :key="s.instance.url"
          class="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700"
        >
          <img
            v-if="s.logo"
            :src="s.logo"
            alt=""
            loading="lazy"
            class="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-gray-700"
          />
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white"
          >
            {{ s.serverName.slice(0, 1) }}
          </span>
            <div class="min-w-0 flex-1">
              <a
                :href="s.instance.url"
                target="_blank"
                rel="noopener noreferrer"
                class="truncate text-sm font-semibold text-gray-800 hover:underline dark:text-gray-100"
              >
                {{ s.serverName }}
              </a>
              <div class="text-xs text-gray-400">
                <span>今日 {{ s.todayEchos }} 条</span>
                <span class="mx-1">·</span>
                <span>共 {{ s.totalEchos }} 条</span>
              </div>
            </div>
        </li>
      </ul>
      <p v-else class="py-6 text-center text-sm text-gray-400">
        没有可用实例。
        <NuxtLink v-if="auth.loggedIn" to="/settings" class="text-indigo-500 hover:underline">
          去设置里添加
        </NuxtLink>
      </p>
    </BaseModal>
  </div>
</template>