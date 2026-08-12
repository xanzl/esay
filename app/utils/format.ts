export function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function getErrorMessage(error: unknown): string {
  const err = error as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  } | undefined
  return (
    err?.data?.statusMessage
    ?? err?.data?.message
    ?? err?.statusMessage
    ?? err?.message
    ?? '请求失败，请稍后再试'
  )
}
