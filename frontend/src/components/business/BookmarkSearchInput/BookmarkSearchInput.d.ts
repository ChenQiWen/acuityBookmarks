import type { BookmarkNode } from '@/types'

/**
 * BookmarkSearchInput 组件 Props
 */
export interface BookmarkSearchInputProps {
  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 搜索（默认）
   * - memory: 从内存数据搜索
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 内存数据源（mode='memory' 时使用）
   */
  data?: BookmarkNode[]

  /**
   * 搜索结果数量限制
   * @default 100
   */
  limit?: number

  /**
   * 防抖延迟（毫秒）
   * @default 300
   */
  debounce?: number

  /**
   * 是否禁用
   */
  disabled?: boolean

  /**
   * 是否显示统计信息
   */
  showStats?: boolean

  /**
   * 初始搜索关键词
   */
  initialQuery?: string
}

/**
 * BookmarkSearchInput 组件 Emits
 */
export interface BookmarkSearchInputEmits {
  /**
   * 搜索完成事件
   * @param results - 搜索结果（标准书签树结构）
   */
  'search-complete': [results: BookmarkNode[]]

  /**
   * 搜索开始事件
   * @param query - 搜索关键词
   */
  'search-start': [query: string]

  /**
   * 搜索错误事件
   * @param error - 错误对象
   */
  'search-error': [error: Error]

  /**
   * 搜索清空事件
   */
  'search-clear': []
}

/**
 * BookmarkSearchInput 组件暴露的方法
 */
export interface BookmarkSearchInputExpose {
  /**
   * 手动触发搜索
   * @param query - 搜索关键词
   */
  search: (query: string) => Promise<void>

  /**
   * 获取当前搜索结果
   */
  getResults: () => BookmarkNode[]

  /**
   * 清空搜索
   */
  clear: () => void

  /**
   * 是否正在搜索
   */
  isSearching: Ref<boolean>

  /**
   * 总结果数
   */
  totalResults: Ref<number>
}
