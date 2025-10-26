/**
 * 测试工具函数
 *
 * 职责：
 * - 提供常用的测试辅助函数
 * - 简化测试代码编写
 * - 统一测试模式
 */

import { render } from '@testing-library/vue'
import { createPinia, type Pinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '@/infrastructure/query/query-client'
import type { Component, App } from 'vue'
import { vi } from 'vitest'

/**
 * 扩展的渲染选项
 */
interface CustomRenderOptions {
  /** 组件 props */
  props?: Record<string, unknown>

  /** 是否提供 Pinia（默认：true） */
  withPinia?: boolean

  /** 是否提供 TanStack Query（默认：true） */
  withQuery?: boolean

  /** 自定义 Pinia 实例 */
  pinia?: Pinia

  /** 其他渲染选项 */
  global?: Record<string, unknown>
}

/**
 * 渲染 Vue 组件（with Pinia + Query Client）
 *
 * @param component - Vue 组件
 * @param options - 渲染选项
 * @returns 渲染结果 + 额外工具
 *
 * @example
 * ```typescript
 * const { getByText, store } = renderWithProviders(MyComponent, {
 *   props: { title: 'Test' }
 * })
 * ```
 */
export function renderWithProviders(
  component: Component,
  options: CustomRenderOptions = {}
) {
  const {
    withPinia = true,
    withQuery = true,
    pinia = createPinia(),
    ...renderOptions
  } = options

  // 使用 Plugin 类型替代 any
  const plugins: Array<{ install: (app: App) => void }> = []

  if (withPinia) {
    plugins.push({
      install: (app: App) => {
        app.use(pinia)
      }
    })
  }

  if (withQuery) {
    plugins.push({
      install: (app: App) => {
        app.use(VueQueryPlugin, { queryClient })
      }
    })
  }

  // 安全类型转换，明确说明原因
  const globalOptions = renderOptions.global || {}

  // 类型安全地提取 plugins
  interface PluginType {
    install: (app: App) => void
  }
  const existingPlugins = ((globalOptions as { plugins?: PluginType[] })
    .plugins || []) as PluginType[]

  const result = render(component, {
    props: renderOptions.props,
    global: {
      ...globalOptions,
      plugins: [...plugins, ...existingPlugins] as PluginType[]
    }
  })

  return {
    ...result,
    pinia: withPinia ? pinia : undefined
  }
}

/**
 * 等待异步更新完成
 *
 * @param ms - 等待毫秒数（默认：0）
 *
 * @example
 * ```typescript
 * await waitFor(100)
 * ```
 */
export function waitFor(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建 Mock 书签节点
 *
 * @param overrides - 覆盖的属性
 * @returns Mock 书签对象
 *
 * @example
 * ```typescript
 * const bookmark = createMockBookmark({
 *   title: 'Test Bookmark',
 *   url: 'https://test.com'
 * })
 * ```
 */
export function createMockBookmark(
  overrides: Partial<{
    id: string
    title: string
    url: string
    parentId: string
    dateAdded: number
    isFolder: boolean
    childrenCount: number
    children?: unknown[]
  }> = {}
) {
  return {
    id: '1',
    title: 'Test Bookmark',
    url: 'https://example.com',
    parentId: '0',
    index: 0,
    dateAdded: Date.now(),
    children: [],
    ...overrides
  }
}

/**
 * 创建 Mock 书签树
 *
 * @returns Mock 书签树
 *
 * @example
 * ```typescript
 * const tree = createMockBookmarkTree()
 * // tree[0] = 书签栏
 * // tree[0].children[0] = 第一个书签
 * ```
 */
export function createMockBookmarkTree() {
  return [
    {
      id: '1',
      title: '书签栏',
      parentId: '0',
      index: 0,
      dateAdded: Date.now(),
      children: [
        createMockBookmark({
          id: '2',
          title: 'Google',
          url: 'https://google.com',
          parentId: '1'
        }),
        createMockBookmark({
          id: '3',
          title: 'GitHub',
          url: 'https://github.com',
          parentId: '1'
        })
      ]
    }
  ]
}

/**
 * Mock IndexedDB 操作
 *
 * @example
 * ```typescript
 * const { mockGetAll, mockInsert } = mockIndexedDB()
 *
 * mockGetAll.mockResolvedValue([bookmark1, bookmark2])
 * ```
 */
export function mockIndexedDB() {
  return {
    mockGetAll: vi.fn(),
    mockGetById: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn()
  }
}

/**
 * Mock Chrome API
 *
 * @example
 * ```typescript
 * const { mockCreate, mockUpdate } = mockChromeAPI()
 *
 * mockCreate.mockResolvedValue({ id: '123' })
 * ```
 */
export function mockChromeAPI() {
  return {
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockRemove: vi.fn(),
    mockGetTree: vi.fn(),
    mockSendMessage: vi.fn()
  }
}
