/**
 * Vitest 全局配置文件
 *
 * 职责：
 * - 导入测试工具库
 * - Mock 浏览器 API
 * - 配置全局测试环境
 */

import '@testing-library/jest-dom'
import { vi } from 'vitest'

/**
 * Mock Chrome API
 *
 * Chrome 扩展 API 在测试环境中不可用，需要 Mock
 */
global.chrome = {
  runtime: {
    getURL: vi.fn(
      (path: string) => `chrome-extension://test-extension-id/${path}`
    ),
    sendMessage: vi.fn(() => Promise.resolve({ success: true })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve())
    }
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({ id: 1 })),
    update: vi.fn(() => Promise.resolve({ id: 1 }))
  },
  bookmarks: {
    getTree: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({ id: '1' })),
    update: vi.fn(() => Promise.resolve({ id: '1' })),
    remove: vi.fn(() => Promise.resolve()),
    move: vi.fn(() => Promise.resolve({ id: '1' })),
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onMoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
} as unknown as typeof chrome

/**
 * Mock IndexedDB
 *
 * 使用内存模拟，避免真实数据库操作
 */
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(() => Promise.resolve([])),
  cmp: vi.fn()
} as unknown as IDBFactory

/**
 * Mock console 方法（避免测试输出污染）
 */
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

/**
 * 重置所有 Mock（在每个测试后自动调用）
 */
afterEach(() => {
  vi.clearAllMocks()
})
