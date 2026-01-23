import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests/visual',

  // 截图对比配置
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // 允许 100 像素差异
      threshold: 0.2 // 20% 容差
    }
  },

  // 并行测试
  fullyParallel: true,

  // 失败重试
  retries: process.env.CI ? 2 : 0,

  // 超时
  timeout: 30000,

  use: {
    // 基础 URL
    baseURL: 'http://localhost:5173',

    // 截图
    screenshot: 'only-on-failure',

    // 视频
    video: 'retain-on-failure',

    // Trace
    trace: 'on-first-retry'
  },

  // 测试项目（不同浏览器）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // 开发服务器
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
