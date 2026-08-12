export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0

export const useUiStore = defineStore('ui', {
  state: () => ({
    showLogin: false,
    showSearch: false,
    editingPost: null as Post | null,
    /** 编辑弹窗最近一次保存成功的时间戳（详情页据此刷新数据） */
    editorSavedAt: 0,
    toasts: [] as ToastItem[],
  }),

  actions: {
    openLogin() {
      this.showLogin = true
    },
    closeLogin() {
      this.showLogin = false
    },
    openSearch() {
      this.showSearch = true
    },
    closeSearch() {
      this.showSearch = false
    },
    openEditor(post: Post) {
      this.editingPost = post
    },
    closeEditor() {
      this.editingPost = null
    },
    markEditorSaved() {
      this.editorSavedAt = Date.now()
    },
    pushToast(item: Omit<ToastItem, 'id'>) {
      const id = ++toastId
      this.toasts.push({ ...item, id })
      setTimeout(() => this.removeToast(id), 3200)
    },
    removeToast(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
