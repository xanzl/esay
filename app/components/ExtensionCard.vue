<script setup lang="ts">
const props = defineProps<{ extension: PostExtension }>()

const typeMeta: Record<string, { label: string; icon: string }> = {
  WEBSITE: { label: '网站链接', icon: 'icon-[ph--link]' },
  GITHUBPROJ: { label: 'GitHub 项目', icon: 'icon-[ph--github-logo]' },
  MUSIC: { label: '音乐分享', icon: 'icon-[ph--music-note]' },
  VIDEO: { label: '视频', icon: 'icon-[ph--video-camera]' },
  LOCATION: { label: '位置', icon: 'icon-[ph--map-pin]' },
  TWEET: { label: '推文', icon: 'icon-[ph--bird]' },
}

const meta = computed(() => typeMeta[props.extension.type] ?? { label: '扩展', icon: 'icon-[ph--squares-four]' })

/** 头部右侧的平台/类型信息 */
const headerMeta = computed(() => {
  const p = props.extension.payload
  if (props.extension.type === 'MUSIC') {
    const names: Record<string, string> = {
      netease: '网易云音乐',
      tencent: 'QQ音乐',
      kugou: '酷狗音乐',
      kuwo: '酷我音乐',
    }
    return names[String(p.server ?? '')] ?? ''
  }
  if (props.extension.type === 'GITHUBPROJ') {
    return String(p.owner ?? '') ? `@${p.owner}` : ''
  }
  if (props.extension.type === 'WEBSITE') return displayDomain(String(p.site ?? p.url ?? ''))
  return ''
})

const githubAvatarFailed = ref(false)

function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

const website = computed(() => {
  const p = props.extension.payload
  return {
    title: String(p.title ?? ''),
    site: String(p.site ?? ''),
  }
})

const github = computed(() => {
  const p = props.extension.payload
  return {
    url: String(p.url ?? ''),
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    stars: Number(p.stars ?? 0),
    forks: Number(p.forks ?? 0),
    avatar: String(p.avatar ?? ''),
  }
})

const music = computed(() => {
  const p = props.extension.payload
  const server = String(p.server ?? 'netease')
  const platformName: Record<string, string> = {
    netease: '网易云音乐',
    tencent: 'QQ音乐',
    kugou: '酷狗音乐',
    kuwo: '酷我音乐',
  }
  return {
    server,
    platformName: platformName[server] ?? server,
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    artist: String(p.artist ?? ''),
    url: String(p.url ?? ''),
    cover: String(p.cover ?? ''),
    jumpUrl: String(p.jump_url ?? ''),
  }
})

const musicJumpHref = computed(() => {
  if (music.value.jumpUrl) return music.value.jumpUrl
  const serverBase: Record<string, string> = {
    netease: 'https://music.163.com/#/song?id=',
    tencent: 'https://y.qq.com/n/ryqq/songDetail/',
    kugou: 'https://www.kugou.com/song/#hash=',
    kuwo: 'https://www.kuwo.cn/play_detail/',
  }
  return `${serverBase[music.value.server] ?? serverBase.netease}${music.value.id}`
})

const video = computed(() => {
  const p = props.extension.payload
  return {
    type: String(p.type ?? 'bilibili'),
    videoId: String(p.videoId ?? ''),
    url: String(p.url ?? ''),
  }
})

const location = computed(() => {
  const p = props.extension.payload
  return {
    name: String(p.name ?? ''),
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
  }
})

const tweet = computed(() => {
  const p = props.extension.payload
  return {
    url: String(p.url ?? ''),
    username: String(p.username ?? ''),
    statusId: String(p.statusId ?? ''),
  }
})

/** 音乐/视频卡片的原始页面链接（顶栏右侧 link 图标） */
const originalHref = computed(() => {
  if (props.extension.type === 'MUSIC') return music.value.jumpUrl || musicJumpHref.value
  if (props.extension.type === 'VIDEO') return video.value.url || ''
  return ''
})
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60"
  >
    <div class="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
      <span class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        <span :class="meta.icon" class="text-sm" />
        {{ meta.label }}
      </span>
      <span class="flex min-w-0 items-center gap-1.5">
        <span v-if="headerMeta" class="truncate text-[10px] text-gray-400">{{ headerMeta }}</span>
        <a
          v-if="originalHref"
          :href="originalHref"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 rounded p-0.5 text-gray-400 transition hover:bg-gray-200/70 hover:text-indigo-500 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
          :title="'打开原始页面'"
          :aria-label="'打开原始页面'"
        >
          <span class="icon-[ph--link] text-sm" />
        </a>
      </span>
    </div>

    <a
      v-if="extension.type === 'WEBSITE' && website.site"
      :href="website.site"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-4 p-4 transition hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
    >
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300">
        <span class="icon-[ph--link]" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
          {{ website.title }}
        </span>
        <span class="mt-0.5 block truncate text-xs text-gray-400">{{ displayDomain(website.site) }}</span>
      </span>
    </a>

    <a
      v-else-if="extension.type === 'GITHUBPROJ' && github.url"
      :href="github.url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-4 p-4 transition hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
    >
      <img
        v-if="github.avatar && !githubAvatarFailed"
        :src="github.avatar"
        alt=""
        loading="lazy"
        class="h-11 w-11 shrink-0 rounded-full object-cover"
        @error="githubAvatarFailed = true"
      />
      <span
        v-else
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-200/70 text-xl text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      >
        <span class="icon-[ph--github-logo]" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
          {{ github.name }}
        </span>
        <span v-if="github.description" class="mt-0.5 block truncate text-xs text-gray-400">
          {{ github.description }}
        </span>
        <span class="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center gap-0.5">
            <span class="icon-[ph--star] text-amber-400" />{{ github.stars }}
          </span>
          <span class="text-gray-300 dark:text-gray-600">·</span>
          <span class="inline-flex items-center gap-0.5">
            <span class="icon-[ph--git-fork]" />{{ github.forks }} forks
          </span>
        </span>
        <span class="mt-0.5 block truncate text-xs text-gray-400">{{ displayDomain(github.url) }}</span>
      </span>
    </a>

    <div v-else-if="extension.type === 'MUSIC'" class="p-4">
      <div class="flex items-center gap-3">
        <img
          v-if="music.cover"
          :src="music.cover"
          alt=""
          loading="lazy"
          class="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
        <span v-else class="h-12 w-12 shrink-0 rounded-lg bg-indigo-100/70 dark:bg-indigo-900/30" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
            {{ music.name || `音乐 #${music.id}` }}
          </span>
          <span class="mt-0.5 block truncate text-xs text-gray-400">
            {{ music.artist ? `${music.artist} · ` : '' }}{{ music.platformName }}
          </span>
        </span>
      </div>
      <AudioPlayer v-if="music.url" :src="music.url">
        <template #fallback>
          <a
            :href="musicJumpHref"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-indigo-500 hover:underline"
          >
            前往收听 →
          </a>
        </template>
      </AudioPlayer>
      <a
        v-else
        :href="musicJumpHref"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-2 inline-block text-xs text-indigo-500 hover:underline"
      >
        前往收听 →
      </a>
    </div>

    <div v-else-if="extension.type === 'VIDEO'" class="p-4">
      <div v-if="video.videoId" class="relative aspect-video w-full overflow-hidden rounded-lg">
        <iframe
          v-if="video.type === 'bilibili'"
          :src="`https://player.bilibili.com/player.html?bvid=${video.videoId}&high_quality=1&danmaku=0`"
          class="absolute inset-0 h-full w-full"
          scrolling="no"
          border="0"
          frameborder="no"
          framespacing="0"
          allowfullscreen
        />
        <iframe
          v-else
          :src="`https://www.youtube-nocookie.com/embed/${video.videoId}`"
          class="absolute inset-0 h-full w-full"
          title="YouTube video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>
      <a
        v-if="video.url"
        :href="video.url"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-2 flex items-center justify-between gap-2 text-xs text-gray-400 hover:text-indigo-500"
      >
        <span class="truncate">{{ video.videoId ? displayDomain(video.url) : '前往原页面观看' }}</span>
        <span class="icon-[ph--arrow-up-right]" />
      </a>
    </div>

    <a
      v-else-if="extension.type === 'LOCATION' && location.name"
      :href="
        Number.isFinite(location.longitude) && Number.isFinite(location.latitude)
          ? `https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${encodeURIComponent(location.name)}`
          : undefined
      "
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-4 p-4 transition hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
    >
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-xl text-rose-500 dark:bg-rose-900/30 dark:text-rose-400">
        <span class="icon-[ph--map-pin]" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
          {{ location.name }}
        </span>
        <span v-if="Number.isFinite(location.latitude) && Number.isFinite(location.longitude)" class="mt-0.5 block text-xs text-gray-400">
          {{ location.latitude.toFixed(2) }}°, {{ location.longitude.toFixed(2) }}°
        </span>
      </span>
    </a>

    <a
      v-else-if="extension.type === 'TWEET' && tweet.url"
      :href="tweet.url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-4 p-4 transition hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
    >
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-xl text-sky-500 dark:bg-sky-900/30 dark:text-sky-400">
        <span class="icon-[ph--bird]" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">
          @{{ tweet.username || '推文' }}
        </span>
        <span class="mt-0.5 block truncate text-xs text-gray-400">
          {{ tweet.statusId ? `status/${tweet.statusId}` : displayDomain(tweet.url) }}
        </span>
      </span>
    </a>

    <div v-else class="p-4 text-xs text-gray-400">该扩展暂不支持预览</div>
  </div>
</template>