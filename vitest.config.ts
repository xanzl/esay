import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // PG 集成测试连接 Neon 免费层冷启动较慢，放宽单测超时
    testTimeout: 120000,
  },
})
