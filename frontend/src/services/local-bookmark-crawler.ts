/**
 * 🎯 本地书签爬虫服务（统一入口）
 *
 * 职责：
 * - 本地爬取（Offscreen Document）
 * - 数据保存（统一 IndexedDB）
 * - 关联更新（bookmarks 表）
 * - 任务调度（队列、并发）
 *
 * 隐私保护：
 * - 100% 客户端执行
 * - 零数据上传
 * - 数据本地存储
 */

import {
  crawlBookmarkLocally,
  type CrawlResult,
  type PageMetadata
} from './local-crawler-worker'
import {
  crawlTaskScheduler,
  type CrawlOptions,
  type CrawlTask
} from './crawl-task-scheduler'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { CrawlMetadataRecord } from '@/infrastructure/indexeddb/schema'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'

// ==================== 数据保存 ====================

/**
 * 保存爬取结果到 IndexedDB
 */
export async function saveCrawlResult(
  bookmarkId: string,
  url: string,
  result: CrawlResult
): Promise<void> {
  try {
    logger.info('CrawlSaver', `💾 准备保存: ${url}`)

    if (!result.success || !result.metadata) {
      // 保存失败记录
      logger.warn('CrawlSaver', `⚠️ 爬取失败，保存失败记录: ${url}`)
      await saveCrawlFailure(bookmarkId, url, result)
      return
    }

    const metadata = result.metadata
    logger.debug(
      'CrawlSaver',
      `📝 元数据: title="${metadata.title}", desc="${metadata.description?.substring(0, 50)}..."`
    )

    // 1. 构建 CrawlMetadataRecord
    const crawlRecord: CrawlMetadataRecord = {
      // 关联字段
      bookmarkId,
      url,
      finalUrl: result.url,
      domain: extractDomain(result.url),

      // 元数据字段
      pageTitle: metadata.title,
      description: metadata.description,
      keywords: metadata.keywords,
      ogTitle: metadata.ogTitle,
      ogDescription: metadata.ogDescription,
      ogImage: metadata.ogImage,
      ogSiteName: metadata.ogSiteName,
      faviconUrl: metadata.iconHref,

      // 状态字段
      source: 'crawler',
      status: 'success',
      httpStatus: result.httpStatus,
      statusGroup: getStatusGroup(result.httpStatus),
      robotsAllowed: result.robotsAllowed,
      crawlSuccess: true,
      crawlCount: 1,
      lastCrawled: Date.now(),
      crawlDuration: result.duration,

      // 维护字段
      updatedAt: Date.now(),
      version: '2.0'
    }

    // 2. 保存到 crawlMetadata 表
    logger.debug('CrawlSaver', `📥 写入 IndexedDB crawlMetadata: ${bookmarkId}`)
    await indexedDBManager.saveCrawlMetadata(crawlRecord)

    // 3. 更新 bookmarks 表的关联字段
    logger.debug('CrawlSaver', `🔗 更新 bookmarks 表关联字段: ${bookmarkId}`)
    await updateBookmarkMetadataFields(bookmarkId, metadata)

    logger.info('CrawlSaver', `✅ 保存成功: ${url} (title: ${metadata.title})`)
  } catch (error) {
    logger.error('CrawlSaver', `❌ 保存失败: ${url}`, error)
    throw error
  }
}

/**
 * 保存失败记录
 */
async function saveCrawlFailure(
  bookmarkId: string,
  url: string,
  result: CrawlResult
): Promise<void> {
  const crawlRecord: CrawlMetadataRecord = {
    bookmarkId,
    url,
    domain: extractDomain(url),

    // 失败状态
    source: 'crawler',
    status: 'failed',
    httpStatus: result.httpStatus || 0,
    statusGroup: result.httpStatus
      ? getStatusGroup(result.httpStatus)
      : 'error',
    robotsAllowed: result.robotsAllowed,
    crawlSuccess: false,
    crawlCount: 1,
    lastCrawled: Date.now(),
    crawlDuration: result.duration,

    // 维护字段
    updatedAt: Date.now(),
    version: '2.0'
  }

  await indexedDBManager.saveCrawlMetadata(crawlRecord)

  // ✅ 步骤2：标记失效书签（HTTP错误：404/500等）
  if (result.httpStatus && result.httpStatus >= 400) {
    await indexedDBManager.markBookmarkAsInvalid(
      bookmarkId,
      'http_error',
      result.httpStatus
    )
    logger.info(
      'CrawlSaver',
      `🚫 已标记为失效书签: ${url} (HTTP ${result.httpStatus})`
    )
  }

  logger.warn('CrawlSaver', `⚠️ 保存失败记录: ${url} - ${result.error}`)
}

/**
 * 更新 bookmarks 表的元数据关联字段
 */
async function updateBookmarkMetadataFields(
  bookmarkId: string,
  metadata: PageMetadata
): Promise<void> {
  try {
    // ✅ 确保 IndexedDB 已初始化
    await indexedDBManager.initialize()

    const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
    if (!bookmark) {
      logger.warn('CrawlSaver', `书签不存在: ${bookmarkId}`)
      return
    }

    // 更新派生字段（用于筛选增强）
    const updatedBookmark: BookmarkRecord = {
      ...bookmark,
      // 关联字段
      hasMetadata: true,
      metadataUpdatedAt: Date.now(),
      metadataSource: 'crawler',

      // 派生字段（小写，用于筛选）
      metaTitleLower: (metadata.title || '').toLowerCase(),
      metaDescriptionLower: (metadata.description || '').toLowerCase(),
      metaKeywordsTokens: metadata.keywords
        ? metadata.keywords
            .toLowerCase()
            .split(/[,\s]+/)
            .filter(Boolean)
        : [],

      // 筛选权重提升
      metaBoost: calculateMetadataBoost(metadata)
    }

    await indexedDBManager.updateBookmark(updatedBookmark)

    logger.debug('CrawlSaver', `✅ 更新书签元数据字段: ${bookmarkId}`)
  } catch (error) {
    logger.error('CrawlSaver', `❌ 更新书签字段失败: ${bookmarkId}`, error)
  }
}

/**
 * 计算元数据筛选权重
 */
function calculateMetadataBoost(metadata: PageMetadata): number {
  let boost = 1.0

  // 有标题 +0.2
  if (metadata.title) boost += 0.2

  // 有描述 +0.2
  if (metadata.description) boost += 0.2

  // 有关键词 +0.1
  if (metadata.keywords) boost += 0.1

  // 有 OG 数据 +0.1
  if (metadata.ogTitle || metadata.ogDescription) boost += 0.1

  return boost
}

/**
 * 提取域名
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * 获取 HTTP 状态分组
 */
function getStatusGroup(status?: number): CrawlMetadataRecord['statusGroup'] {
  if (!status) return 'error'
  if (status >= 200 && status < 300) return '2xx'
  if (status >= 300 && status < 400) return '3xx'
  if (status >= 400 && status < 500) return '4xx'
  if (status >= 500) return '5xx'
  return 'error'
}

// ==================== 高级 API ====================

/**
 * 爬取单个书签
 *
 * @param bookmark - 书签对象
 * @param options - 爬取选项
 */
export async function crawlSingleBookmark(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  options?: {
    respectRobots?: boolean
    timeout?: number
    force?: boolean // 强制重新爬取，忽略缓存
  }
): Promise<void> {
  if (!bookmark.url) {
    logger.warn('LocalCrawler', '书签URL为空')
    return
  }

  // 检查是否需要爬取
  if (!options?.force) {
    const needs = await needsCrawl(bookmark.id)
    if (!needs) {
      logger.debug(
        'LocalCrawler',
        `书签无需爬取（已有最新数据）: ${bookmark.url}`
      )
      return
    }
  }

  logger.info('LocalCrawler', `🚀 开始爬取: ${bookmark.url}`)

  try {
    const result = await crawlBookmarkLocally(bookmark.url, {
      respectRobots: options?.respectRobots ?? true,
      timeout: options?.timeout ?? 10000
    })

    await saveCrawlResult(bookmark.id, bookmark.url, result)

    logger.info('LocalCrawler', `✅ 爬取完成: ${bookmark.url}`)
  } catch (error) {
    logger.error('LocalCrawler', `❌ 爬取异常: ${bookmark.url}`, error)
    throw error
  }
}

/**
 * 批量爬取书签（使用任务调度器）
 *
 * @param bookmarks - 书签列表
 * @param options - 爬取选项
 */
export async function crawlMultipleBookmarks(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  options?: CrawlOptions & {
    skipExisting?: boolean // 跳过已有元数据的书签
  }
): Promise<void> {
  let targetBookmarks = bookmarks.filter(
    b => b.url && !b.url.startsWith('chrome://')
  )

  // ✅ 优先过滤：跳过已标记为失效的书签（URL格式错误）
  const validBookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
  let skippedInvalidCount = 0

  for (const bookmark of targetBookmarks) {
    const bookmarkRecord = await indexedDBManager.getBookmarkById(bookmark.id)
    if (bookmarkRecord?.isInvalid) {
      skippedInvalidCount++
      logger.debug(
        'LocalCrawler',
        `⏭️ 跳过失效书签: ${bookmark.url} (${bookmarkRecord.invalidReason})`
      )
      continue
    }
    validBookmarks.push(bookmark)
  }

  targetBookmarks = validBookmarks

  if (skippedInvalidCount > 0) {
    logger.info('LocalCrawler', `🚫 已跳过 ${skippedInvalidCount} 个失效书签`)
  }

  // 过滤已有元数据的书签
  if (options?.skipExisting) {
    const filtered: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const bookmark of targetBookmarks) {
      const needs = await needsCrawl(bookmark.id)
      if (needs) {
        filtered.push(bookmark)
      }
    }
    targetBookmarks = filtered

    logger.info(
      'LocalCrawler',
      `📋 过滤后需要爬取: ${filtered.length}/${bookmarks.length}`
    )
  }

  if (targetBookmarks.length === 0) {
    logger.info('LocalCrawler', '没有需要爬取的书签')
    return
  }

  logger.info('LocalCrawler', `🚀 批量爬取: ${targetBookmarks.length} 个书签`)

  await crawlTaskScheduler.scheduleBookmarksCrawl(targetBookmarks, {
    ...options,
    onTaskComplete: async (task: CrawlTask) => {
      if (task.result) {
        try {
          await saveCrawlResult(task.bookmarkId, task.url, task.result)

          // 原有的回调
          options?.onTaskComplete?.(task)
        } catch (error) {
          logger.error('LocalCrawler', `保存任务结果失败: ${task.url}`, error)
        }
      }
    }
  })
}

/**
 * 获取书签的爬取元数据
 *
 * @param bookmarkId - 书签ID
 * @returns 爬取元数据，如果不存在则返回 null
 */
export async function getBookmarkMetadata(
  bookmarkId: string
): Promise<CrawlMetadataRecord | null> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()
  return await indexedDBManager.getCrawlMetadata(bookmarkId)
}

/**
 * 批量获取书签的爬取元数据
 *
 * @param bookmarkIds - 书签ID列表
 * @returns Map<书签ID, 爬取元数据>
 */
export async function getBatchBookmarkMetadata(
  bookmarkIds: string[]
): Promise<Map<string, CrawlMetadataRecord>> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()
  return await indexedDBManager.getBatchCrawlMetadata(bookmarkIds)
}

/**
 * 检查书签是否需要爬取
 *
 * @param bookmarkId - 书签ID
 * @returns 是否需要爬取
 */
export async function needsCrawl(bookmarkId: string): Promise<boolean> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()

  const metadata = await indexedDBManager.getCrawlMetadata(bookmarkId)

  // 没有元数据，需要爬取
  if (!metadata) return true

  // 爬取失败，需要重试（1天后）
  if (!metadata.crawlSuccess) {
    const daysSinceLastCrawl =
      (Date.now() - (metadata.lastCrawled || 0)) / (1000 * 60 * 60 * 24)
    return daysSinceLastCrawl > 1
  }

  // 成功但过期（30天），需要刷新
  const daysSinceUpdate =
    (Date.now() - metadata.updatedAt) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate > 30
}

/**
 * 获取需要爬取的书签列表
 * ✅ 符合单向数据流：从 IndexedDB 读取
 *
 * @returns 需要爬取的书签列表
 */
export async function getBookmarksNeedingCrawl(): Promise<BookmarkRecord[]> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()

  // ✅ 从 IndexedDB 获取所有书签
  const allBookmarks = await indexedDBManager.getAllBookmarks()

  const needsCrawlList: BookmarkRecord[] = []

  for (const bookmark of allBookmarks) {
    if (!bookmark.url || bookmark.url.startsWith('chrome://')) continue

    const needs = await needsCrawl(bookmark.id)
    if (needs) {
      needsCrawlList.push(bookmark)
    }
  }

  logger.info(
    'LocalCrawler',
    `📋 需要爬取的书签: ${needsCrawlList.length}/${allBookmarks.length}`
  )

  return needsCrawlList
}

/**
 * 强制刷新书签元数据
 * ✅ 符合单向数据流：从 IndexedDB 读取
 *
 * @param bookmarkId - 书签ID
 */
export async function forceRefreshBookmark(bookmarkId: string): Promise<void> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()

  // ✅ 从 IndexedDB 获取书签
  const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
  if (!bookmark) {
    throw new Error(`书签不存在: ${bookmarkId}`)
  }

  // 转换为 Chrome 书签格式（crawlSingleBookmark 需要）
  const chromeBookmark = {
    id: bookmark.id,
    parentId: bookmark.parentId,
    title: bookmark.title || '',
    url: bookmark.url,
    dateAdded: bookmark.dateAdded,
    dateGroupModified: bookmark.dateGroupModified,
    index: bookmark.index
  } as chrome.bookmarks.BookmarkTreeNode

  await crawlSingleBookmark(chromeBookmark, { force: true })
}

/**
 * 删除书签的爬取元数据
 *
 * @param bookmarkId - 书签ID
 */
export async function deleteBookmarkMetadata(
  bookmarkId: string
): Promise<void> {
  try {
    // ✅ 确保 IndexedDB 已初始化
    await indexedDBManager.initialize()

    // 1. 删除 crawlMetadata 表中的记录
    await indexedDBManager.deleteCrawlMetadata(bookmarkId)

    // 2. 更新 bookmarks 表的关联字段
    const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
    if (bookmark) {
      const updatedBookmark: BookmarkRecord = {
        ...bookmark,
        hasMetadata: false,
        metadataUpdatedAt: undefined,
        metadataSource: undefined,
        metaTitleLower: undefined,
        metaDescriptionLower: undefined,
        metaKeywordsTokens: undefined,
        metaBoost: undefined
      }
      await indexedDBManager.updateBookmark(updatedBookmark)
    }

    logger.info('LocalCrawler', `✅ 删除元数据: ${bookmarkId}`)
  } catch (error) {
    logger.error('LocalCrawler', `❌ 删除元数据失败: ${bookmarkId}`, error)
    throw error
  }
}

/**
 * 获取爬取统计信息
 * ✅ 符合单向数据流：从 IndexedDB 读取
 */
export async function getCrawlStatistics(): Promise<{
  total: number
  withMetadata: number
  withoutMetadata: number
  failed: number
  expired: number
}> {
  // ✅ 确保 IndexedDB 已初始化
  await indexedDBManager.initialize()

  // ✅ 从 IndexedDB 获取所有书签
  const allBookmarks = await indexedDBManager.getAllBookmarks()

  let withMetadata = 0
  let withoutMetadata = 0
  let failed = 0
  let expired = 0

  for (const bookmark of allBookmarks) {
    if (!bookmark.url || bookmark.url.startsWith('chrome://')) continue

    const metadata = await indexedDBManager.getCrawlMetadata(bookmark.id)

    if (!metadata) {
      withoutMetadata++
    } else if (!metadata.crawlSuccess) {
      failed++
      withMetadata++
    } else {
      withMetadata++

      // 检查是否过期
      const daysSinceUpdate =
        (Date.now() - metadata.updatedAt) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate > 30) {
        expired++
      }
    }
  }

  const urlBookmarks = allBookmarks.filter(
    b => b.url && !b.url.startsWith('chrome://')
  )

  return {
    total: urlBookmarks.length,
    withMetadata,
    withoutMetadata,
    failed,
    expired
  }
}

// ==================== 工具函数 ====================

// ✅ flattenBookmarkTree 已移除：修复后直接使用 IndexedDB 的扁平数据
// 不再需要从树形结构扁平化
