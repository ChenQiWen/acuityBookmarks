import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { messageClient } from '@/infrastructure/chrome-api/message-client' // 消息工具函数
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'

// Define specific payload types for each message type
interface BookmarkCreatedPayload extends BookmarkNode {}

interface BookmarkRemovedPayload {
  id: string
}

interface BookmarkUpdatedPayload {
  id: string
  changes: Partial<BookmarkNode> // Changes can be partial
}

interface BookmarkMovedPayload {
  id: string
  parentId: string
  index: number
}

interface ChildrenReorderedPayload {
  childIds: string[]
}

// Union type for all possible bookmark change data
type BookmarkChangeData =
  | { type: 'BOOKMARK_CREATED'; payload: BookmarkCreatedPayload }
  | { type: 'BOOKMARK_REMOVED'; payload: BookmarkRemovedPayload }
  | { type: 'BOOKMARK_UPDATED'; payload: BookmarkUpdatedPayload }
  | { type: 'BOOKMARK_MOVED'; payload: BookmarkMovedPayload }
  | { type: 'CHILDREN_REORDERED'; payload: ChildrenReorderedPayload }

// Message structure for chrome.runtime.onMessage
interface ChromeRuntimeBookmarkMessage {
  channel: 'bookmarks-changed'
  data: BookmarkChangeData
}

export const useBookmarkStore = defineStore('bookmarks', () => {
  // --- State ---
  const nodes = ref<Map<string, BookmarkNode>>(new Map())
  const isLoading = ref(true)
  const lastUpdated = ref<number | null>(null)
  // 跟踪正在加载子节点的文件夹
  const loadingChildren = ref<Set<string>>(new Set())
  // 已选后代书签数量统计：key=folderId, value=其后代已选中的书签数
  const selectedDescCounts = ref<Map<string, number>>(new Map())

  // --- Getters ---
  const bookmarkTree = computed(() => {
    const allNodes = nodes.value

    console.log(
      '[bookmarkTree] 🔄 重新计算书签树，当前节点总数:',
      allNodes.size
    )

    // 防止循环引用的保护
    const processed = new Set<string>()

    // 递归构建树结构 - 创建新对象而不是修改原对象
    const buildNode = (node: BookmarkNode): BookmarkNode => {
      // 防止循环引用
      if (processed.has(node.id)) {
        return { ...node, children: [] }
      }
      processed.add(node.id)

      // 查找并构建子节点
      const children: BookmarkNode[] = []
      for (const potentialChild of allNodes.values()) {
        if (potentialChild.parentId === node.id) {
          children.push(potentialChild)
        }
      }

      // 排序子节点
      children.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

      // 递归构建子节点（如果有的话）
      const builtChildren = children.map(child => buildNode(child))

      // 返回新的节点对象（浅拷贝+新的children数组）
      return {
        ...node,
        children: builtChildren
      }
    }

    // 找到所有根节点
    const rootNodes: BookmarkNode[] = []
    for (const node of allNodes.values()) {
      if (node.parentId === '0') {
        rootNodes.push(node)
      }
    }

    console.log('[bookmarkTree] 📊 找到根节点数:', rootNodes.length)
    console.log(
      '[bookmarkTree] 📋 根节点详情:',
      rootNodes.map(n => ({
        id: n.id,
        title: n.title || '【无标题】',
        parentId: n.parentId,
        childrenCount: n.childrenCount
      }))
    )

    // 构建完整的树
    const tree = rootNodes.map(node => buildNode(node))
    tree.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

    console.log(
      '[bookmarkTree] ✅ 树构建完成，根节点:',
      tree.length,
      '总处理节点:',
      processed.size
    )

    return tree
  })

  // --- Actions ---

  function addNodes(nodeArray: BookmarkNode[]) {
    // ✅ 添加数组检查，防止传入非数组数据
    if (!Array.isArray(nodeArray)) {
      logger.error('BookmarkStore', '❌ addNodes收到非数组数据:', nodeArray)
      return
    }

    console.log('[BookmarkStore] ➕ addNodes 添加节点:', nodeArray.length, '条')
    console.log(
      '[BookmarkStore] 📋 节点详情:',
      nodeArray.map(n => ({
        id: n.id,
        title: n.title || '【无标题】',
        parentId: n.parentId,
        childrenCount: n.childrenCount,
        isFolder: n.isFolder
      }))
    )

    nodeArray.forEach(node => {
      // 为文件夹添加一个状态，表示其子节点是否已加载
      if (node.childrenCount && node.childrenCount > 0 && !node.children) {
        node.children = [] // 初始化为空数组，用于后续填充
        node._childrenLoaded = false
      }
      nodes.value.set(node.id, node)
    })

    console.log('[BookmarkStore] 📊 当前总节点数:', nodes.value.size)
  }

  // === Read-only helpers for tree relations ===
  function getNodeById(id: string | undefined): BookmarkNode | undefined {
    if (!id) return undefined
    return nodes.value.get(String(id))
  }

  function getParentId(id: string | undefined): string | undefined {
    const n = getNodeById(id || '')
    return n?.parentId
  }

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

  // 获取节点递归书签数（优先使用预聚合字段）
  function getDescendantBookmarksCount(id: string): number {
    const node = getNodeById(id)
    if (!node) return 0
    if (typeof node.bookmarksCount === 'number') return node.bookmarksCount
    if (typeof node.childrenCount === 'number') return node.childrenCount
    // 没有预聚合字段时，不做昂贵递归，返回0以避免阻塞
    return 0
  }

  // 基于“当前选中集合”重新计算已选后代书签计数（仅按书签叶子计数，避免双计）
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

  async function fetchRootNodes() {
    console.log('[fetchRootNodes] 🚀 开始获取根节点...')
    logger.info('BookmarkStore', '🚀 Fetching root nodes...')
    isLoading.value = true
    try {
      console.log('[fetchRootNodes] 📤 发送 get-tree-root 消息...')
      const result = await messageClient.sendMessage({
        type: 'get-tree-root'
      })

      // 调试：打印完整的返回结果
      console.log('[fetchRootNodes] 📬 收到响应:', result)

      const res = result.ok ? result.value : null

      // 调试：打印解析后的响应
      console.log('[fetchRootNodes] 🔍 解析响应:', res)

      if (res && res.ok && res.value) {
        const items = res.value as BookmarkNode[]
        console.log(
          `[fetchRootNodes] ✅ 响应有效，准备添加 ${items.length} 个节点`
        )
        console.log(
          '[fetchRootNodes] 📋 所有节点详情:',
          items.map(n => ({
            id: n.id,
            title: n.title || '【无标题】',
            parentId: n.parentId,
            childrenCount: n.childrenCount,
            isFolder: n.isFolder
          }))
        )

        // 增加 res !== null 检查
        addNodes(res.value as BookmarkNode[])
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Root nodes loaded: ${(res.value as BookmarkNode[]).length} items.`
        )

        console.log('[fetchRootNodes] ✅ 根节点加载完成')
      } else {
        console.error('[fetchRootNodes] ❌ 响应验证失败:', {
          hasRes: !!res,
          resOk: res?.ok,
          hasValue: !!res?.value,
          error: res?.error
        })
        throw new Error(res?.error || 'Failed to fetch root nodes')
      }
    } catch (error) {
      console.error('[fetchRootNodes] ❌ 获取失败:', error)
      logger.error(
        'Component',
        'BookmarkStore',
        '❌ Fetching root nodes failed:',
        (error as Error).message
      )
    } finally {
      isLoading.value = false
      console.log('[fetchRootNodes] 🏁 完成（isLoading =', isLoading.value, ')')
    }
  }

  async function fetchChildren(
    parentId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    console.log(
      `[fetchChildren] 🚀 开始: parentId=${parentId}, limit=${limit}, offset=${offset}`
    )

    if (loadingChildren.value.has(parentId)) {
      console.log(`[fetchChildren] ⏳ 已在加载中，跳过: parentId=${parentId}`)
      return
    }

    logger.info('BookmarkStore', ` fetching children for ${parentId}...`)
    loadingChildren.value.add(parentId)
    try {
      console.log(`[fetchChildren] 📨 调用 messageClient.getChildrenPaged...`)
      const result = await messageClient.getChildrenPaged(
        parentId,
        limit,
        offset
      )
      console.log(`[fetchChildren] 📬 收到响应:`, {
        ok: result.ok,
        hasValue: result.ok && !!result.value
      })

      const res = result.ok ? result.value : null
      if (
        res &&
        res !== null &&
        typeof res === 'object' &&
        res.ok &&
        res.value
      ) {
        // ✅ 严格检查res.value是数组
        if (!Array.isArray(res.value)) {
          logger.error(
            'BookmarkStore',
            `❌ Children for ${parentId} is not an array:`,
            res.value
          )
          throw new Error(`Invalid children data for ${parentId}: not an array`)
        }

        console.log(
          `[fetchChildren] ✅ 收到 ${(res.value as BookmarkNode[]).length} 个子节点`
        )
        console.log(
          `[fetchChildren] 📋 前3个子节点:`,
          (res.value as BookmarkNode[])
            .slice(0, 3)
            .map(n => ({ id: n.id, title: n.title }))
        )

        addNodes(res.value as BookmarkNode[])
        const parentNode = nodes.value.get(parentId)
        if (parentNode) {
          parentNode._childrenLoaded = true
          console.log(
            `[fetchChildren] ✅ 标记父节点 _childrenLoaded=true: ${parentId}`
          )
        } else {
          console.warn(`[fetchChildren] ⚠️ 找不到父节点: ${parentId}`)
        }
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Children for ${parentId} loaded: ${(res.value as BookmarkNode[]).length} items.`
        )
      } else {
        console.error(`[fetchChildren] ❌ 响应格式错误:`, res)
        throw new Error(
          res?.error || `Failed to fetch children for ${parentId}`
        )
      }
    } catch (error) {
      console.error(`[fetchChildren] ❌ 加载失败:`, error)
      logger.error(
        'Component',
        'BookmarkStore',
        `❌ Fetching children for ${parentId} failed:`,
        (error as Error).message
      )
    } finally {
      loadingChildren.value.delete(parentId)
      console.log(`[fetchChildren] 🏁 完成: parentId=${parentId}`)
    }
  }

  async function fetchMoreChildren(parentId: string, limit: number = 100) {
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

  // --- Initialization ---
  // 安全初始化：确保无论如何都要重置loading状态
  fetchRootNodes().catch(error => {
    console.error('BookmarkStore初始化失败:', error)
    isLoading.value = false // 确保loading状态被重置
  })
  setupListener()

  return {
    nodes,
    isLoading,
    loadingChildren,
    lastUpdated,
    selectedDescCounts,
    bookmarkTree,
    fetchChildren,
    fetchMoreChildren,
    fetchRootNodes,
    // helpers
    getNodeById,
    getParentId,
    getAncestors,
    getDescendantBookmarksCount,
    recomputeSelectedDescCounts
  }
})
