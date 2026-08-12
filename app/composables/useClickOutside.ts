/**
 * 点击元素外部时触发回调（用于弹出容器/按钮的关闭行为）。
 * 后续其它弹出式按钮统一复用：const root = ref<HTMLElement|null>(null); useClickOutside(root, close)
 */
export function useClickOutside(target: Ref<HTMLElement | null>, onOutside: () => void) {
  function onDocumentClick(event: MouseEvent) {
    const el = target.value
    if (!el) return
    if (event.target instanceof Node && !el.contains(event.target)) {
      onOutside()
    }
  }

  onMounted(() => document.addEventListener('click', onDocumentClick))
  onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
}