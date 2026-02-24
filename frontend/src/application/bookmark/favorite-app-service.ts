/**
 * 书签收藏应用服务
 *
 * 职责：
 * - 管理书签的收藏状态
 * - 处理收藏书签的排序
 * - 提供收藏书签的查询接口
 * - 双重存储：IndexedDB（书签状态） + chrome.storage.local（收藏列表备份）
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
// ✅ 已移除 Event Bus 依赖，统一使用 Pinia 响应式 + 跨页面 storage 广播

/**
 * 收藏书签项
 */
export interface FavoriteBookmark {
  id: string
  title: string
  url: string
  favoriteOrder: number
  favoritedAt: number
}

/**
 * 书签收藏应用服务类
 */
class FavoriteAppService {
  /** chrome.storage.local 中存储收藏书签 ID 列表的键名 */
  private readonly STORAGE_KEY = 'AB_FAVORITE_BOOKMARKS'

  /**
   * 从 chrome.storage.local 获取收藏书签 ID 列表
   * @returns 收藏书签 ID 数组
   */
  private async getFavoriteIdsFromStorage(): Promise<string[]> {
    try {
      const ids = await modernStorage.getLocal<string[]>(this.STORAGE_KEY, [])
      return ids
    } catch (error) {
      logger.error('FavoriteAppService', '❌ 从 storage 获取收藏列表失败:', error)
      return []
    }
  }

  /**
   * 保存收藏书签 ID 列表到 chrome.storage.local
   * @param ids 收藏书签 ID 数组
   */
  private async saveFavoriteIdsToStorage(ids: string[]): Promise<void> {
    try {
      await modernStorage.setLocal(this.STORAGE_KEY, ids)
      logger.debug('FavoriteAppService', `✅ 收藏列表已保存到 storage: ${ids.length} 个`)
    } catch (error) {
      logger.error('FavoriteAppService', '❌ 保存收藏列表到 storage 失败:', error)
    }
  }

  /**
   * 同步 IndexedDB 和 chrome.storage.local 的收藏数据
   * 启动时调用，确保数据一致性
   */
  async syncFavoriteData(): Promise<void> {
    try {
      logger.info('FavoriteAppService', '🔄 开始同步收藏数据...')

      // 1. 从 IndexedDB 获取所有收藏书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()
      const favoriteBookmarksInDB = allBookmarks.filter(b => b.isFavorite && b.url)
      const idsInDB = new Set(favoriteBookmarksInDB.map(b => b.id))

      // 2. 从 chrome.storage.local 获取收藏 ID 列表
      const idsInStorage = await this.getFavoriteIdsFromStorage()
      const idsInStorageSet = new Set(idsInStorage)

      logger.debug('FavoriteAppService', '📊 收藏数据对比:', {
        inDB: idsInDB.size,
        inStorage: idsInStorageSet.size
      })

      // 3. 检查是否一致
      const needsSync = 
        idsInDB.size !== idsInStorageSet.size ||
        ![...idsInDB].every(id => idsInStorageSet.has(id))

      if (!needsSync) {
        logger.info('FavoriteAppService', '✅ 收藏数据已同步，无需处理')
        return
      }

      // 4. 数据不一致，以 chrome.storage.local 为准恢复
      logger.warn('FavoriteAppService', '⚠️ 检测到收藏数据不一致，开始恢复...')

      // 4.1 找出需要添加收藏标记的书签（在 storage 中但 DB 中未标记）
      const toMarkAsFavorite = idsInStorage.filter(id => !idsInDB.has(id))
      
      // 4.2 找出需要移除收藏标记的书签（在 DB 中标记但 storage 中没有）
      const toUnmarkAsFavorite = [...idsInDB].filter(id => !idsInStorageSet.has(id))

      logger.info('FavoriteAppService', '📝 恢复计划:', {
        toAdd: toMarkAsFavorite.length,
        toRemove: toUnmarkAsFavorite.length
      })

      // 4.3 批量更新 IndexedDB
      for (const bookmarkId of toMarkAsFavorite) {
        const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
        if (bookmark && !bookmark.isFolder) {
          const favoriteOrder = idsInStorage.indexOf(bookmarkId)
          await indexedDBManager.updateBookmark({
            ...bookmark,
            isFavorite: true,
            favoriteOrder,
            favoritedAt: Date.now()
          })
        }
      }

      for (const bookmarkId of toUnmarkAsFavorite) {
        const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
        if (bookmark) {
          await indexedDBManager.updateBookmark({
            ...bookmark,
            isFavorite: false,
            favoriteOrder: undefined,
            favoritedAt: undefined
          })
        }
      }

      logger.info('FavoriteAppService', '✅ 收藏数据恢复完成')

      // 5. 更新 bookmarkStore
      try {
        const { useBookmarkStore } = await import('@/stores/bookmarkStore')
        const bookmarkStore = useBookmarkStore()
        
        for (const bookmarkId of toMarkAsFavorite) {
          const favoriteOrder = idsInStorage.indexOf(bookmarkId)
          bookmarkStore.updateNode(bookmarkId, {
            isFavorite: true,
            favoriteOrder,
            favoritedAt: Date.now()
          })
        }

        for (const bookmarkId of toUnmarkAsFavorite) {
          bookmarkStore.updateNode(bookmarkId, {
            isFavorite: false,
            favoriteOrder: undefined,
            favoritedAt: undefined
          })
        }
      } catch (error) {
        logger.warn('FavoriteAppService', '更新 bookmarkStore 失败（非致命错误）', error)
      }

    } catch (error) {
      logger.error('FavoriteAppService', '❌ 同步收藏数据失败:', error)
    }
  }

  /**
   * 获取所有收藏的书签
   * @returns 收藏书签列表（按 favoriteOrder 排序）
   */
  async getFavorites(): Promise<FavoriteBookmark[]> {
    try {
      logger.debug('FavoriteAppService', '📋 获取收藏书签列表')

      // 从 IndexedDB 获取所有书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 筛选出已收藏的书签
      const favorites = allBookmarks
        .filter(bookmark => bookmark.isFavorite && bookmark.url) // 只要书签，不要文件夹
        .map(bookmark => ({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url!,
          favoriteOrder: bookmark.favoriteOrder ?? 999,
          favoritedAt: bookmark.favoritedAt ?? Date.now()
        }))
        .sort((a, b) => a.favoriteOrder - b.favoriteOrder) // 按收藏顺序排序

      logger.info(
        'FavoriteAppService',
        `✅ 获取到 ${favorites.length} 个收藏书签`
      )
      return favorites
    } catch (error) {
      logger.error(
        'Component',
        'FavoriteAppService',
        '❌ 获取收藏书签失败:',
        error
      )
      return []
    }
  }

  /**
   * 添加书签到收藏
   * @param bookmarkId 书签ID
   */
  async addToFavorites(bookmarkId: string): Promise<boolean> {
    try {
      logger.info('FavoriteAppService', '⭐ 添加收藏:', bookmarkId)

      // 获取书签数据
      const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
      if (!bookmark) {
        logger.error(
          'Component',
          'FavoriteAppService',
          '❌ 书签不存在:',
          bookmarkId
        )
        return false
      }

      // 不允许收藏文件夹
      if (bookmark.isFolder) {
        logger.warn('FavoriteAppService', '⚠️ 不能收藏文件夹:', bookmarkId)
        return false
      }

      // 检查是否已收藏（幂等性保证，正常情况不应触发）
      if (bookmark.isFavorite) {
        logger.debug('FavoriteAppService', '📝 书签已在收藏中，跳过:', bookmarkId)
        return true
      }

      // 获取当前最大的 favoriteOrder
      const favorites = await this.getFavorites()
      const maxOrder =
        favorites.length > 0
          ? Math.max(...favorites.map(f => f.favoriteOrder))
          : 0

      const favoriteOrder = maxOrder + 1
      const favoritedAt = Date.now()

      // 更新书签数据到 IndexedDB
      const updatedBookmark: BookmarkRecord = {
        ...bookmark,
        isFavorite: true,
        favoriteOrder,
        favoritedAt
      }

      await indexedDBManager.updateBookmark(updatedBookmark)

      // ✅ 同步更新 chrome.storage.local 中的收藏列表
      const currentIds = await this.getFavoriteIdsFromStorage()
      if (!currentIds.includes(bookmarkId)) {
        currentIds.push(bookmarkId)
        await this.saveFavoriteIdsToStorage(currentIds)
      }

      // ✅ 同步更新 bookmarkStore（确保 UI 立即响应）
      try {
        const { useBookmarkStore } = await import('@/stores/bookmarkStore')
        const bookmarkStore = useBookmarkStore()
        bookmarkStore.updateNode(bookmarkId, {
          isFavorite: true,
          favoriteOrder,
          favoritedAt
        })
      } catch (error) {
        logger.warn('FavoriteAppService', '更新 bookmarkStore 失败（非致命错误）', error)
      }

      // 广播到其他页面（跨页面同步）
      this.broadcastFavoriteChange('added', bookmarkId)

      logger.info('FavoriteAppService', '✅ 添加收藏成功:', bookmarkId)
      return true
    } catch (error) {
      logger.error('Component', 'FavoriteAppService', '❌ 添加收藏失败:', error)
      return false
    }
  }

  /**
   * 从收藏中移除书签
   * @param bookmarkId 书签ID
   */
  async removeFromFavorites(bookmarkId: string): Promise<boolean> {
    try {
      logger.info('FavoriteAppService', '⭐ 移除收藏:', bookmarkId)

      // 获取书签数据
      const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
      if (!bookmark) {
        logger.error(
          'Component',
          'FavoriteAppService',
          '❌ 书签不存在:',
          bookmarkId
        )
        return false
      }

      // 更新书签数据到 IndexedDB
      const updatedBookmark: BookmarkRecord = {
        ...bookmark,
        isFavorite: false,
        favoriteOrder: undefined,
        favoritedAt: undefined
      }

      await indexedDBManager.updateBookmark(updatedBookmark)

      // ✅ 同步更新 chrome.storage.local 中的收藏列表
      const currentIds = await this.getFavoriteIdsFromStorage()
      const updatedIds = currentIds.filter(id => id !== bookmarkId)
      await this.saveFavoriteIdsToStorage(updatedIds)

      // ✅ 同步更新 bookmarkStore（确保 UI 立即响应）
      try {
        const { useBookmarkStore } = await import('@/stores/bookmarkStore')
        const bookmarkStore = useBookmarkStore()
        bookmarkStore.updateNode(bookmarkId, {
          isFavorite: false,
          favoriteOrder: undefined,
          favoritedAt: undefined
        })
      } catch (error) {
        logger.warn('FavoriteAppService', '更新 bookmarkStore 失败（非致命错误）', error)
      }

      // 广播到其他页面（跨页面同步）
      this.broadcastFavoriteChange('removed', bookmarkId)

      logger.info('FavoriteAppService', '✅ 移除收藏成功:', bookmarkId)
      return true
    } catch (error) {
      logger.error('Component', 'FavoriteAppService', '❌ 移除收藏失败:', error)
      return false
    }
  }

  /**
   * 切换收藏状态
   * @param bookmarkId 书签ID
   */
  async toggleFavorite(bookmarkId: string): Promise<boolean> {
    const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
    if (!bookmark) return false

    if (bookmark.isFavorite) {
      return await this.removeFromFavorites(bookmarkId)
    } else {
      return await this.addToFavorites(bookmarkId)
    }
  }

  /**
   * 更新收藏书签的排序
   * @param bookmarkIds 排序后的书签ID数组
   */
  async updateFavoritesOrder(bookmarkIds: string[]): Promise<boolean> {
    try {
      logger.info('FavoriteAppService', '📊 更新收藏排序:', bookmarkIds.length)

      // 批量更新 favoriteOrder
      for (let i = 0; i < bookmarkIds.length; i++) {
        const bookmarkId = bookmarkIds[i]
        const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)

        if (bookmark && bookmark.isFavorite) {
          const updatedBookmark: BookmarkRecord = {
            ...bookmark,
            favoriteOrder: i
          }
          await indexedDBManager.updateBookmark(updatedBookmark)
        }
      }

      // ✅ 同步更新 chrome.storage.local 中的收藏列表顺序
      await this.saveFavoriteIdsToStorage(bookmarkIds)

      logger.info('FavoriteAppService', '✅ 更新收藏排序成功')
      return true
    } catch (error) {
      logger.error(
        'Component',
        'FavoriteAppService',
        '❌ 更新收藏排序失败:',
        error
      )
      return false
    }
  }

  /**
   * 检查书签是否已收藏
   * @param bookmarkId 书签ID
   */
  async isFavorite(bookmarkId: string): Promise<boolean> {
    try {
      const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
      return bookmark?.isFavorite ?? false
    } catch (error) {
      logger.error(
        'Component',
        'FavoriteAppService',
        '❌ 检查收藏状态失败:',
        error
      )
      return false
    }
  }

  /**
   * 广播收藏变更到其他页面
   * @param action 动作类型
   * @param bookmarkId 书签ID
   */
  private broadcastFavoriteChange(
    action: 'added' | 'removed',
    bookmarkId: string
  ) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'FAVORITE_CHANGED',
          action,
          bookmarkId
        })
        logger.debug(
          'FavoriteAppService',
          `📡 广播收藏变更: ${action} - ${bookmarkId}`
        )
      }
    } catch (error) {
      // 忽略广播失败，不影响主流程
      logger.debug('FavoriteAppService', '广播失败（可能无其他页面）', error)
    }
  }
}

// 导出单例
export const favoriteAppService = new FavoriteAppService()
