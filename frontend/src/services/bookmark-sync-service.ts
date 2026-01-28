/**
 * 📚 书签同步服务
 *
 * 职责：
 * - 从 Chrome API 获取所有书签
 * - 转换并保存到 IndexedDB
 * - 处理增量更新
 * - 提供查询接口
 */

import { logger } from '@/infrastructure/logging/logger'
import { indexedDBManager, DB_CONFIG } from '@/infrastructure/indexeddb/manager'
import {
  scheduleFullTraitRebuild,
  scheduleTraitRebuildForIds
} from './bookmark-trait-service'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
import { setDatabaseReady } from '@/background/state'
import type {
  ProgressCallback,
  SyncProgress,
  SyncErrorType
} from '@/types/sync-progress'
import {
  calculateEstimatedRemaining,
  ERROR_MESSAGES
} from '@/types/sync-progress'
import { TIMEOUT_CONFIG } from '@/config/constants'

/**
 * 递归计算书签数量（包括所有子孙书签）
 */
function calculateBookmarksCount(
  node: chrome.bookmarks.BookmarkTreeNode
): number {
  let total = node.url ? 1 : 0
  const stack: chrome.bookmarks.BookmarkTreeNode[] = []
  if (node.children && node.children.length > 0) {
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]!)
    }
  }

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.url) {
      total += 1
    }
    if (current.children && current.children.length > 0) {
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        stack.push(current.children[index]!)
      }
    }
  }

  return total
}

/**
 * 递归计算文件夹数量（包括所有子孙文件夹）
 */
function calculateFoldersCount(
  node: chrome.bookmarks.BookmarkTreeNode
): number {
  let total = 0
  const stack: chrome.bookmarks.BookmarkTreeNode[] = []
  if (node.children && node.children.length > 0) {
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]!)
    }
  }

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.children && current.children.length > 0) {
      total += 1
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        stack.push(current.children[index]!)
      }
    }
  }

  return total
}

// ✅ 移除 isValidBookmarkUrl() 函数
// URL 格式检测应该由特征检测服务统一处理，不应该在同步服务中实现

/**
 * 从 Chrome 书签树节点转换为 BookmarkRecord
 * 
 * ✅ 只负责数据转换，不做业务判断
 * ✅ 特征检测由 bookmark-trait-service 统一处理
 */
function convertChromeNodeToRecord(
  node: chrome.bookmarks.BookmarkTreeNode,
  pathIds: string[] = [],
  pathNames: string[] = [],
  flatIndex: number = 0
): BookmarkRecord {
  const isFolder = !node.url
  const dateAdded = node.dateAdded ?? Date.now()
  const createdDate = new Date(dateAdded)

  return {
    // Chrome原生字段
    id: node.id,
    parentId: node.parentId || '0',
    index: node.index ?? 0,
    title: node.title || '',
    url: node.url,
    dateAdded,
    dateGroupModified: dateAdded,

    // 层级关系
    path: [...pathNames, node.title || ''],
    pathString: [...pathNames, node.title || ''].join(' / '),
    pathIds: [...pathIds, node.id],
    pathIdsString: [...pathIds, node.id].join(' / '),
    ancestorIds: pathIds,
    siblingIds: [],
    depth: pathIds.length,

    // 筛选优化字段
    titleLower: (node.title || '').toLowerCase(),
    urlLower: node.url?.toLowerCase(),
    domain: extractDomain(node.url || ''),
    keywords: [],

    // 类型和统计字段
    isFolder,
    childrenCount: node.children?.length ?? 0,
    bookmarksCount: calculateBookmarksCount(node),
    folderCount: calculateFoldersCount(node),

    // 扩展属性（初始为空，由特征检测服务填充）
    tags: [],
    traitTags: [],
    traitMetadata: [],
    lastVisited: (
      node as chrome.bookmarks.BookmarkTreeNode & { dateLastUsed?: number }
    ).dateLastUsed,
    visitCount: 0,

    // 时间分类
    createdYear: createdDate.getFullYear(),
    createdMonth: createdDate.getMonth() + 1,

    // 元数据标记
    hasMetadata: false,
    metadataUpdatedAt: 0,

    // 虚拟化支持
    flatIndex,
    isVisible: true,
    sortKey: `${node.index ?? 0}`.padStart(10, '0'),

    // 数据版本
    dataVersion: 1,
    lastCalculated: Date.now()
  }
}

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

interface PathInfo {
  ids: string[]
  names: string[]
}

function createPathInfo(ids: string[], names: string[]): PathInfo {
  return {
    ids,
    names
  }
}

function appendPathInfo(path: PathInfo, id: string, name: string): PathInfo {
  return {
    ids: [...path.ids, id],
    names: [...path.names, name]
  }
}

/**
 * 扁平化书签树
 */
/**
 * 扁平化书签树（支持进度回调）
 *
 * @param nodes - Chrome 书签树节点数组
 * @param pathIds - 父级路径 ID
 * @param pathNames - 父级路径名称
 * @param flatIndex - 扁平化索引
 * @param onProgress - 进度回调函数（可选）
 * @returns 扁平化的书签记录数组
 */
function flattenBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  pathIds: string[] = [],
  pathNames: string[] = [],
  flatIndex = { current: 0 },
  onProgress?: (current: number, total: number) => void
): BookmarkRecord[] {
  const records: BookmarkRecord[] = []
  const stack: Array<{
    node: chrome.bookmarks.BookmarkTreeNode
    path: PathInfo
  }> = []

  // 先计算总节点数（用于进度反馈）
  let totalNodes = 0
  if (onProgress) {
    const countStack = [...nodes]
    while (countStack.length > 0) {
      const node = countStack.pop()!
      totalNodes++
      if (node.children && node.children.length > 0) {
        countStack.push(...node.children)
      }
    }
  }

  const initialPath = createPathInfo(pathIds, pathNames)
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]!
    stack.push({ node, path: initialPath })
  }

  // 进度报告间隔：每 100 个节点报告一次
  const PROGRESS_INTERVAL = 100
  let processedCount = 0

  while (stack.length > 0) {
    const { node, path } = stack.pop()!
    const record = convertChromeNodeToRecord(
      node,
      path.ids,
      path.names,
      flatIndex.current++
    )
    records.push(record)

    // 报告进度
    processedCount++
    if (
      onProgress &&
      totalNodes > 0 &&
      processedCount % PROGRESS_INTERVAL === 0
    ) {
      onProgress(processedCount, totalNodes)
    }

    if (node.children && node.children.length > 0) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        const child = node.children[index]!
        stack.push({
          node: child,
          path: appendPathInfo(path, node.id, node.title || '')
        })
      }
    }
  }

  // 最后报告一次进度（确保 100%）
  if (onProgress && totalNodes > 0) {
    onProgress(totalNodes, totalNodes)
  }

  return records
}

/**
 * 标记重复书签
 *
 * 规则：
 * 1. URL 完全相同才算重复
 * 2. 按照 dateAdded + index 排序，第一个出现的是原始书签
 * 3. 后续相同 URL 的标记为重复书签
 *
 * @param records - 书签记录数组
 * @returns 标记后的书签记录数组
 */
function markDuplicateBookmarks(records: BookmarkRecord[]): BookmarkRecord[] {
  // 只处理有URL的书签（排除文件夹）
  const bookmarksWithUrl = records.filter(r => r.url)

  // 按 dateAdded + index 排序（保证顺序稳定）
  const sorted = [...bookmarksWithUrl].sort((a, b) => {
    if (a.dateAdded !== b.dateAdded) {
      return (a.dateAdded ?? 0) - (b.dateAdded ?? 0)
    }
    return a.index - b.index
  })

  // URL -> 第一个出现的书签ID
  const urlToCanonicalId = new Map<string, string>()

  // 需要标记为重复的书签ID集合
  const duplicateIds = new Set<string>()
  const duplicateOfMap = new Map<string, string>() // 重复书签ID -> 原始书签ID

  for (const record of sorted) {
    if (!record.url) continue

    const canonicalId = urlToCanonicalId.get(record.url)

    if (!canonicalId) {
      // 第一次遇到这个URL，标记为原始书签
      urlToCanonicalId.set(record.url, record.id)
    } else {
      // 后续遇到相同URL，标记为重复
      duplicateIds.add(record.id)
      duplicateOfMap.set(record.id, canonicalId)
    }
  }

  // 更新所有记录
  return records.map(record => {
    if (duplicateIds.has(record.id)) {
      const canonicalId = duplicateOfMap.get(record.id)!

      // 添加 duplicate 特征标签
      const traitTags = record.traitTags ?? []
      if (!traitTags.includes('duplicate')) {
        traitTags.push('duplicate')
      }

      const traitMetadata = record.traitMetadata ?? []
      traitMetadata.push({
        tag: 'duplicate',
        detectedAt: Date.now(),
        source: 'worker',
        notes: `原始书签 ID: ${canonicalId}`
      })

      return {
        ...record,
        isDuplicate: true,
        duplicateOf: canonicalId,
        traitTags,
        traitMetadata
      }
    }

    return record
  })
}

const MAX_FULL_SYNC_RETRY = 3
// ✅ 使用统一配置：同步操作超时时间
const SYNC_TIMEOUT_MS = TIMEOUT_CONFIG.API.SYNC

/**
 * 书签同步服务类
 *
 * 🔴 Session Storage Keys:
 * - `bookmark_sync_is_syncing`: 当前是否正在同步（防止并发，跨 Service Worker 挂起/唤醒）
 */
export class BookmarkSyncService {
  private static instance: BookmarkSyncService

  // 🔴 迁移到 session storage：临时运行状态，Service Worker 挂起时不应保留
  private readonly SYNC_STATE_KEY = 'bookmark_sync_is_syncing' as const

  private lastSyncTime = 0
  private incrementalQueue: Array<{
    type: 'created' | 'removed' | 'changed' | 'moved'
    id: string
  }> = []
  private incDebounce: ReturnType<typeof setTimeout> | null = null
  private pendingIncrementalPromise: {
    resolve: () => void
    reject: (error: Error) => void
  } | null = null
  private pendingFullSync = false
  private fullSyncRetryCount = 0

  // 📊 进度回调管理
  private progressCallbacks: Set<ProgressCallback> = new Set()
  private currentProgress: SyncProgress | null = null

  // ⏱️ 超时保护（兼容 Service Worker 和浏览器环境）
  private syncTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): BookmarkSyncService {
    if (!BookmarkSyncService.instance) {
      BookmarkSyncService.instance = new BookmarkSyncService()
    }
    return BookmarkSyncService.instance
  }

  /**
   * 订阅同步进度更新
   *
   * @param callback - 进度回调函数
   * @returns 取消订阅的函数
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)

    // 如果当前有进度，立即通知
    if (this.currentProgress) {
      callback(this.currentProgress)
    }

    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  /**
   * 通知所有订阅者进度更新
   *
   * @param progress - 进度数据
   */
  private notifyProgress(progress: SyncProgress): void {
    this.currentProgress = progress
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress)
      } catch (error) {
        logger.error('BookmarkSync', '进度回调执行失败', error)
      }
    })
  }

  /**
   * 分类错误类型
   *
   * @param error - 错误对象
   * @returns 错误类型
   */
  private classifyError(error: unknown): SyncErrorType {
    const message = error instanceof Error ? error.message : String(error)

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('NetworkError')
    ) {
      return 'network'
    }
    if (
      message.includes('IndexedDB') ||
      message.includes('database') ||
      message.includes('IDBDatabase')
    ) {
      return 'indexeddb'
    }
    if (
      message.includes('chrome.bookmarks') ||
      message.includes('Extension context invalidated')
    ) {
      return 'chrome_api'
    }
    return 'unknown'
  }

  /**
   * 获取用户友好的错误消息
   *
   * @param error - 错误对象
   * @returns 错误消息
   */
  private getErrorMessage(error: unknown): string {
    const type = this.classifyError(error)
    return ERROR_MESSAGES[type]
  }

  /**
   * 清除超时定时器
   */
  private clearSyncTimeout(): void {
    if (this.syncTimeoutTimer !== null) {
      clearTimeout(this.syncTimeoutTimer)
      this.syncTimeoutTimer = null
    }
  }

  /**
   * 全量同步：从 Chrome API 获取所有书签并写入 IndexedDB
   */
  async syncAllBookmarks(): Promise<void> {
    const syncStart = performance.now()
    logger.info('BookmarkSync', '🚀 开始全量同步...')

    // 🔴 检查 session storage 中的同步状态
    const isSyncing =
      (await modernStorage.getSession<boolean>(this.SYNC_STATE_KEY, false)) ??
      false

    if (isSyncing) {
      logger.warn('BookmarkSync', '⚠️ 同步正在进行中，记录挂起请求')
      this.pendingFullSync = true
      return
    }

    try {
      // ✅ 只在初次同步时标记 DB 未就绪，避免重新同步时影响正常读取
      // 检查是否有现有数据
      const hasExistingData = this.lastSyncTime > 0
      if (!hasExistingData) {
        try {
          // 🔴 使用 session storage
          await setDatabaseReady(false)
          logger.info('BookmarkSync', '首次同步，标记 DB 未就绪')
        } catch {}
      }

      // 🔴 设置 session storage 同步状态
      await modernStorage.setSession(this.SYNC_STATE_KEY, true)
      this.pendingFullSync = false
      logger.info('BookmarkSync', '🚀 开始同步书签...')

      // ⏱️ 设置超时保护（30秒）
      // 注意：使用 setTimeout（不带 window.）以兼容 Service Worker 环境
      this.syncTimeoutTimer = setTimeout(() => {
        logger.error('BookmarkSync', '同步超时')
        this.notifyProgress({
          phase: 'timeout',
          current: 0,
          total: 0,
          percentage: 0,
          message: '同步超时，请重试',
          startTime: syncStart,
          error: {
            type: 'timeout',
            message: `同步操作超过 ${SYNC_TIMEOUT_MS / 1000} 秒未完成`,
            canRetry: this.fullSyncRetryCount < MAX_FULL_SYNC_RETRY,
            retryCount: this.fullSyncRetryCount
          }
        })
      }, SYNC_TIMEOUT_MS)

      // 1. 确保 IndexedDB 已初始化
      logger.debug('BookmarkSync', '🔧 初始化 IndexedDB...')
      const initStart = performance.now()
      await indexedDBManager.initialize()
      logger.debug(
        'BookmarkSync',
        `✅ IndexedDB 初始化完成，耗时 ${(performance.now() - initStart).toFixed(0)}ms`
      )

      // 📊 阶段 1：获取书签树
      this.notifyProgress({
        phase: 'fetching',
        current: 0,
        total: 1,
        percentage: 0,
        message: '正在从 Chrome 读取书签...',
        startTime: syncStart
      })

      // 2. 从 Chrome API 获取所有书签
      logger.debug('BookmarkSync', '📖 获取 Chrome 书签树...')
      const getTreeStart = performance.now()
      const tree = await chrome.bookmarks.getTree()
      logger.debug(
        'BookmarkSync',
        `✅ 书签树获取完成，耗时 ${(performance.now() - getTreeStart).toFixed(0)}ms，根节点数: ${tree.length}`
      )
      logger.info('BookmarkSync', `📚 获取到书签树，根节点数: ${tree.length}`)

      this.notifyProgress({
        phase: 'fetching',
        current: 1,
        total: 1,
        percentage: 20,
        message: '书签读取完成',
        startTime: syncStart
      })

      // 📊 阶段 2：扁平化转换
      this.notifyProgress({
        phase: 'converting',
        current: 0,
        total: 0, // 总数在 flattenBookmarkTree 中更新
        percentage: 20,
        message: '正在转换书签数据...',
        startTime: syncStart
      })

      // 3. 扁平化书签树（带进度回调）
      logger.debug('BookmarkSync', '🔄 扁平化书签树...')
      const flattenStart = performance.now()
      const allRecords = flattenBookmarkTree(
        tree,
        [],
        [],
        { current: 0 },
        (current, total) => {
          // 转换阶段占 20%-40%
          const percentage = 20 + (current / total) * 20
          this.notifyProgress({
            phase: 'converting',
            current,
            total,
            percentage,
            message: `正在转换书签数据... ${current}/${total}`,
            startTime: syncStart,
            estimatedRemaining: calculateEstimatedRemaining({
              phase: 'converting',
              current,
              total,
              percentage,
              message: '',
              startTime: syncStart
            })
          })
        }
      )
      logger.debug(
        'BookmarkSync',
        `✅ 扁平化完成，耗时 ${(performance.now() - flattenStart).toFixed(0)}ms，记录数: ${allRecords.length}`
      )
      logger.info('BookmarkSync', `📊 扁平化后共 ${allRecords.length} 条记录`)

      // 3.5. 标记重复书签
      logger.debug('BookmarkSync', '🔍 检测重复书签...')
      const duplicateStart = performance.now()
      const markedRecords = markDuplicateBookmarks(allRecords)
      const duplicateCount = markedRecords.filter(r => r.isDuplicate).length
      logger.debug(
        'BookmarkSync',
        `✅ 重复检测完成，耗时 ${(performance.now() - duplicateStart).toFixed(0)}ms，发现 ${duplicateCount} 个重复书签`
      )
      logger.info('BookmarkSync', `🔍 发现 ${duplicateCount} 个重复书签`)

      // 📊 阶段 3：写入数据库
      this.notifyProgress({
        phase: 'writing',
        current: 0,
        total: markedRecords.length,
        percentage: 40,
        message: '正在写入数据库...',
        startTime: syncStart
      })

      // 4. 批量写入 IndexedDB（分批事务，避免长事务阻塞）
      logger.debug('BookmarkSync', '💾 开始批量写入 IndexedDB...')
      logger.info('BookmarkSync', '💾 开始批量写入 IndexedDB...')
      const writeStart = performance.now()
      await indexedDBManager.insertBookmarks(markedRecords, {
        progressCallback: (processed, total) => {
          // 写入阶段占 40%-90%
          const percentage = 40 + (processed / total) * 50

          this.notifyProgress({
            phase: 'writing',
            current: processed,
            total,
            percentage,
            message: `正在写入数据库... ${processed}/${total}`,
            startTime: syncStart,
            estimatedRemaining: calculateEstimatedRemaining({
              phase: 'writing',
              current: processed,
              total,
              percentage,
              message: '',
              startTime: syncStart
            })
          })

          if (processed % 1000 === 0 || processed === total) {
            const elapsed = performance.now() - writeStart
            const rate = (processed / Math.max(elapsed / 1000, 0.001)).toFixed(
              0
            )
            logger.debug(
              'BookmarkSync',
              `📝 进度: ${processed}/${total} (${rate} 条/秒)`
            )
          }

          // 让出主线程，避免阻塞 UI
          if (processed % 100 === 0 && processed < total) {
            return new Promise<void>(resolve => setTimeout(resolve, 0))
          }
        }
      })
      const writeElapsed = performance.now() - writeStart
      const avgRate = (allRecords.length / (writeElapsed / 1000)).toFixed(0)
      logger.debug(
        'BookmarkSync',
        `✅ 批量写入完成，耗时 ${writeElapsed.toFixed(0)}ms，平均速度: ${avgRate} 条/秒`
      )

      // 写入全局统计
      try {
        const totalFolders = allRecords.filter(record => record.isFolder).length
        // ✅ 只统计有 URL 且不是文件夹的书签（与 handleGlobalStats 逻辑一致）
        const totalBookmarks = allRecords.filter(
          record => record.url && !record.isFolder
        ).length
        await indexedDBManager.updateGlobalStats({
          key: 'basic',
          totalBookmarks,
          totalFolders,
          totalDomains: 0,
          lastUpdated: Date.now(),
          dataVersion: DB_CONFIG.VERSION
        })
      } catch (error) {
        logger.warn('BookmarkSync', '⚠️ 更新全局统计失败', error)
      }

      this.lastSyncTime = Date.now()
      this.fullSyncRetryCount = 0

      // 📊 阶段 4：建立索引（90%-100%）
      this.notifyProgress({
        phase: 'indexing',
        current: 0,
        total: 1,
        percentage: 90,
        message: '正在建立索引...',
        startTime: syncStart
      })

      // 5. 记录 schema 版本 & 最近同步时间，并标记数据库就绪
      try {
        await indexedDBManager.saveSetting(
          'SCHEMA_VERSION',
          DB_CONFIG.VERSION,
          'number',
          'IndexedDB schema version'
        )
        await indexedDBManager.saveSetting(
          'LAST_SYNCED_AT',
          this.lastSyncTime,
          'number',
          '最近一次全量同步时间'
        )
        // 本地快速标记，供读路径快速判断
        // ✅ 更新所有相关状态
        await chrome.storage.local.set({
          AB_INITIALIZED: true, // 标记已完成初始化
          AB_SCHEMA_VERSION: DB_CONFIG.VERSION,
          AB_BOOKMARK_COUNT: allRecords.length, // 更新书签总数
          AB_LAST_SYNCED_AT: this.lastSyncTime
        })
        // 🔴 数据库就绪状态写入 session storage
        await setDatabaseReady(true)
        console.log(
          `[syncAllBookmarks] 📊 状态已更新: bookmarkCount=${allRecords.length}, lastSyncedAt=${this.lastSyncTime}`
        )
      } catch (e) {
        logger.warn('BookmarkSync', '⚠️ 写入同步状态元数据失败', e)
      }
      const totalElapsed = performance.now() - syncStart
      logger.info(
        'BookmarkSync',
        `✅ 同步完成！共写入 ${allRecords.length} 条书签，总耗时: ${totalElapsed.toFixed(0)}ms`
      )
      console.log(
        `[syncAllBookmarks] 🎉 同步完成，总耗时 ${totalElapsed.toFixed(0)}ms`
      )

      // ✅ 清除超时定时器
      this.clearSyncTimeout()

      // 📊 完成！
      this.notifyProgress({
        phase: 'completed',
        current: allRecords.length,
        total: allRecords.length,
        percentage: 100,
        message: `同步完成！共 ${allRecords.length} 个书签`,
        startTime: syncStart,
        estimatedRemaining: 0
      })

      scheduleFullTraitRebuild('full-sync')

      // 6. 广播 DB 已就绪/已同步事件（供 UI 刷新）
      try {
        chrome.runtime
          .sendMessage({
            type: 'acuity-bookmarks-db-ready',
            timestamp: Date.now()
          })
          .catch(() => {
            console.warn(
              '[BookmarkSync] ❌ 广播 acuity-bookmarks-db-ready 消息失败'
            )
          })
        chrome.runtime
          .sendMessage({
            type: 'acuity-bookmarks-db-synced',
            eventType: 'full-sync',
            timestamp: Date.now()
          })
          .catch(() => {
            console.warn(
              '[BookmarkSync] ❌ 广播 acuity-bookmarks-db-synced 消息失败'
            )
          })
      } catch {}
    } catch (error) {
      // ✅ 清除超时定时器
      this.clearSyncTimeout()

      const totalElapsed = performance.now() - syncStart
      logger.error('BookmarkSync', '❌ 同步失败', error)
      console.error(
        `[syncAllBookmarks] ❌ 同步失败，耗时 ${totalElapsed.toFixed(0)}ms`,
        error
      )

      // ✅ 分类错误并通知进度
      const errorType = this.classifyError(error)
      const canRetry = this.fullSyncRetryCount < MAX_FULL_SYNC_RETRY

      this.notifyProgress({
        phase: 'failed',
        current: 0,
        total: 0,
        percentage: 0,
        message: '同步失败',
        startTime: syncStart,
        error: {
          type: errorType,
          message: this.getErrorMessage(error),
          canRetry,
          retryCount: this.fullSyncRetryCount,
          originalError: error
        }
      })

      // ✅ 同步失败时更新状态
      // 只在初次同步失败时标记未就绪，避免影响已有数据的使用
      const hadExistingData = this.lastSyncTime > 0
      if (!hadExistingData) {
        try {
          // 🔴 使用 session storage
          await setDatabaseReady(false)
          console.log(
            '[syncAllBookmarks] 📊 状态已更新: dbReady=false (初次同步失败)'
          )
        } catch (e) {
          logger.warn(
            'BookmarkSync',
            'syncAllBookmarks] ⚠️ 更新失败状态失败:',
            e
          )
        }
      } else {
        logger.info(
          'BookmarkSync',
          '同步失败但已有数据，保持数据库就绪状态不变'
        )
      }

      // ✅ 自动重试逻辑
      this.fullSyncRetryCount += 1

      if (canRetry) {
        logger.info(
          'BookmarkSync',
          `将在 3 秒后自动重试（${this.fullSyncRetryCount}/${MAX_FULL_SYNC_RETRY}）`
        )
        this.pendingFullSync = true

        // 3秒后自动重试
        setTimeout(() => {
          this.syncAllBookmarks()
        }, 3000)
      } else {
        logger.error(
          'BookmarkSync',
          `📛 全量同步连续失败 ${this.fullSyncRetryCount} 次，停止自动重试`
        )
        this.pendingFullSync = false
      }

      // 不再抛出错误，由进度对话框处理用户交互
    } finally {
      // 🔴 清除 session storage 同步状态
      await modernStorage.setSession(this.SYNC_STATE_KEY, false)
      logger.debug('BookmarkSync', ' 🔓 释放同步锁')

      if (
        this.pendingFullSync &&
        this.fullSyncRetryCount < MAX_FULL_SYNC_RETRY
      ) {
        logger.info('BookmarkSync', '🔁 检测到挂起的全量同步请求，立即重新执行')
        this.pendingFullSync = false
        queueMicrotask(() => {
          void this.syncAllBookmarks()
        })
      }
    }
  }

  /**
   * 增量同步：仅根据事件队列对少量节点做插入/更新/删除
   * 为了安全与简洁：当前实现使用 Chrome API 查该节点，再转换为记录并写入；删除直接按 id 删除。
   */
  async syncIncremental(): Promise<void> {
    // 🔴 检查 session storage 中的同步状态
    const isSyncing =
      (await modernStorage.getSession<boolean>(this.SYNC_STATE_KEY, false)) ??
      false

    if (isSyncing) return
    if (this.incrementalQueue.length === 0) return

    try {
      // 🔴 设置 session storage 同步状态
      await modernStorage.setSession(this.SYNC_STATE_KEY, true)
      await indexedDBManager.initialize()

      const queue = this.incrementalQueue.splice(
        0,
        this.incrementalQueue.length
      )
      const toUpsert: BookmarkRecord[] = []
      const toDelete: string[] = []

      for (const evt of queue) {
        if (evt.type === 'removed') {
          toDelete.push(evt.id)
          continue
        }
        // 查询该节点（以及必要时其子树）
        const nodes = await chrome.bookmarks.get(evt.id)
        if (nodes && nodes.length > 0) {
          const recs = flattenBookmarkTree(nodes)
          toUpsert.push(...recs)
        }
      }

      if (toDelete.length > 0) {
        await indexedDBManager.deleteBookmarksBatch(toDelete)
      }

      if (toUpsert.length > 0) {
        // ✅ 关键修复：增量更新时重新检测重复书签
        // 收集本次更新涉及的所有 URL
        const affectedUrls = new Set(toUpsert.map(r => r.url).filter(Boolean))

        if (affectedUrls.size > 0) {
          // 策略：先插入当前批次，然后异步重新检测所有相关 URL 的书签
          // 这样可以保证增量同步的性能，同时确保最终一致性

          // 1. 先插入当前批次（可能标记不准确）
          await indexedDBManager.insertBookmarks(toUpsert)

          // 2. 异步重新检测：加载所有书签，找到相同 URL 的，重新标记
          // 使用 setTimeout 避免阻塞当前同步
          setTimeout(async () => {
            try {
              logger.debug('BookmarkSync', ' 🔍 重新检测重复书签...')
              const allBookmarks = await indexedDBManager.getAllBookmarks()
              const markedAll = markDuplicateBookmarks(allBookmarks)

              // 只更新受影响 URL 的书签
              const toUpdate = markedAll.filter(r => affectedUrls.has(r.url))
              if (toUpdate.length > 0) {
                await indexedDBManager.insertBookmarks(toUpdate)
                logger.debug(
                  'BookmarkSync',
                  ` ✅ 已更新 ${toUpdate.length} 个书签的重复状态`
                )
              }
            } catch (error) {
              logger.error('BookmarkSync', ' 重新检测重复书签失败:', error)
            }
          }, 0)

          scheduleTraitRebuildForIds(
            Array.from(new Set(toUpsert.map(record => record.id))),
            'incremental-sync'
          )
        } else {
          // 没有 URL 更新（例如文件夹），直接插入
          await indexedDBManager.insertBookmarks(toUpsert)

          scheduleTraitRebuildForIds(
            Array.from(new Set(toUpsert.map(record => record.id))),
            'incremental-sync'
          )
        }
      }

      this.lastSyncTime = Date.now()
      try {
        await chrome.storage.local.set({ AB_LAST_SYNCED_AT: this.lastSyncTime })
      } catch {}
      try {
        chrome.runtime
          .sendMessage({
            type: 'acuity-bookmarks-db-synced',
            eventType: 'incremental',
            timestamp: Date.now()
          })
          .catch(() => {
            logger.warn(
              'BookmarkSync',
              '❌ 广播 acuity-bookmarks-db-synced 消息失败'
            )
          })
      } catch {}

      // ✅ 通知等待的 Promise
      if (this.pendingIncrementalPromise) {
        this.pendingIncrementalPromise.resolve()
        this.pendingIncrementalPromise = null
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      logger.warn('BookmarkSync', '增量同步失败，回退到全量', e)

      // ✅ 通知等待的 Promise（失败）
      if (this.pendingIncrementalPromise) {
        this.pendingIncrementalPromise.reject(error)
        this.pendingIncrementalPromise = null
      }

      // 小概率失败时触发一次全量兜底（异步，不阻塞调用方）
      const isSyncing =
        (await modernStorage.getSession<boolean>(this.SYNC_STATE_KEY, false)) ??
        false

      if (isSyncing) {
        this.pendingFullSync = true
      } else if (this.fullSyncRetryCount < MAX_FULL_SYNC_RETRY) {
        queueMicrotask(() => {
          void this.syncAllBookmarks()
        })
      }
    } finally {
      // 🔴 清除 session storage 同步状态
      await modernStorage.setSession(this.SYNC_STATE_KEY, false)

      // ✅ 确保 Promise 被处理（防止异常情况下 Promise 挂起）
      // 注意：正常情况下 Promise 已经在 try/catch 中处理了
      if (this.pendingIncrementalPromise) {
        // 这种情况不应该发生，但作为兜底处理
        logger.warn(
          'BookmarkSync',
          '⚠️ 增量同步完成但 Promise 未被处理，强制 resolve'
        )
        this.pendingIncrementalPromise.resolve()
        this.pendingIncrementalPromise = null
      }
    }
  }

  /**
   * 入队增量同步请求
   *
   * ✅ 优化：返回 Promise，确保调用方可以等待同步完成
   * 替代固定延迟的不可靠方案
   *
   * @param type - 事件类型
   * @param id - 书签ID
   * @returns Promise，在同步完成时 resolve
   */
  enqueueIncremental(
    type: 'created' | 'removed' | 'changed' | 'moved',
    id: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.incrementalQueue.push({ type, id })

      // 如果已有待处理的 Promise，保存新的 resolve/reject
      if (this.pendingIncrementalPromise) {
        const oldResolve = this.pendingIncrementalPromise.resolve
        const oldReject = this.pendingIncrementalPromise.reject

        this.pendingIncrementalPromise = {
          resolve: () => {
            oldResolve()
            resolve()
          },
          reject: error => {
            oldReject(error)
            reject(error)
          }
        }
      } else {
        // 创建新的 Promise
        this.pendingIncrementalPromise = { resolve, reject }
      }

      // 清除旧的去抖定时器
      if (this.incDebounce) {
        clearTimeout(this.incDebounce)
      }

      // 设置新的去抖定时器
      this.incDebounce = setTimeout(() => {
        this.incDebounce = null
        void this.syncIncremental()
      }, 300)
    })
  }

  /**
   * 获取指定父节点的子书签
   */
  async getChildrenByParentId(
    parentId: string,
    offset = 0,
    limit?: number
  ): Promise<BookmarkRecord[]> {
    try {
      await indexedDBManager.initialize()
      return await indexedDBManager.getChildrenByParentId(
        parentId,
        offset,
        limit
      )
    } catch (error) {
      logger.error('BookmarkSync', `❌ 获取子书签失败: ${parentId}`, error)
      return []
    }
  }

  /**
   * 获取所有书签（分页）
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number
  ): Promise<BookmarkRecord[]> {
    try {
      await indexedDBManager.initialize()
      return await indexedDBManager.getAllBookmarks(limit, offset)
    } catch (error) {
      logger.error('BookmarkSync', '❌ 获取所有书签失败', error)
      return []
    }
  }

  /**
   * 获取根节点书签
   */
  async getRootBookmarks(): Promise<BookmarkRecord[]> {
    logger.debug('BookmarkSync', ' 🚀 开始执行')

    try {
      logger.debug('BookmarkSync', ' 🔧 初始化 IndexedDB...')
      const initStart = performance.now()
      await indexedDBManager.initialize()
      console.log(
        `[getRootBookmarks] ✅ IndexedDB 初始化完成，耗时 ${(performance.now() - initStart).toFixed(0)}ms`
      )

      // 获取根节点（parentId='0'）
      logger.debug('BookmarkSync', ' 📖 查询 parentId=0 的子节点...')
      const queryStart = performance.now()
      let rootBookmarks = await indexedDBManager.getChildrenByParentId('0', 0)
      console.log(
        `[getRootBookmarks] 📊 查询完成，耗时 ${(performance.now() - queryStart).toFixed(0)}ms，结果数量: ${rootBookmarks?.length || 0}`
      )

      // ✅ 过滤掉移动书签（id='3'）和没有标题的节点
      // Chrome 原生书签管理器在桌面版不显示移动书签，且所有显示的文件夹都应有标题
      console.log(
        `[getRootBookmarks] 🔍 开始过滤，原始节点数量: ${rootBookmarks.length}`
      )
      console.log(
        `[getRootBookmarks] 📋 原始节点详情:`,
        rootBookmarks.map(n => ({
          id: n.id,
          title: n.title || '【无标题】',
          parentId: n.parentId,
          childrenCount: n.childrenCount,
          bookmarksCount: n.bookmarksCount
        }))
      )

      const beforeFilter = rootBookmarks.length
      const filteredOutNodes = rootBookmarks.filter(
        bookmark =>
          bookmark.id === '3' || !bookmark.title || bookmark.title.trim() === ''
      )
      rootBookmarks = rootBookmarks.filter(
        bookmark =>
          bookmark.id !== '3' && bookmark.title && bookmark.title.trim() !== ''
      )
      const filteredOut = beforeFilter - rootBookmarks.length

      console.log(
        `[getRootBookmarks] 🔍 过滤前: ${beforeFilter} 个节点，过滤后: ${rootBookmarks.length} 个节点，过滤掉: ${filteredOut} 个节点`
      )

      if (filteredOut > 0) {
        console.log(
          '[getRootBookmarks] 📦 被过滤节点详情:',
          filteredOutNodes.map(node => ({
            id: node.id,
            title: node.title || '【无标题】',
            parentId: node.parentId,
            childrenCount: node.childrenCount,
            bookmarksCount: node.bookmarksCount
          }))
        )
      }

      return rootBookmarks
    } catch (error) {
      logger.error('BookmarkSync', '❌ 获取根节点书签失败', error)
      return []
    }
  }
}

export const bookmarkSyncService = BookmarkSyncService.getInstance()
