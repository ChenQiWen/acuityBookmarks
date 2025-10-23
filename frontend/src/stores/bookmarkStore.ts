/**
 * 书签存储 Store
 *
 * 职责：
 * - 管理书签节点的全局状态
 * - 提供书签树的计算属性
 * - 处理书签的增删改查操作
 * - 响应书签变更事件
 *
 * 设计：
 * - 使用 Map 存储节点以提升查找性能
 * - 计算属性自动构建树形结构
 * - 支持懒加载子节点
 * - 跟踪选中状态和后代统计
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { messageClient } from '@/infrastructure/chrome-api/message-client' // 消息工具函数
import PQueue from 'p-queue'
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'
import type { MessageResponse } from '@/infrastructure/chrome-api/message-client'

const DEFAULT_PAGE_SIZE = 200

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
  const fetchQueue = new PQueue({ concurrency: 2 })
  const pendingTasks = new Set<string>()
  const MAX_ROOT_FETCH_RETRY = 5
  const ROOT_FETCH_RETRY_DELAY_MS = 1000

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // --- Getters ---
  const bookmarkTree = computed(() => {
    const allNodes = nodes.value

    logger.debug('BookmarkStore', 'recomputeTree/start', {
      totalNodes: allNodes.size
    })

    if (allNodes.size === 0) {
      return []
    }

    // 构建父子映射，避免 O(n^2) 的全量扫描。
    const parentChildrenMap = childrenIndex.value
    if (parentChildrenMap.size === 0) {
      for (const node of allNodes.values()) {
        const parentId = node.parentId ?? '0'
        if (!parentChildrenMap.has(parentId)) {
          parentChildrenMap.set(parentId, [])
        }
        parentChildrenMap.get(parentId)!.push(node)
      }
      for (const childList of parentChildrenMap.values()) {
        childList.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      }
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

  // --- Actions ---

  /**
   * 添加书签节点到存储
   *
   * @param nodeArray - 要添加的书签节点数组
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

      nodes.value.set(node.id, node)

      const parentId = node.parentId ?? '0'
      if (!childrenIndex.value.has(parentId)) {
        childrenIndex.value.set(parentId, [])
      }
      const siblings = childrenIndex.value.get(parentId)!
      const existingIndex = siblings.findIndex(item => item.id === node.id)
      if (existingIndex >= 0) {
        siblings[existingIndex] = node
      } else {
        siblings.push(node)
      }

      const parentNode = nodes.value.get(parentId)
      if (parentNode && parentId !== '0') {
        parentNode.children = siblings
      }
    })

    logger.debug('BookmarkStore', 'addNodes/total', {
      total: nodes.value.size
    })
  }

  /**
   * 重置存储中的所有节点和索引
   */
  function reset() {
    nodes.value.clear()
    childrenIndex.value.clear()
    selectedDescCounts.value.clear()
    loadingChildren.value.clear()
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
   * 获取根节点列表
   *
   * 从后台脚本获取书签树的根节点（书签栏、其他书签等）
   *
   * @throws 当获取失败或数据验证失败时抛出错误
   */
  async function fetchRootNodes() {
    logger.info('BookmarkStore', 'fetchRootNodes/start')
    isLoading.value = true
    try {
      let attempt = 0
      while (attempt <= MAX_ROOT_FETCH_RETRY) {
        logger.debug('BookmarkStore', 'fetchRootNodes/sendRequest', {
          attempt
        })
        const result = await messageClient.sendMessage({
          type: 'get-tree-root'
        })

        if (!result.ok) {
          throw result.error
        }

        const res = result.value as MessageResponse<unknown>
        logger.debug('BookmarkStore', 'fetchRootNodes/response', res)

        const meta = (res.meta ?? undefined) as
          | { notReady?: boolean; failFast?: boolean }
          | undefined

        if (meta?.notReady || meta?.failFast) {
          attempt += 1
          logger.info('BookmarkStore', 'fetchRootNodes/notReady', {
            attempt,
            meta
          })
          if (attempt > MAX_ROOT_FETCH_RETRY) {
            logger.warn(
              'BookmarkStore',
              'fetchRootNodes 超过重试次数，返回空列表'
            )
            reset()
            break
          }
          await delay(ROOT_FETCH_RETRY_DELAY_MS)
          continue
        }

        const items = Array.isArray(res.value)
          ? (res.value as BookmarkNode[])
          : []

        reset()
        addNodes(items)
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Root nodes loaded: ${items.length} items.`
        )
        logger.debug('BookmarkStore', 'fetchRootNodes/done')
        break
      }
    } catch (error) {
      console.error('[fetchRootNodes] ❌ 获取失败:', error)
      logger.error(
        'Component',
        'BookmarkStore',
        '❌ Fetching root nodes failed:',
        (error as Error).message
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function fetchChildren(
    parentId: string,
    limit: number = DEFAULT_PAGE_SIZE,
    offset: number = 0
  ) {
    const cachedChildren = childrenIndex.value.get(parentId)
    if (cachedChildren && cachedChildren.length >= offset + limit) {
      logger.debug('BookmarkStore', 'fetchChildren/cache-hit', {
        parentId,
        limit,
        offset
      })
      const parentNode = nodes.value.get(parentId)
      if (parentNode) {
        parentNode.children = cachedChildren
      }
      return
    }

    const taskKey = `${parentId}:${offset}`
    if (pendingTasks.has(taskKey)) {
      logger.debug('BookmarkStore', 'fetchChildren/pending', {
        parentId,
        offset
      })
      return
    }
    pendingTasks.add(taskKey)

    logger.debug('BookmarkStore', 'fetchChildren/start', {
      parentId,
      limit,
      offset
    })

    logger.info('BookmarkStore', ` fetching children for ${parentId}...`)
    loadingChildren.value.add(parentId)
    try {
      const response = await fetchQueue.add(async () => {
        const result = await messageClient.getChildrenPaged(
          parentId,
          limit,
          offset
        )
        if (!result.ok) {
          throw result.error ?? new Error('Failed to fetch children')
        }
        return result.value as MessageResponse<BookmarkNode[]>
      })

      if (!response) {
        throw new Error(`Failed to fetch children for ${parentId}`)
      }

      if (response.ok !== true) {
        logger.error(
          'BookmarkStore',
          `❌ Children response for ${parentId} not ok:`,
          response
        )
        throw new Error(`Children response for ${parentId} failed`)
      }

      const payload = response.value

      if (!Array.isArray(payload)) {
        logger.error(
          'BookmarkStore',
          `❌ Children for ${parentId} is not an array:`,
          payload
        )
        throw new Error(`Invalid children data for ${parentId}: not an array`)
      }

      logger.debug('BookmarkStore', 'fetchChildren/items', {
        count: payload.length,
        preview: payload
          .slice(0, 3)
          .map((n: BookmarkNode) => ({ id: n.id, title: n.title }))
      })

      const children = payload
      addNodes(children)
      const parentNode = nodes.value.get(parentId)
      if (parentNode) {
        parentNode._childrenLoaded = true
        const cached = childrenIndex.value.get(parentId)
        if (cached) {
          parentNode.children = cached
          parentNode.childrenCount = Math.max(
            parentNode.childrenCount ?? cached.length,
            cached.length
          )
        }
        logger.debug('BookmarkStore', 'fetchChildren/markLoaded', {
          parentId
        })
      } else {
        logger.warn('BookmarkStore', 'fetchChildren/missingParent', {
          parentId
        })
      }
      lastUpdated.value = Date.now()
      logger.info(
        'BookmarkStore',
        `✅ Children for ${parentId} loaded: ${children.length} items.`
      )
    } catch (error) {
      logger.error(
        'Component',
        'BookmarkStore',
        `❌ Fetching children for ${parentId} failed:`,
        (error as Error).message
      )
    } finally {
      loadingChildren.value.delete(parentId)
      pendingTasks.delete(taskKey)
      logger.debug('BookmarkStore', 'fetchChildren/final', { parentId })
    }
  }

  async function fetchMoreChildren(
    parentId: string,
    limit: number = DEFAULT_PAGE_SIZE
  ) {
    const parentNode = nodes.value.get(parentId)
    const loaded = Array.isArray(parentNode?.children)
      ? parentNode!.children!.length
      : 0
    const total = parentNode?.childrenCount ?? loaded
    if (loaded >= total) return
    await fetchChildren(parentId, limit, loaded)
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
        nodes.value.delete(payload.id) // payload 类型已由 switch 语句推断
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
          // 使用更具体的类型
          if (message.channel === 'bookmarks-changed') {
            handleBookmarkChange(message.data)
            // 同步响应，直接返回，不标记异步
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

    nodes.value.set(node.id, node)
    lastUpdated.value = Date.now()
  }

  /**
   * 删除单个书签节点
   *
   * @param id - 要删除的节点ID
   */
  function removeNode(id: string) {
    logger.debug('BookmarkStore', 'removeNode', { id })
    nodes.value.delete(id)
    lastUpdated.value = Date.now()
  }

  /**
   * 更新节点的部分字段
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
        url: existingNode.url
      }
    })

    const updatedNode = { ...existingNode, ...changes }
    nodes.value.set(id, updatedNode)
    lastUpdated.value = Date.now()
  }

  /**
   * 清空所有节点（用于全量刷新）
   */
  function clearNodes() {
    logger.debug('BookmarkStore', 'clearNodes')
    nodes.value.clear()
  }

  // --- Initialization ---
  // 安全初始化：确保无论如何都要重置loading状态
  fetchRootNodes().catch(error => {
    console.error('BookmarkStore初始化失败:', error)
    isLoading.value = false // 确保loading状态被重置
  })
  setupListener()

  return {
    nodes,
    childrenIndex,
    isLoading,
    loadingChildren,
    lastUpdated,
    selectedDescCounts,
    bookmarkTree,
    fetchChildren,
    fetchMoreChildren,
    fetchRootNodes,
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
