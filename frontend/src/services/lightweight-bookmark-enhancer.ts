/**
 * 轻量级书签增强器（重构版）
 *
 * 职责：
 * - 提供便捷的爬取 API
 * - 委托给新的本地爬虫服务
 * - 保持向后兼容
 *
 * ⚠️ 已废弃独立 IndexedDB，统一使用 AcuityBookmarksDB
 */

import {
  crawlSingleBookmark,
  crawlMultipleBookmarks,
  getBookmarkMetadata
} from './local-bookmark-crawler'
import { logger } from '@/infrastructure/logging/logger'
import type { CrawlMetadataRecord } from '@/infrastructure/indexeddb/schema'

/**
 * @deprecated 使用 CrawlMetadataRecord 替代
 */
export interface LightweightBookmarkMetadata {
  // Chrome书签字段
  id: string
  url: string
  title: string
  dateAdded?: number
  dateLastUsed?: number
  parentId?: string

  // 爬取增强字段
  extractedTitle: string
  description: string
  keywords: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogSiteName: string

  // 缓存管理字段
  lastCrawled: number
  crawlSuccess: boolean
  expiresAt: number
  crawlCount: number
  finalUrl: string
  lastModified: string

  // 爬取状态
  crawlStatus: {
    lastCrawled: number
    status: 'success' | 'failed'
    crawlDuration?: number
    version: number
    source: string
    finalUrl?: string
    httpStatus?: number
    error?: string
  }
}

/**
 * 轻量级书签增强器（简化版）
 */
export class LightweightBookmarkEnhancer {
  /**
   * 增强单个书签
   * @deprecated 使用 crawlSingleBookmark 替代
   */
  async enhanceBookmark(
    bookmark: chrome.bookmarks.BookmarkTreeNode
  ): Promise<LightweightBookmarkMetadata> {
    logger.warn(
      'LightweightEnhancer',
      '⚠️ enhanceBookmark 已废弃，请使用 crawlSingleBookmark'
    )

    await crawlSingleBookmark(bookmark)

    // 获取爬取结果
    const metadata = await getBookmarkMetadata(bookmark.id)

    // 转换为旧格式（向后兼容）
    return this.convertToLegacyFormat(bookmark, metadata)
  }

  /**
   * 批量增强书签
   * @deprecated 使用 crawlMultipleBookmarks 替代
   */
  async enhanceBookmarks(
    bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  ): Promise<LightweightBookmarkMetadata[]> {
    logger.warn(
      'LightweightEnhancer',
      '⚠️ enhanceBookmarks 已废弃，请使用 crawlMultipleBookmarks'
    )

    await crawlMultipleBookmarks(bookmarks)

    // 返回空数组（不再返回结果列表）
    return []
  }

  /**
   * 转换为旧格式（向后兼容）
   */
  private convertToLegacyFormat(
    bookmark: chrome.bookmarks.BookmarkTreeNode,
    metadata: CrawlMetadataRecord | null
  ): LightweightBookmarkMetadata {
    if (!metadata) {
      // 返回空元数据
      return {
        id: bookmark.id,
        url: bookmark.url || '',
        title: bookmark.title || '',
        extractedTitle: '',
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
        ogSiteName: '',
        lastCrawled: 0,
        crawlSuccess: false,
        expiresAt: 0,
        crawlCount: 0,
        finalUrl: bookmark.url || '',
        lastModified: '',
        crawlStatus: {
          lastCrawled: 0,
          status: 'failed',
          version: 2,
          source: 'local-crawler'
        }
      }
    }

    return {
      id: bookmark.id,
      url: bookmark.url || '',
      title: bookmark.title || '',
      dateAdded: bookmark.dateAdded,
      dateLastUsed: bookmark.dateLastUsed,
      parentId: bookmark.parentId,
      extractedTitle: metadata.pageTitle || '',
      description: metadata.description || '',
      keywords: metadata.keywords || '',
      ogTitle: metadata.ogTitle || '',
      ogDescription: metadata.ogDescription || '',
      ogImage: metadata.ogImage || '',
      ogSiteName: metadata.ogSiteName || '',
      lastCrawled: metadata.lastCrawled || 0,
      crawlSuccess: metadata.crawlSuccess || false,
      expiresAt: metadata.updatedAt + 30 * 24 * 60 * 60 * 1000,
      crawlCount: metadata.crawlCount || 1,
      finalUrl: metadata.finalUrl || bookmark.url || '',
      lastModified: new Date(metadata.updatedAt).toISOString(),
      crawlStatus: {
        lastCrawled: metadata.lastCrawled || 0,
        status:
          (metadata.status === 'partial' ? 'failed' : metadata.status) ||
          'failed',
        crawlDuration: metadata.crawlDuration,
        version: 2,
        source: 'local-crawler',
        finalUrl: metadata.finalUrl,
        httpStatus: metadata.httpStatus
      }
    }
  }

  /**
   * 获取缓存统计（向后兼容）
   * @deprecated 使用 getCrawlStatistics 替代
   */
  async getCacheStats(): Promise<{
    total: number
    expired: number
    successful: number
    failed: number
  }> {
    const { getCrawlStatistics } = await import('./local-bookmark-crawler')
    const stats = await getCrawlStatistics()

    return {
      total: stats.total,
      expired: stats.expired,
      successful: stats.withMetadata - stats.failed,
      failed: stats.failed
    }
  }

  /**
   * 保存到缓存（向后兼容）
   * @deprecated 数据自动保存，无需手动调用
   */
  async saveToCache(_metadata: LightweightBookmarkMetadata): Promise<void> {
    logger.warn('LightweightEnhancer', '⚠️ saveToCache 已废弃，数据自动保存')
    // 不需要做任何事情，数据会自动保存
  }
}

// 导出单例（向后兼容）
export const lightweightBookmarkEnhancer = new LightweightBookmarkEnhancer()
