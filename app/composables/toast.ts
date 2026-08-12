export function useToast() {
  const ui = useUiStore()

  return {
    success(message: string) {
      ui.pushToast({ message, type: 'success' })
    },
    error(message: string) {
      ui.pushToast({ message, type: 'error' })
    },
    info(message: string) {
      ui.pushToast({ message, type: 'info' })
    },
  }
}
