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
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

/**
 * 递归计算书签数量（包括所有子孙书签）
 */
function calculateBookmarksCount(
  node: chrome.bookmarks.BookmarkTreeNode
): number {
  if (!node.children || node.children.length === 0) {
    return node.url ? 1 : 0
  }

  return node.children.reduce((total, child) => {
    return total + calculateBookmarksCount(child)
  }, 0)
}

/**
 * 递归计算文件夹数量（包括所有子孙文件夹）
 */
function calculateFoldersCount(
  node: chrome.bookmarks.BookmarkTreeNode
): number {
  if (!node.children || node.children.length === 0) {
    return 0
  }

  return node.children.reduce((total, child) => {
    const childFolders = calculateFoldersCount(child)
    return total + (child.children ? 1 : 0) + childFolders
  }, 0)
}

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
    bookmarksCount: calculateBookmarksCount(node),
    folderCount: calculateFoldersCount(node),

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
  private incrementalQueue: Array<{
    type: 'created' | 'removed' | 'changed' | 'moved'
    id: string
  }> = []
  private incDebounce: number | null = null

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
    const syncStart = performance.now()
    console.log('[syncAllBookmarks] 🚀 开始同步...')

    if (this.isSyncing) {
      logger.warn('BookmarkSync', '⚠️ 同步正在进行中，跳过')
      console.log('[syncAllBookmarks] ⚠️ 同步已在进行，跳过')
      return
    }

    try {
      // 标记 DB 未就绪（local 快速标记，避免读路径误判）
      try {
        await chrome.storage.local.set({ AB_DB_READY: false })
      } catch {}
      this.isSyncing = true
      logger.info('BookmarkSync', '🚀 开始同步书签...')

      // 1. 确保 IndexedDB 已初始化
      console.log('[syncAllBookmarks] 🔧 初始化 IndexedDB...')
      const initStart = performance.now()
      await indexedDBManager.initialize()
      console.log(
        `[syncAllBookmarks] ✅ IndexedDB 初始化完成，耗时 ${(performance.now() - initStart).toFixed(0)}ms`
      )

      // 2. 从 Chrome API 获取所有书签
      console.log('[syncAllBookmarks] 📖 获取 Chrome 书签树...')
      const getTreeStart = performance.now()
      const tree = await chrome.bookmarks.getTree()
      console.log(
        `[syncAllBookmarks] ✅ 书签树获取完成，耗时 ${(performance.now() - getTreeStart).toFixed(0)}ms，根节点数: ${tree.length}`
      )
      logger.info('BookmarkSync', `📚 获取到书签树，根节点数: ${tree.length}`)

      // 3. 扁平化书签树
      console.log('[syncAllBookmarks] 🔄 扁平化书签树...')
      const flattenStart = performance.now()
      const allRecords = flattenBookmarkTree(tree)
      console.log(
        `[syncAllBookmarks] ✅ 扁平化完成，耗时 ${(performance.now() - flattenStart).toFixed(0)}ms，记录数: ${allRecords.length}`
      )
      logger.info('BookmarkSync', `📊 扁平化后共 ${allRecords.length} 条记录`)

      // 4. 批量写入 IndexedDB（分批事务，避免长事务阻塞）
      console.log('[syncAllBookmarks] 💾 开始批量写入 IndexedDB...')
      logger.info('BookmarkSync', '💾 开始批量写入 IndexedDB...')
      const writeStart = performance.now()
      await indexedDBManager.insertBookmarks(allRecords, {
        progressCallback: (processed, total) => {
          if (processed % 1000 === 0 || processed === total) {
            const elapsed = performance.now() - writeStart
            const rate = (processed / Math.max(elapsed / 1000, 0.001)).toFixed(
              0
            )
            console.log(
              `[syncAllBookmarks] 📝 进度: ${processed}/${total} (${rate} 条/秒)`
            )
          }
        }
      })
      const writeElapsed = performance.now() - writeStart
      const avgRate = (allRecords.length / (writeElapsed / 1000)).toFixed(0)
      console.log(
        `[syncAllBookmarks] ✅ 批量写入完成，耗时 ${writeElapsed.toFixed(0)}ms，平均速度: ${avgRate} 条/秒`
      )

      this.lastSyncTime = Date.now()

      // 5. 标记 DB 已就绪并记录 schema 版本 & 最近同步时间
      try {
        await indexedDBManager.saveSetting(
          'DB_READY',
          true,
          'boolean',
          '数据库已就绪'
        )
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
          AB_DB_READY: true, // 数据库就绪
          AB_SCHEMA_VERSION: DB_CONFIG.VERSION,
          AB_BOOKMARK_COUNT: allRecords.length, // 更新书签总数
          AB_LAST_SYNCED_AT: this.lastSyncTime
        })
        console.log(
          `[syncAllBookmarks] 📊 状态已更新: bookmarkCount=${allRecords.length}, lastSyncedAt=${this.lastSyncTime}`
        )
      } catch (e) {
        logger.warn('BookmarkSync', '⚠️ 写入 DB_READY 元数据失败', e)
      }
      const totalElapsed = performance.now() - syncStart
      logger.info(
        'BookmarkSync',
        `✅ 同步完成！共写入 ${allRecords.length} 条书签，总耗时: ${totalElapsed.toFixed(0)}ms`
      )
      console.log(
        `[syncAllBookmarks] 🎉 同步完成，总耗时 ${totalElapsed.toFixed(0)}ms`
      )

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
      const totalElapsed = performance.now() - syncStart
      logger.error('BookmarkSync', '❌ 同步失败', error)
      console.error(
        `[syncAllBookmarks] ❌ 同步失败，耗时 ${totalElapsed.toFixed(0)}ms`,
        error
      )

      // ✅ 同步失败时更新状态
      try {
        await chrome.storage.local.set({
          AB_DB_READY: false // 标记数据库未就绪
        })
        console.log(
          '[syncAllBookmarks] 📊 状态已更新: dbReady=false (同步失败)'
        )
      } catch (e) {
        console.warn('[syncAllBookmarks] ⚠️ 更新失败状态失败:', e)
      }

      throw error
    } finally {
      this.isSyncing = false
      console.log('[syncAllBookmarks] 🔓 释放同步锁')
    }
  }

  /**
   * 增量同步：仅根据事件队列对少量节点做插入/更新/删除
   * 为了安全与简洁：当前实现使用 Chrome API 查该节点，再转换为记录并写入；删除直接按 id 删除。
   */
  async syncIncremental(): Promise<void> {
    if (this.isSyncing) return
    if (this.incrementalQueue.length === 0) return

    try {
      this.isSyncing = true
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
        await indexedDBManager.insertBookmarks(toUpsert)
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
            console.warn(
              '[BookmarkSync] ❌ 广播 acuity-bookmarks-db-synced 消息失败'
            )
          })
      } catch {}
    } catch (e) {
      logger.warn('BookmarkSync', '增量同步失败，回退到全量', e)
      // 小概率失败时触发一次全量兜底（异步，不阻塞调用方）
      queueMicrotask(() => this.syncAllBookmarks())
    } finally {
      this.isSyncing = false
    }
  }

  enqueueIncremental(
    type: 'created' | 'removed' | 'changed' | 'moved',
    id: string
  ) {
    this.incrementalQueue.push({ type, id })
    if (this.incDebounce) {
      clearTimeout(this.incDebounce)
    }
    this.incDebounce = setTimeout(() => {
      this.syncIncremental()
    }, 300) as unknown as number
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
    const funcStart = performance.now()
    console.log('[getRootBookmarks] 🚀 开始执行')

    try {
      console.log('[getRootBookmarks] 🔧 初始化 IndexedDB...')
      const initStart = performance.now()
      await indexedDBManager.initialize()
      console.log(
        `[getRootBookmarks] ✅ IndexedDB 初始化完成，耗时 ${(performance.now() - initStart).toFixed(0)}ms`
      )

      // 获取根节点（parentId='0'）
      console.log('[getRootBookmarks] 📖 查询 parentId=0 的子节点...')
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
          `[getRootBookmarks] 📋 被过滤掉的节点详情:`,
          filteredOutNodes.map(n => ({
            id: n.id,
            title: n.title || '【无标题】',
            reason: n.id === '3' ? '移动书签' : '无标题'
          }))
        )
      }

      console.log(
        `[getRootBookmarks] 📋 过滤后节点详情:`,
        rootBookmarks.map(n => ({
          id: n.id,
          title: n.title || '【无标题】',
          parentId: n.parentId,
          childrenCount: n.childrenCount,
          bookmarksCount: n.bookmarksCount
        }))
      )

      // ✅ 检查书签总数，如果为0则触发重新同步
      const totalBookmarks = rootBookmarks.reduce(
        (sum, node) => sum + (node.bookmarksCount || 0),
        0
      )
      console.log(
        `[getRootBookmarks] 📊 书签总数统计:`,
        rootBookmarks.map(n => ({
          id: n.id,
          title: n.title || '【无标题】',
          bookmarksCount: n.bookmarksCount || 0,
          childrenCount: n.childrenCount || 0
        }))
      )

      if (totalBookmarks === 0 && rootBookmarks.length > 0) {
        logger.warn('BookmarkSync', '⚠️ 检测到书签总数为0，触发重新同步...')
        console.log('[getRootBookmarks] ⚠️ 书签总数为0，触发重新同步...')

        // 异步重新同步，不阻塞返回
        this.syncAllBookmarks()
          .then(() => {
            logger.info('BookmarkSync', '✅ 重新同步完成')
            console.log('[getRootBookmarks] ✅ 重新同步完成')
          })
          .catch(error => {
            logger.error('BookmarkSync', '❌ 重新同步失败', error)
            console.error('[getRootBookmarks] ❌ 重新同步失败:', error)
          })
      }

      // ✅ 如果 IndexedDB 为空，直接返回空数组
      if (!rootBookmarks || rootBookmarks.length === 0) {
        logger.warn('BookmarkSync', '⚠️ IndexedDB 无根节点数据')
        console.log('[getRootBookmarks] ⚠️ 数据为空，返回空数组')
        const elapsed = performance.now() - funcStart
        console.log(
          `[getRootBookmarks] 📤 返回空数组，总耗时 ${elapsed.toFixed(0)}ms`
        )
        return []
      }

      const elapsed = performance.now() - funcStart
      const totalBookmarksCount = rootBookmarks.reduce(
        (sum, node) => sum + (node.bookmarksCount || 0),
        0
      )
      logger.info('BookmarkSync', '✅ 获取根节点成功', {
        count: rootBookmarks.length,
        totalBookmarks: totalBookmarksCount,
        elapsed: `${elapsed.toFixed(0)}ms`
      })
      console.log(
        `[getRootBookmarks] ✅ 返回 ${rootBookmarks.length} 条数据，总书签数: ${totalBookmarksCount}，总耗时 ${elapsed.toFixed(0)}ms`
      )
      return rootBookmarks
    } catch (error) {
      const elapsed = performance.now() - funcStart
      logger.error('BookmarkSync', '❌ 获取根节点失败', error)
      console.error(
        `[getRootBookmarks] ❌ 执行失败，总耗时 ${elapsed.toFixed(0)}ms`,
        error
      )
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
