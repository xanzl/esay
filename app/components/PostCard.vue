<script setup lang="ts">
const props = defineProps<{ post: Post; actions?: boolean }>()
const emit = defineEmits<{ edit: [post: Post]; delete: [post: Post]; like: [post: Post] }>()

const auth = useAuthStore()
const showActions = computed(() => props.actions !== false && auth.loggedIn)
</script>

<template>
  <article class="card flex flex-col gap-3">
    <div class="flex items-start gap-3">
      <Markdown v-if="post.content" :content="post.content" class="min-w-0 flex-1" />
      <div v-else-if="!post.images.length" class="flex-1 text-sm text-gray-400">（空内容）</div>
      <div v-if="showActions" class="flex shrink-0 gap-1">
        <button class="icon-btn" title="编辑" @click="emit('edit', post)">
          <span class="icon-[ph--pencil-simple]" />
        </button>
        <button class="icon-btn text-rose-500" title="删除" @click="emit('delete', post)">
          <span class="icon-[ph--trash]" />
        </button>
      </div>
    </div>

    <PostImageGrid v-if="post.images.length" :images="post.images" />

    <ExtensionCard v-if="post.extension" :extension="post.extension" />

    <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in post.tags"
        :key="tag.id"
        class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      >
        #{{ tag.name }}
      </span>
    </div>

    <div class="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
      <div class="flex items-center gap-1.5">
        <span v-if="post.private" class="icon-[ph--lock] text-sm text-amber-500" title="私密" />
        <span class="icon-[ph--calendar-blank] text-sm" />
        <time :datetime="formatDate(post.created_at)">{{ formatDate(post.created_at) }}</time>
        <span v-if="post.updated_at !== post.created_at">· 已编辑</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-6 items-center gap-1 rounded-full px-1 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="post.liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'"
          :title="post.liked ? '取消点赞' : '点赞'"
          :aria-label="post.liked ? '取消点赞' : '点赞'"
          @click="emit('like', post)"
        >
          <span class="icon-[lucide--thumbs-up] text-base" />
          <span v-if="post.like_count > 0">{{ post.like_count }}</span>
        </button>
        <NuxtLink
          :to="`/echo/${post.id}`"
          class="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-gray-100 hover:text-indigo-500 dark:hover:bg-gray-800"
          title="查看详情"
          :aria-label="`查看详情`"
        >
          <span class="icon-[mdi--arrow-right-bold-outline] text-lg" />
        </NuxtLink>
      </div>
    </div>
  </article>
</template>
