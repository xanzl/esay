/**
 * 无限滚动：监听目标元素进入视口后触发回调
 */
export function useInfiniteScroll(target: Ref<HTMLElement | null>, onReach: () => void) {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!import.meta.client || !target.value) return
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onReach()
      },
      { rootMargin: '200px' },
    )
    observer.observe(target.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })
}
