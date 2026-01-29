/**
 * 书签存储 Store
 *
 * 职责：
 * - 管理书签节点的全局状态
 * - 提供书签树的计算属性
 * - 统一从 IndexedDB 读取数据（唯一数据源）
 *
 * 架构原则：
 * - Chrome API → Background Script → IndexedDB → UI
 * - UI 层禁止直接访问 Chrome API，确保数据流单向性
 * - 使用 Map 存储节点以提升查找性能
 * - 计算属性自动构建树形结构
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import type { BookmarkNode } from '@/types'
import { updateMap, updateRef } from '@/infrastructure/state/immer-helpers'

// ✅ 数据完整加载，不再需要分页
// const _DEFAULT_PAGE_SIZE = 200

/**
 * 书签创建事件载荷
 */
interface BookmarkCreatedPayload extends BookmarkNode {}

/**
 * 书签删除事件载荷
 */
interface BookmarkRemovedPayload {
  /** 被删除书签的ID */
  id: string
}

/**
 * 书签更新事件载荷
 */
interface BookmarkUpdatedPayload {
  /** 被更新书签的ID */
  id: string
  /** 变更内容（部分字段） */
  changes: Partial<BookmarkNode>
}

/**
 * 书签移动事件载荷
 */
interface BookmarkMovedPayload {
  /** 被移动书签的ID */
  id: string
  /** 新的父节点ID */
  parentId: string
  /** 新的位置索引 */
  index: number
}

/**
 * 子节点重排序事件载荷
 */
interface ChildrenReorderedPayload {
  /** 重排序后的子节点ID数组 */
  childIds: string[]
}

/**
 * 书签变更数据联合类型
 *
 * 包含所有可能的书签变更事件类型
 */
type BookmarkChangeData =
  | { type: 'BOOKMARK_CREATED'; payload: BookmarkCreatedPayload }
  | { type: 'BOOKMARK_REMOVED'; payload: BookmarkRemovedPayload }
  | { type: 'BOOKMARK_UPDATED'; payload: BookmarkUpdatedPayload }
  | { type: 'BOOKMARK_MOVED'; payload: BookmarkMovedPayload }
  | { type: 'CHILDREN_REORDERED'; payload: ChildrenReorderedPayload }

/**
 * Chrome 运行时书签消息结构
 */
interface ChromeRuntimeBookmarkMessage {
  /** 消息通道 */
  channel: 'bookmarks-changed'
  /** 变更数据 */
  data: BookmarkChangeData
}

/**
 * 定义书签 Store
 */
export const useBookmarkStore = defineStore('bookmarks', () => {
  // --- State ---
  /** 书签节点映射表（id -> node） */
  const nodes = ref<Map<string, BookmarkNode>>(new Map())
  const childrenIndex = ref<Map<string, BookmarkNode[]>>(new Map())
  /** 是否正在加载 */
  const isLoading = ref(true)
  /** 最后更新时间 */
  const lastUpdated = ref<number | null>(null)
  /** 正在加载子节点的文件夹ID集合 */
  const loadingChildren = ref<Set<string>>(new Set())
  /** 已选后代书签数量统计：key=folderId, value=其后代已选中的书签数 */
  const selectedDescCounts = ref<Map<string, number>>(new Map())
  /** 🆕 缓存的树结构（避免重复构建） */
  const cachedTree = ref<BookmarkNode[]>([])

  // --- Getters ---
  const bookmarkTree = computed(() => {
    // 🆕 优先返回缓存的树（O(1)）
    if (cachedTree.value.length > 0) {
      return cachedTree.value
    }

    // 降级：从 nodes Map 重建树（用于增量更新场景）
    const allNodes = nodes.value

    logger.debug('BookmarkStore', 'recomputeTree/start (fallback)', {
      totalNodes: allNodes.size
    })

    if (allNodes.size === 0) {
      return []
    }

    // ✅ 修复：创建新的 Map，避免在 computed 中修改响应式状态
    let parentChildrenMap = childrenIndex.value
    if (parentChildrenMap.size === 0) {
      // 创建临时 Map，不修改原始的 childrenIndex
      parentChildrenMap = new Map<string, BookmarkNode[]>()
      for (const node of allNodes.values()) {
        const parentId = node.parentId ?? '0'
        if (!parentChildrenMap.has(parentId)) {
          parentChildrenMap.set(parentId, [])
        }
        parentChildrenMap.get(parentId)!.push(node)
      }
      // ✅ 不需要排序：数据已按 Chrome 原始顺序返回
    }

    const buildNode = (
      node: BookmarkNode,
      pathGuard: Set<string>
    ): BookmarkNode => {
      const nodeId = String(node.id)
      if (pathGuard.has(nodeId)) {
        return { ...node, children: [] }
      }
      pathGuard.add(nodeId)
      const rawChildren = parentChildrenMap.get(nodeId) ?? []
      const builtChildren = rawChildren.map(child =>
        buildNode(child, pathGuard)
      )
      pathGuard.delete(nodeId)
      return {
        ...node,
        children: builtChildren
      }
    }

    const rootCandidates = parentChildrenMap.get('0') ?? []
    const tree = rootCandidates.map(root => buildNode(root, new Set<string>()))

    logger.debug('BookmarkStore', 'recomputeTree/done', {
      rootCount: tree.length
    })

    return tree
  })

  /**
   * 🆕 收藏书签列表（从 nodes 派生，响应式）
   * 返回所有 isFavorite=true 的书签，按 favoriteOrder 排序
   */
  const favoriteBookmarks = computed(() => {
    const favorites: BookmarkNode[] = []
    for (const node of nodes.value.values()) {
      if (node.isFavorite && node.url) {
        favorites.push(node)
      }
    }
    // 按 favoritedAt 时间戳倒序排序（最新收藏的在最前面）
    return favorites.sort((a, b) => {
      const timeA = a.favoritedAt ?? 0
      const timeB = b.favoritedAt ?? 0
      return timeB - timeA // 倒序：时间大的（最新的）在前
    })
  })

  // --- Actions ---

  /**
   * 🆕 递归扁平化树节点到 Map（确保所有子节点都被添加）
   *
   * @param treeNodes - 树形结构的节点数组
   * @param targetMap - 目标 Map 存储
   */
  function flattenTreeToMap(
    treeNodes: BookmarkNode[],
    targetMap: Map<string, BookmarkNode>
  ): void {
    for (const node of treeNodes) {
      const nodeId = String(node.id)
      targetMap.set(nodeId, node)

      // 递归处理子节点
      if (Array.isArray(node.children) && node.children.length > 0) {
        flattenTreeToMap(node.children, targetMap)
      }
    }
  }

  /**
   * 添加书签节点到存储
   *
   * @param nodeArray - 要添加的书签节点数组（根节点）
   */
  function addNodes(nodeArray: BookmarkNode[]) {
    // ✅ 添加数组检查，防止传入非数组数据
    if (!Array.isArray(nodeArray)) {
      logger.error('BookmarkStore', '❌ addNodes收到非数组数据:', nodeArray)
      return
    }

    logger.debug('BookmarkStore', 'addNodes', {
      count: nodeArray.length,
      nodes: nodeArray.map(n => ({
        id: n.id,
        title: n.title || '【无标题】',
        parentId: n.parentId,
        childrenCount: n.childrenCount,
        isFolder: n.isFolder
      }))
    })

    // 🆕 如果传入的是根节点数组（树形结构），直接缓存
    if (
      nodeArray.length > 0 &&
      nodeArray.every(n => !n.parentId || n.parentId === '0')
    ) {
      cachedTree.value = nodeArray
      logger.debug('BookmarkStore', 'addNodes - 缓存树结构', {
        rootCount: nodeArray.length
      })
    }

    // 🆕 使用 Immer 不可变更新 nodes 和 childrenIndex
    updateMap(nodes, draftNodes => {
      updateMap(childrenIndex, draftChildrenIndex => {
        nodeArray.forEach(rawNode => {
          const node: BookmarkNode = {
            ...rawNode,
            id: String(rawNode.id),
            parentId: rawNode.parentId ? String(rawNode.parentId) : undefined
          }

          if (node.childrenCount && node.childrenCount > 0 && !node.children) {
            node.children = []
            node._childrenLoaded = false
          }

          draftNodes.set(node.id, node)

          const parentId = node.parentId ?? '0'
          if (!draftChildrenIndex.has(parentId)) {
            draftChildrenIndex.set(parentId, [])
          }
          const siblings = draftChildrenIndex.get(parentId)!
          const existingIndex = siblings.findIndex(item => item.id === node.id)
          if (existingIndex >= 0) {
            siblings[existingIndex] = node
          } else {
            siblings.push(node)
          }

          const parentNode = draftNodes.get(parentId)
          if (parentNode && parentId !== '0') {
            parentNode.children = siblings
          }
        })

        // 🆕 递归扁平化所有子节点到 Map
        if (cachedTree.value.length > 0) {
          flattenTreeToMap(cachedTree.value, draftNodes)
        }
      })
    })

    logger.debug('BookmarkStore', 'addNodes/total', {
      total: nodes.value.size
    })
  }

  /**
   * 重置存储中的所有节点和索引
   */
  function reset() {
    // ✅ 使用 updateMap 安全地清空 Map（避免 Immer 冻结错误）
    updateMap(nodes, draft => draft.clear())
    updateMap(childrenIndex, draft => draft.clear())
    updateMap(selectedDescCounts, draft => draft.clear())
    // ✅ Set 类型直接赋值新实例（Vue 会自动检测到变化）
    loadingChildren.value = new Set()
    cachedTree.value = [] // 🆕 清空缓存的树
    lastUpdated.value = null
  }

  // === 树形关系辅助函数 ===

  /**
   * 根据ID获取书签节点
   *
   * @param id - 节点ID
   * @returns 书签节点或 undefined
   */
  function getNodeById(id: string | undefined): BookmarkNode | undefined {
    if (!id) return undefined
    return nodes.value.get(String(id))
  }

  /**
   * 获取节点的父节点ID
   *
   * @param id - 节点ID
   * @returns 父节点ID或 undefined
   */
  function getParentId(id: string | undefined): string | undefined {
    const n = getNodeById(id || '')
    return n?.parentId
  }

  /**
   * 获取节点的所有祖先节点ID列表
   *
   * 使用循环保护避免无限递归
   *
   * @param id - 节点ID
   * @returns 祖先节点ID数组（从直接父节点到根节点）
   */
  function getAncestors(id: string): string[] {
    const chain: string[] = []
    let cur: string | undefined = id
    const guard = new Set<string>()
    while (cur && cur !== '0' && !guard.has(cur)) {
      guard.add(cur)
      const p = getParentId(cur)
      if (!p || p === '0') break
      chain.push(p)
      cur = p
    }
    return chain
  }

  /**
   * 获取节点的后代书签数量
   *
   * 优先使用预聚合的字段，避免昂贵的递归计算
   *
   * @param id - 节点ID
   * @returns 后代书签数量
   */
  function getDescendantBookmarksCount(id: string): number {
    const node = getNodeById(id)
    if (!node) return 0
    if (typeof node.bookmarksCount === 'number') return node.bookmarksCount
    if (typeof node.childrenCount === 'number') return node.childrenCount
    // 没有预聚合字段时，不做昂贵递归，返回0以避免阻塞
    return 0
  }

  /**
   * 重新计算选中节点的后代书签计数
   *
   * 仅统计书签叶子节点，避免重复计数
   *
   * @param selectedSet - 当前选中的节点ID集合
   */
  function recomputeSelectedDescCounts(selectedSet: Set<string>) {
    const map = new Map<string, number>()
    // 只统计书签（有 url 的节点）
    for (const id of selectedSet) {
      const node = getNodeById(id)
      if (!node) continue
      if (node.url) {
        const ancestors = getAncestors(id)
        for (const aid of ancestors) {
          map.set(aid, (map.get(aid) || 0) + 1)
        }
      }
    }
    selectedDescCounts.value = map
  }

  /**
   * 从 IndexedDB 加载所有书签数据（唯一数据源）
   *
   * 架构原则：
   * - Chrome API → Background Script → IndexedDB → UI
   * - 此方法只从 IndexedDB 读取，不直接访问 Chrome API
   *
   * 🆕 性能优化：
   * - 直接缓存树结构（避免重复构建）
   * - 递归扁平化所有节点到 Map
   * - 详细的性能监控日志
   *
   * @throws 当获取失败时抛出错误
   */
  async function loadFromIndexedDB() {
    logger.info('BookmarkStore', '📥 loadFromIndexedDB/start')
    isLoading.value = true

    const t0 = performance.now()

    try {
      // ① 初始化 IndexedDB 连接
      await bookmarkAppService.initialize()

      // ② 从 IndexedDB 读取所有记录
      const t1 = performance.now()
      const recordsResult = await bookmarkAppService.getAllBookmarks()
      const t2 = performance.now()

      if (!recordsResult.ok || !recordsResult.value) {
        throw recordsResult.error ?? new Error('无法从 IndexedDB 读取书签数据')
      }

      const recordCount = recordsResult.value.length
      logger.info(
        'BookmarkStore',
        `⏱️  IndexedDB 读取完成: ${(t2 - t1).toFixed(0)}ms, ${recordCount} 条记录`
      )

      // ③ 构建树结构（treeAppService 内部已有性能日志）
      const viewTree = treeAppService.buildViewTreeFromFlat(recordsResult.value)
      const t3 = performance.now()

      // ④ 递归扁平化到 Map（确保所有节点都在）
      reset()
      const newNodeMap = new Map<string, BookmarkNode>()
      const newChildrenIndex = new Map<string, BookmarkNode[]>()
      flattenTreeToMap(viewTree, newNodeMap)

      // ⑤ 构建 childrenIndex（用于增量更新场景的降级重建）
      for (const node of newNodeMap.values()) {
        const parentId = node.parentId ?? '0'
        if (!newChildrenIndex.has(parentId)) {
          newChildrenIndex.set(parentId, [])
        }
        newChildrenIndex.get(parentId)!.push(node)
      }
      // ✅ 不需要排序：数据已按 Chrome 原始顺序返回

      nodes.value = newNodeMap
      childrenIndex.value = newChildrenIndex

      // ⑥ 缓存树结构（避免 computed 重复构建）
      // ⚠️ 必须在 reset() 之后赋值，否则会被清空
      cachedTree.value = viewTree
      const t4 = performance.now()

      // 🔍 验证树结构：检查是否有嵌套的 children
      const hasNestedChildren = viewTree.some(
        root => root.children && root.children.length > 0
      )
      logger.info('BookmarkStore', '🔍 树结构验证', {
        hasNestedChildren,
        rootCount: viewTree.length,
        firstRootHasChildren: viewTree[0]?.children?.length ?? 0
      })

      lastUpdated.value = Date.now()

      // 📊 性能汇总日志
      logger.info('BookmarkStore', '✅ 数据加载完成', {
        totalTime: `${(t4 - t0).toFixed(0)}ms`,
        breakdown: {
          indexedDB: `${(t2 - t1).toFixed(0)}ms`,
          buildTree: `${(t3 - t2).toFixed(0)}ms (详见上方日志)`,
          flattenMap: `${(t4 - t3).toFixed(0)}ms`
        },
        stats: {
          records: recordCount,
          rootNodes: viewTree.length,
          totalNodes: newNodeMap.size
        }
      })
    } catch (error) {
      logger.error('BookmarkStore', '❌ 从 IndexedDB 加载失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function exhaustiveCheck(param: never): never {
    throw new Error(`Unhandled case: ${JSON.stringify(param)}`)
  }

  function handleBookmarkChange(message: BookmarkChangeData) {
    // 使用更具体的类型
    logger.debug('BookmarkStore', 'Received bookmark change:', message)
    const { type, payload } = message

    switch (type) {
      case 'BOOKMARK_CREATED':
        addNodes([payload]) // payload 类型已由 switch 语句推断
        break

      case 'BOOKMARK_REMOVED':
        // ✅ 使用 Immer 不可变更新
        updateMap(nodes, draft => {
          draft.delete(payload.id) // payload 类型已由 switch 语句推断
        })
        break

      case 'BOOKMARK_UPDATED':
        if (nodes.value.has(payload.id)) {
          // payload 类型已由 switch 语句推断
          const node = nodes.value.get(payload.id)
          if (node) {
            Object.assign(node, payload.changes)
          }
        }
        break

      case 'BOOKMARK_MOVED':
        if (nodes.value.has(payload.id)) {
          // payload 类型已由 switch 语句推断
          const node = nodes.value.get(payload.id)
          if (node) {
            node.parentId = payload.parentId
            node.index = payload.index
          }
        }
        break

      case 'CHILDREN_REORDERED':
        payload.childIds.forEach((childId, index) => {
          // payload 类型已由 switch 语句推断
          const node = nodes.value.get(childId)
          if (node) {
            node.index = index
          }
        })
        break

      default:
        // This will cause a compile-time error if unknown case is missed.
        exhaustiveCheck(message)
    }
    lastUpdated.value = Date.now()
  }

  function setupListener() {
    try {
      const hasRuntimeListener =
        typeof chrome !== 'undefined' &&
        !!(
          chrome as unknown as {
            runtime?: { onMessage?: { addListener?: unknown } }
          }
        )?.runtime?.onMessage?.addListener

      if (!hasRuntimeListener) {
        logger.warn(
          'BookmarkStore',
          '⚠️ 扩展运行时不可用，跳过消息监听（开发环境或非扩展页面）。'
        )
        return
      }

      chrome.runtime.onMessage.addListener(
        (message: ChromeRuntimeBookmarkMessage, _sender, sendResponse) => {
          // 处理旧的 bookmarks-changed 消息
          if (message.channel === 'bookmarks-changed') {
            handleBookmarkChange(message.data)
            try {
              sendResponse({ status: 'ok' })
            } catch {}
            return
          }
          
          // ✅ 新增：监听数据同步完成消息（用于批量删除等操作）
          // 使用类型断言处理不同的消息格式
          const anyMessage = message as unknown as { type?: string; eventType?: string }
          if (anyMessage.type === 'acuity-bookmarks-db-synced') {
            const eventType = anyMessage.eventType as string

            // 批量删除或其他重大变更时，重新加载所有数据
            if (eventType === 'removed' || eventType === 'full-sync') {
              logger.info(
                'BookmarkStore',
                `📡 收到数据同步消息 (${eventType})，重新加载书签数据`
              )

              // 使用 queueMicrotask 避免阻塞消息处理
              queueMicrotask(() => {
                loadFromIndexedDB().catch(error => {
                  logger.error(
                    'BookmarkStore',
                    '重新加载书签数据失败',
                    error
                  )
                })
              })
            }

            try {
              sendResponse({ status: 'ok' })
            } catch {}
            return
          }
          
          // 未处理的消息不响应
        }
      )
      logger.info(
        'BookmarkStore',
        '🎧 Listening for bookmark changes from background script.'
      )
    } catch (e) {
      logger.warn('BookmarkStore', '⚠️ 设置消息监听失败', e)
    }
  }

  // === 增量更新方法（用于精细化UI更新） ===

  /**
   * 添加或更新单个书签节点
   *
   * 🆕 使用 Immer 进行不可变更新
   *
   * @param node - 要添加或更新的节点
   */
  function upsertNode(node: BookmarkNode) {
    logger.debug('BookmarkStore', 'upsertNode', {
      id: node.id,
      title: node.title || '【无标题】',
      parentId: node.parentId
    })

    // 为文件夹初始化子节点状态
    if (node.childrenCount && node.childrenCount > 0 && !node.children) {
      node.children = []
      node._childrenLoaded = false
    }

    // 🆕 使用 Immer 不可变更新
    updateMap(nodes, draft => {
      draft.set(node.id, node)
    })

    cachedTree.value = [] // 🆕 清空缓存，触发 computed 重建树
    lastUpdated.value = Date.now()
  }

  /**
   * 删除单个书签节点
   *
   * 🆕 使用 Immer 进行不可变更新
   *
   * @param id - 要删除的节点ID
   */
  function removeNode(id: string) {
    logger.debug('BookmarkStore', 'removeNode', { id })

    // 🆕 使用 Immer 不可变更新
    updateMap(nodes, draft => {
      draft.delete(id)
    })

    cachedTree.value = [] // 🆕 清空缓存，触发 computed 重建树
    lastUpdated.value = Date.now()
  }

  /**
   * 更新节点的部分字段
   *
   * 🆕 使用 Immer 进行不可变更新
   * ✅ 修复：同时更新 nodes 和 cachedTree，避免清空 childrenIndex 导致树重建失败
   *
   * @param id - 节点ID
   * @param changes - 要更新的字段
   */
  function updateNode(id: string, changes: Partial<BookmarkNode>) {
    const existingNode = nodes.value.get(id)
    if (!existingNode) {
      logger.warn('BookmarkStore', 'updateNode - node not found', { id })
      return
    }

    logger.debug('BookmarkStore', 'updateNode', {
      id,
      changes,
      existing: {
        title: existingNode.title,
        url: existingNode.url,
        isFavorite: existingNode.isFavorite
      }
    })

    // 🆕 使用 Immer 不可变更新 nodes Map
    updateMap(nodes, draft => {
      const node = draft.get(id)
      if (node) {
        const updatedNode = { ...node, ...changes }
        draft.set(id, updatedNode)
      }
    })

    // ✅ 同时更新 cachedTree 中的节点（递归查找并更新）
    if (cachedTree.value.length > 0) {
      const updateInTree = (nodes: BookmarkNode[]): boolean => {
        for (const node of nodes) {
          if (node.id === id) {
            Object.assign(node, changes)
            return true
          }
          if (node.children && node.children.length > 0) {
            if (updateInTree(node.children)) {
              return true
            }
          }
        }
        return false
      }

      // 使用 updateRef 安全地更新 cachedTree
      updateRef(cachedTree, draft => {
        updateInTree(draft)
      })
    }

    // ✅ 同时更新 childrenIndex 中的节点引用
    updateMap(childrenIndex, draft => {
      for (const [_parentId, children] of draft.entries()) {
        const index = children.findIndex(child => child.id === id)
        if (index !== -1) {
          const updatedNode = { ...children[index], ...changes }
          children[index] = updatedNode
        }
      }
    })

    lastUpdated.value = Date.now()
  }

  /**
   * 清空所有节点（用于全量刷新）
   */
  function clearNodes() {
    logger.debug('BookmarkStore', 'clearNodes')
    // ✅ 使用 updateMap 安全地清空 Map（避免 Immer 冻结错误）
    updateMap(nodes, draft => draft.clear())
  }

  // --- Initialization ---
  // 自动设置事件监听器
  setupListener()

  // 注意：不在 Store 初始化时自动加载数据
  // 需要在组件中显式调用 loadFromIndexedDB()

  return {
    nodes,
    childrenIndex,
    isLoading,
    loadingChildren,
    lastUpdated,
    selectedDescCounts,
    bookmarkTree,
    favoriteBookmarks,
    // 数据加载（唯一数据源：IndexedDB）
    loadFromIndexedDB,
    reset,
    // helpers
    getNodeById,
    getParentId,
    getAncestors,
    getDescendantBookmarksCount,
    recomputeSelectedDescCounts,
    // 增量更新方法
    addNodes,
    upsertNode,
    updateNode,
    removeNode,
    clearNodes
  }
})
