const STORAGE_KEY = 'moment-theme'

export type Theme = 'light' | 'dark'

function detectTheme(): Theme {
  if (import.meta.client) {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  }
  return 'light'
}

export function useTheme() {
  const theme = useState<Theme>('theme', () => detectTheme())

  function apply(value: Theme) {
    document.documentElement.classList.toggle('dark', value === 'dark')
  }

  function init() {
    if (import.meta.client) apply(theme.value)
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    if (import.meta.client) {
      apply(theme.value)
      localStorage.setItem(STORAGE_KEY, theme.value)
    }
  }

  return { theme, init, toggle }
}
