/**
 * 书签数据管理 Store（精简版）
 *
 * 职责：
 * - 仅管理书签数据状态
 * - 协调Application层服务
 * - 统一错误处理
 *
 * 移除的职责：
 * - 业务逻辑（迁移到Application层）
 * - 复杂的数据处理（由Application层处理）
 * - 消息通信（由Application层处理）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import {
  useErrorHandling,
  withErrorHandling,
  withRetry
} from '@/infrastructure/error-handling'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'

// === 类型定义 ===

interface BookmarkCreatedPayload extends BookmarkNode {}

interface BookmarkRemovedPayload {
  id: string
}

interface BookmarkUpdatedPayload {
  id: string
  changes: Partial<BookmarkNode>
}

interface BookmarkMovedPayload {
  id: string
  parentId: string
  index: number
}

interface ChildrenReorderedPayload {
  childIds: string[]
}

type BookmarkChangeData =
  | { type: 'BOOKMARK_CREATED'; payload: BookmarkCreatedPayload }
  | { type: 'BOOKMARK_REMOVED'; payload: BookmarkRemovedPayload }
  | { type: 'BOOKMARK_UPDATED'; payload: BookmarkUpdatedPayload }
  | { type: 'BOOKMARK_MOVED'; payload: BookmarkMovedPayload }
  | { type: 'CHILDREN_REORDERED'; payload: ChildrenReorderedPayload }

interface ChromeRuntimeBookmarkMessage {
  channel: 'bookmarks-changed'
  data: BookmarkChangeData
}

// === Store 定义 ===

export const useBookmarkStore = defineStore('bookmarks', () => {
  // === 错误处理 ===
  const { handleError, clearErrors, hasError, userErrorMessage } =
    useErrorHandling()

  // === 数据状态 ===
  const nodes = ref<Map<string, BookmarkNode>>(new Map())
  const isLoading = ref(true)
  const lastUpdated = ref<number | null>(null)
  const loadingChildren = ref<Set<string>>(new Set())

  // === 计算属性 ===

  const bookmarkTree = computed(() => {
    const tree: BookmarkNode[] = []
    const allNodes = nodes.value

    // 找到所有根节点
    for (const node of allNodes.values()) {
      if (node.parentId === '0') {
        tree.push(node)
      }
    }

    // 递归构建子节点
    const buildChildren = (node: BookmarkNode) => {
      node.children = []
      for (const potentialChild of allNodes.values()) {
        if (potentialChild.parentId === node.id) {
          node.children.push(potentialChild)
        }
      }
      node.children.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      node.children.forEach(buildChildren)
    }

    tree.forEach(buildChildren)
    tree.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    return tree
  })

  const totalBookmarks = computed(() => {
    return Array.from(nodes.value.values()).filter(node => node.url).length
  })

  const totalFolders = computed(() => {
    return Array.from(nodes.value.values()).filter(node => !node.url).length
  })

  // === 核心方法 ===

  /**
   * 初始化Store
   */
  const initialize = withErrorHandling(
    async () => {
      isLoading.value = true

      try {
        await bookmarkAppService.initialize()
        await fetchRootNodes()

        logger.info('BookmarkStore', '✅ 初始化完成')
      } finally {
        isLoading.value = false
      }
    },
    { operation: 'initialize' }
  )

  /**
   * 添加节点到状态
   */
  const addNodes = (nodeArray: BookmarkNode[]) => {
    nodeArray.forEach(node => {
      // 为文件夹添加子节点加载状态
      if (node.childrenCount && node.childrenCount > 0 && !node.children) {
        node.children = []
        node._childrenLoaded = false
      }
      nodes.value.set(node.id, node)
    })
  }

  /**
   * 获取根节点
   */
  const fetchRootNodes = withRetry(
    withErrorHandling(
      async () => {
        logger.info('BookmarkStore', '🚀 获取根节点...')

        const result = await bookmarkAppService.getRootNodes()

        if (result.ok && result.value) {
          addNodes(result.value)
          lastUpdated.value = Date.now()
          logger.info(
            'BookmarkStore',
            `✅ 根节点加载完成: ${result.value.length} 个`
          )
        } else {
          throw new Error(result.error || '获取根节点失败')
        }
      },
      { operation: 'fetchRootNodes' }
    ),
    3,
    1000
  )

  /**
   * 获取子节点
   */
  const fetchChildren = withErrorHandling(
    async (parentId: string, limit: number = 100, offset: number = 0) => {
      if (loadingChildren.value.has(parentId)) return

      logger.info('BookmarkStore', `📁 获取子节点: ${parentId}...`)
      loadingChildren.value.add(parentId)

      try {
        const result = await bookmarkAppService.getChildren(parentId, {
          limit,
          offset
        })

        if (result.ok && result.value) {
          addNodes(result.value)

          // 标记子节点已加载
          const parentNode = nodes.value.get(parentId)
          if (parentNode) {
            parentNode._childrenLoaded = true
          }

          lastUpdated.value = Date.now()
          logger.info(
            'BookmarkStore',
            `✅ 子节点加载完成: ${result.value.length} 个`
          )
        } else {
          throw new Error(result.error || `获取子节点失败: ${parentId}`)
        }
      } finally {
        loadingChildren.value.delete(parentId)
      }
    },
    { operation: 'fetchChildren' }
  )

  /**
   * 根据ID获取节点
   */
  const getNodeById = (id: string): BookmarkNode | undefined => {
    return nodes.value.get(id)
  }

  /**
   * 刷新数据
   */
  const refresh = withErrorHandling(
    async () => {
      logger.info('BookmarkStore', '🔄 刷新数据...')

      // 清空当前数据
      nodes.value.clear()
      loadingChildren.value.clear()

      // 重新加载根节点
      await fetchRootNodes()

      logger.info('BookmarkStore', '✅ 数据刷新完成')
    },
    { operation: 'refresh' }
  )

  /**
   * 处理书签变更事件
   */
  const handleBookmarkChange = withErrorHandling(
    async (message: ChromeRuntimeBookmarkMessage) => {
      if (message.channel !== 'bookmarks-changed') return

      const { type, payload } = message.data

      switch (type) {
        case 'BOOKMARK_CREATED':
          addNodes([payload])
          break

        case 'BOOKMARK_REMOVED':
          nodes.value.delete(payload.id)
          break

        case 'BOOKMARK_UPDATED':
          const existingNode = nodes.value.get(payload.id)
          if (existingNode) {
            Object.assign(existingNode, payload.changes)
          }
          break

        case 'BOOKMARK_MOVED':
          const movedNode = nodes.value.get(payload.id)
          if (movedNode) {
            movedNode.parentId = payload.parentId
            movedNode.index = payload.index
          }
          break

        case 'CHILDREN_REORDERED':
          // 处理子节点重排序
          // 这里需要根据具体的重排序逻辑来处理
          break
      }

      lastUpdated.value = Date.now()
      logger.info('BookmarkStore', `📝 处理书签变更: ${type}`)
    },
    { operation: 'handleBookmarkChange' }
  )

  /**
   * 设置消息监听器
   */
  const setupMessageListener = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleBookmarkChange)
    }
  }

  /**
   * 移除消息监听器
   */
  const removeMessageListener = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(handleBookmarkChange)
    }
  }

  // === 错误处理 ===

  const handleStoreError = async (error: Error) => {
    await handleError(error, { store: 'bookmark' })
  }

  const clearStoreErrors = () => {
    clearErrors()
  }

  // === 返回公共接口 ===

  return {
    // 错误状态
    hasError,
    userErrorMessage,

    // 数据状态
    nodes,
    isLoading,
    lastUpdated,
    loadingChildren,

    // 计算属性
    bookmarkTree,
    totalBookmarks,
    totalFolders,

    // 核心方法
    initialize,
    addNodes,
    fetchRootNodes,
    fetchChildren,
    getNodeById,
    refresh,
    handleBookmarkChange,
    setupMessageListener,
    removeMessageListener,

    // 错误处理
    handleStoreError,
    clearStoreErrors
  }
})
