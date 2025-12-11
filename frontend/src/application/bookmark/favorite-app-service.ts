/**
 * 书签收藏应用服务
 *
 * 职责：
 * - 管理书签的收藏状态
 * - 处理收藏书签的排序
 * - 提供收藏书签的查询接口
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'
import { logger } from '@/infrastructure/logging/logger'
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

      // 更新书签数据
      const updatedBookmark: BookmarkRecord = {
        ...bookmark,
        isFavorite: true,
        favoriteOrder,
        favoritedAt
      }

      await indexedDBManager.updateBookmark(updatedBookmark)

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

      // 更新书签数据
      const updatedBookmark: BookmarkRecord = {
        ...bookmark,
        isFavorite: false,
        favoriteOrder: undefined,
        favoritedAt: undefined
      }

      await indexedDBManager.updateBookmark(updatedBookmark)

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

      // 注意：排序变更暂不需要跨页面同步，因为 favoriteOrder 主要影响列表顺序
      // 如需跨页面同步，可以添加 broadcastFavoriteChange('reordered', ...)

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
