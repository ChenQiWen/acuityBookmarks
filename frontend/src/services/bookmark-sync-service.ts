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
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/utils-legacy/indexeddb-schema'

/**
 * 从 Chrome 书签树节点转换为 BookmarkRecord
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

    // 搜索优化字段
    titleLower: (node.title || '').toLowerCase(),
    urlLower: node.url?.toLowerCase(),
    domain: extractDomain(node.url || ''),
    keywords: [],

    // 类型和统计字段
    isFolder,
    childrenCount: node.children?.length ?? 0,
    bookmarksCount: 0,
    folderCount: 0,

    // 扩展属性
    tags: [],
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
    dataVersion: '1.0',
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

/**
 * 扁平化书签树
 */
function flattenBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  pathIds: string[] = [],
  pathNames: string[] = [],
  flatIndex = { current: 0 }
): BookmarkRecord[] {
  const records: BookmarkRecord[] = []

  for (const node of nodes) {
    const record = convertChromeNodeToRecord(
      node,
      pathIds,
      pathNames,
      flatIndex.current++
    )
    records.push(record)

    if (node.children && node.children.length > 0) {
      const childRecords = flattenBookmarkTree(
        node.children,
        [...pathIds, node.id],
        [...pathNames, node.title || ''],
        flatIndex
      )
      records.push(...childRecords)
    }
  }

  return records
}

/**
 * 书签同步服务类
 */
export class BookmarkSyncService {
  private static instance: BookmarkSyncService
  private isSyncing = false
  private lastSyncTime = 0

  static getInstance(): BookmarkSyncService {
    if (!BookmarkSyncService.instance) {
      BookmarkSyncService.instance = new BookmarkSyncService()
    }
    return BookmarkSyncService.instance
  }

  /**
   * 全量同步：从 Chrome API 获取所有书签并写入 IndexedDB
   */
  async syncAllBookmarks(): Promise<void> {
    if (this.isSyncing) {
      logger.warn('BookmarkSync', '⚠️ 同步正在进行中，跳过')
      return
    }

    try {
      this.isSyncing = true
      logger.info('BookmarkSync', '🚀 开始同步书签...')

      // 1. 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      // 2. 从 Chrome API 获取所有书签
      const tree = await chrome.bookmarks.getTree()
      logger.info('BookmarkSync', `📚 获取到书签树，根节点数: ${tree.length}`)

      // 3. 扁平化书签树
      const allRecords = flattenBookmarkTree(tree)
      logger.info('BookmarkSync', `📊 扁平化后共 ${allRecords.length} 条记录`)

      // 4. 批量写入 IndexedDB
      logger.info('BookmarkSync', '💾 开始写入 IndexedDB...')
      for (const record of allRecords) {
        await indexedDBManager.updateBookmark(record)
      }

      this.lastSyncTime = Date.now()
      logger.info(
        'BookmarkSync',
        `✅ 同步完成！共写入 ${allRecords.length} 条书签`
      )
    } catch (error) {
      logger.error('BookmarkSync', '❌ 同步失败', error)
      throw error
    } finally {
      this.isSyncing = false
    }
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
    try {
      await indexedDBManager.initialize()
      // 获取顶层书签文件夹（通常 parentId 为 '0' 或根节点）
      return await indexedDBManager.getChildrenByParentId('0', 0)
    } catch (error) {
      logger.error('BookmarkSync', '❌ 获取根节点失败', error)
      return []
    }
  }

  /**
   * 检查是否需要同步
   */
  needsSync(): boolean {
    const SYNC_INTERVAL = 5 * 60 * 1000 // 5分钟
    return Date.now() - this.lastSyncTime > SYNC_INTERVAL
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      needsSync: this.needsSync()
    }
  }
}

// 导出单例
export const bookmarkSyncService = BookmarkSyncService.getInstance()
