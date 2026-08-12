const PAGE_SIZE = 12
/** 逐条追加的节奏（ms），避免整批插入引发瀑布流大面积重排 */
const ITEM_APPEND_DELAY = 60

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const usePostsStore = defineStore('posts', {
  state: () => ({
    items: [] as Post[],
    cursor: null as string | null,
    hasMore: true,
    loading: false,
    initialized: false,
  }),

  actions: {
    async loadInitial() {
      this.items = []
      this.cursor = null
      this.hasMore = true
      this.initialized = false
      await this.loadMore()
    },

    async loadMore() {
      if (this.loading || !this.hasMore) return
      this.loading = true
      try {
        const { posts, nextCursor, hasMore } = await $fetch<{
          posts: Post[]
          nextCursor: string | null
          hasMore: boolean
        }>('/api/posts', { query: { cursor: this.cursor, limit: PAGE_SIZE } })
        if (Array.isArray(posts)) {
          // 逐条追加（瀑布流 append 路径不移动已有卡片）
          for (const post of posts) {
            this.items.push(post)
            await delay(ITEM_APPEND_DELAY)
          }
        }
        this.cursor = nextCursor
        this.hasMore = hasMore
      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    addPost(post: Post) {
      this.items.unshift(post)
    },

    updatePost(post: Post) {
      const index = this.items.findIndex((p) => p.id === post.id)
      if (index !== -1) this.items[index] = post
    },

    removePost(id: string) {
      this.items = this.items.filter((p) => p.id !== id)
    },

    setLike(id: string, liked: boolean, count: number) {
      const post = this.items.find((p) => p.id === id)
      if (post) {
        post.liked = liked
        post.like_count = count
      }
    },
  },
})
