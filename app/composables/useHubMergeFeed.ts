import type { HubEcho, HubFeedEcho, HubInstance } from '../utils/hub'
import { normalizeHubUrl, pMapLimit, resolveHubLogo, timeValueToMs } from '../utils/hub-utils'
import { queryInstancePage } from '../services/hub'

const PAGE_SIZE = 10
const BATCH_SIZE = 10
const FAN_OUT_LIMIT = 5
/** 逐条追加的节奏（ms），避免整批插入引发瀑布流大面积重排 */
const ITEM_APPEND_DELAY = 60

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface HubBufferState {
  url: string
  instanceId: string
  buffer: HubFeedEcho[]
  currentPage: number
  hasMore: boolean
  isLoading: boolean
}

/** 聚合不展示带 Extension 的帖子（音乐/视频/GitHub 卡片等） */
function hasNoExtension(post: HubEcho): boolean {
  return post.extension == null
}

function toHubFeedEcho(post: HubEcho, inst: HubInstance, logos: Map<string, string>): HubFeedEcho {
  const instKey = normalizeHubUrl(inst.url)
  const rawLogo = logos.get(instKey) ?? ''
  return {
    ...post,
    username: post.username ?? '',
    private: post.private ?? false,
    user_id: post.user_id ?? '',
    fav_count: post.fav_count ?? 0,
    tags: post.tags ?? [],
    createdTs: timeValueToMs(post.created_at),
    server_name: inst.id,
    server_url: instKey,
    virtual_key: `${instKey}-${post.id}`,
    logo: resolveHubLogo(rawLogo, instKey),
  }
}

/**
 * 多源归并流（移植 ech0 hub 的 useHubMergeFeed）：
 * 每实例独立缓冲池 + 按 createdTs 全局归并分批取数。
 */
export function useHubMergeFeed() {
  const hubStates = ref<Map<string, HubBufferState>>(new Map())
  const echoList = ref<HubFeedEcho[]>([])
  const existingIds = ref<Set<string>>(new Set())

  const isPreparing = ref(true)
  const isLoading = ref(false)
  const hasTriedInitialLoad = ref(false)
  const hasMore = ref(true)
  const fetchErrors = ref<{ instance: HubInstance; message: string }[]>([])
  const instanceLogosByUrl = ref<Map<string, string>>(new Map())

  function setInstanceLogos(map: Map<string, string>) {
    instanceLogosByUrl.value = map
  }

  function reset() {
    hubStates.value.clear()
    echoList.value = []
    existingIds.value.clear()
    instanceLogosByUrl.value = new Map()
    isPreparing.value = true
    isLoading.value = false
    hasTriedInitialLoad.value = false
    hasMore.value = true
    fetchErrors.value = []
  }

  async function fetchHubPage(hubUrl: string) {
    const state = hubStates.value.get(hubUrl)
    if (!state || state.isLoading || !state.hasMore) return

    state.isLoading = true
    try {
      const items = await queryInstancePage(hubUrl, {
        page: state.currentPage,
        pageSize: PAGE_SIZE,
        search: '',
        tagIds: [],
        sortBy: '',
        sortOrder: 'desc',
      })

      const inst: HubInstance = { id: state.instanceId, url: state.url }
      const mapped = items.filter(hasNoExtension).map((echo) => toHubFeedEcho(echo, inst, instanceLogosByUrl.value))
      mapped.sort((a, b) => b.createdTs - a.createdTs)
      state.buffer.push(...mapped)
      state.currentPage += 1
      state.hasMore = items.length >= PAGE_SIZE
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const s = hubStates.value.get(hubUrl)
      if (s) {
        fetchErrors.value.push({ instance: { id: s.instanceId, url: hubUrl }, message })
        s.hasMore = false
      }
    } finally {
      const s = hubStates.value.get(hubUrl)
      if (s) s.isLoading = false
    }
  }

  async function prepareInstances(
    instances: HubInstance[],
    logos?: Map<string, string>,
    hiddenUrls?: Set<string>,
  ) {
    isPreparing.value = true
    hasTriedInitialLoad.value = false
    hubStates.value.clear()
    fetchErrors.value = []
    instanceLogosByUrl.value = logos ?? new Map()

    for (const inst of instances) {
      const urlKey = normalizeHubUrl(inst.url)
      if (hiddenUrls?.has(urlKey)) continue
      hubStates.value.set(urlKey, {
        url: urlKey,
        instanceId: inst.id,
        buffer: [],
        currentPage: 1,
        hasMore: true,
        isLoading: false,
      })
    }

    if (hubStates.value.size === 0) {
      echoList.value = []
      existingIds.value.clear()
      hasMore.value = false
      hasTriedInitialLoad.value = true
      isPreparing.value = false
      return
    }

    await pMapLimit([...hubStates.value.keys()], FAN_OUT_LIMIT, (url) => fetchHubPage(url))
    isPreparing.value = false
  }

  async function loadEchoListPage() {
    if (isLoading.value || isPreparing.value) return

    const canLoadMore = [...hubStates.value.values()].some((s) => s.hasMore || s.buffer.length > 0)
    if (!canLoadMore) {
      hasMore.value = false
      hasTriedInitialLoad.value = true
      return
    }

    isLoading.value = true
    try {
      const result: HubFeedEcho[] = []
      let attempts = 0
      const maxAttempts = BATCH_SIZE * 3

      while (result.length < BATCH_SIZE && attempts < maxAttempts) {
        attempts++

        let maxTs = -1
        let maxHubUrl: string | null = null
        for (const [url, state] of hubStates.value) {
          const head = state.buffer[0]
          if (head && head.createdTs > maxTs) {
            maxTs = head.createdTs
            maxHubUrl = url
          }
        }

        if (maxHubUrl === null) {
          const emptyHubsWithMore = [...hubStates.value.values()].filter(
            (s) => s.hasMore && !s.isLoading && s.buffer.length === 0,
          )
          if (emptyHubsWithMore.length === 0) break
          await pMapLimit(emptyHubsWithMore, FAN_OUT_LIMIT, (s) => fetchHubPage(s.url))
          continue
        }

        const state = hubStates.value.get(maxHubUrl)!
        const echo = state.buffer.shift()!
        const key = `${echo.server_url}-${echo.id}`
        if (!existingIds.value.has(key)) {
          existingIds.value.add(key)
          result.push(echo)
        }
        if (state.buffer.length < 3 && state.hasMore && !state.isLoading) {
          void fetchHubPage(maxHubUrl)
        }
      }

      // 逐条追加（瀑布流 append 路径不移动已有卡片），而非整批 push
      for (const echo of result) {
        echoList.value.push(echo)
        await delay(ITEM_APPEND_DELAY)
      }
      hasMore.value = [...hubStates.value.values()].some((s) => s.hasMore || s.buffer.length > 0)
      hasTriedInitialLoad.value = true
    } finally {
      isLoading.value = false
    }
  }

  return {
    echoList,
    hubStates,
    isPreparing,
    isLoading,
    hasMore,
    hasTriedInitialLoad,
    fetchErrors,
    reset,
    setInstanceLogos,
    prepareInstances,
    loadEchoListPage,
  }
}