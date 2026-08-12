#!/usr/bin/env node
/**
 * D1 / PG 双 repo 方法签名一致性检查。
 * 两套 DbRepo 实现（repo.d1.ts / repo.pg.ts）必须保持相同的方法集合，
 * 防止新增/删除功能时只改了一边导致另一平台静默缺失。
 * 不一致时退出码非 0（供 CI 拦截）。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function extractMethods(file) {
  const src = readFileSync(resolve(root, file), 'utf8')
  // 捕获 repo 对象内的 async 方法：`async name(` 或 `async name <generic>(`
  const methods = new Set()
  const bodyStart = src.indexOf('return {')
  const body = bodyStart >= 0 ? src.slice(bodyStart) : src
  for (const m of body.matchAll(/\basync\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/g)) {
    methods.add(m[1])
  }
  return methods
}

const d1 = extractMethods('server/db/repo.d1.ts')
const pg = extractMethods('server/db/repo.pg.ts')

const onlyD1 = [...d1].filter((m) => !pg.has(m)).sort()
const onlyPg = [...pg].filter((m) => !d1.has(m)).sort()

if (onlyD1.length === 0 && onlyPg.length === 0) {
  console.log(`repo parity OK: ${d1.size} methods identical (D1 = PG)`)
  process.exit(0)
}

console.error('D1/PG repo 方法集合不一致：')
if (onlyD1.length) console.error(`  仅 D1 有：${onlyD1.join(', ')}`)
if (onlyPg.length) console.error(`  仅 PG 有：${onlyPg.join(', ')}`)
console.error('请在两边同步实现后再提交（新增功能时务必双改）')
process.exit(1)
