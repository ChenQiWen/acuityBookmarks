import type { useUIStore } from '@/stores/ui-store'
import type { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import type { EnhancedSearchResult } from '@/core/filter-engine'

import type { BookmarkNode } from '@/types'
import type { SmartRecommendation } from '@/services/smart-recommendation-engine'

/**
 * UI Store 类型别名，统一约束侧边栏引用的状态接口。
 */
export type UIStore = ReturnType<typeof useUIStore>

/**
 * Popup Store 类型别名，侧边栏共享弹窗统计状态时使用。
 */
export type PopupStore = ReturnType<typeof usePopupStoreIndexedDB>

/**
 * 侧边栏筛选结果项的数据结构，保留必要的书签字段与高亮信息。
 */
export interface SidePanelSearchItem {
  bookmark: {
    id: string
    title: string
    url?: string
    path?: string[]
  }
  score: number
  matchedFields: string[]
  highlights: EnhancedSearchResult['highlights']
}

/**
 * 书签更新事件详情，用于提示用户刷新侧边栏。
 */
export interface BookmarkUpdateDetail {
  eventType: string
  id: string
  [key: string]: unknown
}

/**
 * 智能推荐条目的简化类型别名，便于侧边栏函数签名引用。
 */
export type RecommendationItem = SmartRecommendation

export type { EnhancedSearchResult, BookmarkNode }
