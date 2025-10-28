/**
 * BookmarkSearch 组件类型定义
 *
 * 注意：本项目中使用"搜索"而非"搜索"
 * - 所有数据都在本地 IndexedDB
 * - 不存在网络请求
 * - 从已有集合中过滤符合条件的书签
 */

import type { EnhancedSearchResult } from '@/types/domain/search'
import type { BookmarkNode } from '@/types'

/**
 * BookmarkSearch Props
 */
export interface BookmarkSearchProps {
  /** 搜索条件（关键字） */
  query: string

  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 搜索（异步，高性能）
   * - memory: 从内存数据搜索（同步，适用于编辑中的数据或 LLM 返回的数据）
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 内存数据源
   * - mode='memory' 时必需
   * - 可以是已编辑的数据、LLM 返回的数据等
   */
  data?: BookmarkNode[]

  /** 搜索结果数量限制 */
  limit?: number

  /** 是否显示统计信息 */
  showStats?: boolean

  /** 树的高度 */
  treeHeight?: string | number

  /** 树的尺寸 */
  treeSize?: 'compact' | 'comfortable' | 'spacious'

  /** 是否可选择 */
  selectable?: boolean | 'single' | 'multiple'

  /** 是否可编辑 */
  editable?: boolean

  /** 是否启用虚拟滚动 */
  virtual?: boolean

  /** 是否显示工具栏 */
  showToolbar?: boolean

  /** 传递给 BookmarkTree 的额外 props */
  treeProps?: Record<string, unknown>

  /** 搜索选项 */
  filterOptions?: BookmarkSearchOptions
}

/**
 * 搜索选项
 */
export interface BookmarkSearchOptions {
  /** 是否启用模糊匹配 */
  fuzzy?: boolean

  /** 匹配阈值 (0-1) */
  threshold?: number

  /** 排序方式 */
  sortBy?: 'relevance' | 'title' | 'date'

  /** 是否过滤文件夹 */
  filterFolders?: boolean
}

/**
 * BookmarkSearch Emits
 */
export interface BookmarkSearchEmits {
  /** 搜索完成 */
  (event: 'filter-complete', results: EnhancedSearchResult[]): void

  /** 搜索错误 */
  (event: 'filter-error', error: Error): void

  /** 节点点击 */
  (event: 'node-click', node: BookmarkNode, mouseEvent: MouseEvent): void

  /** 节点选择 */
  (
    event: 'node-select',
    id: string,
    node: BookmarkNode,
    selected: boolean
  ): void

  /** 选择变更 */
  (event: 'selection-change', ids: string[], nodes: BookmarkNode[]): void
}

/**
 * BookmarkSearch Expose 方法
 */
export interface BookmarkSearchExpose {
  /** 手动触发搜索 */
  filter: (query: string) => Promise<void>

  /** 获取当前搜索结果 */
  getResults: () => EnhancedSearchResult[]

  /** 获取转换后的节点 */
  getNodes: () => BookmarkNode[]

  /** 是否正在搜索 */
  isFiltering: () => boolean
}
