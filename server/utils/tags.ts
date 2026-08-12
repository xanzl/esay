export const MAX_TAGS_PER_POST = 10
export const MAX_TAG_LENGTH = 20

/** 归一化标签名数组：trim、去重、限长、限量 */
export function normalizeTagNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const name = String(item ?? '').trim()
    if (!name || name.length > MAX_TAG_LENGTH || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= MAX_TAGS_PER_POST) break
  }
  return out
}