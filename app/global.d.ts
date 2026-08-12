interface TurnstileWidget {
  render: (container: HTMLElement, options: Record<string, unknown>) => string | number
  reset: (widgetId: string | number) => void
  remove: (widgetId: string | number) => void
  getResponse: (widgetId: string | number) => string | undefined
}

interface Window {
  turnstile?: TurnstileWidget
  L?: unknown
}
