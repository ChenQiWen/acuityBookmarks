import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { sendMessageToBackend } from '@/utils/message' // 假设有一个消息工具函数
import type { BookmarkNode } from '@/types'

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

// Generic response type from backend
interface BackendResponse<T> {
  ok: boolean
  value?: T
  error?: string
}

export const useBookmarkStore = defineStore('bookmarks', () => {
  // --- State ---
  const nodes = ref<Map<string, BookmarkNode>>(new Map())
  const isLoading = ref(true)
  const lastUpdated = ref<number | null>(null)
  // 跟踪正在加载子节点的文件夹
  const loadingChildren = ref<Set<string>>(new Set())

  // --- Getters ---
  const bookmarkTree = computed(() => {
    const tree: BookmarkNode[] = []
    const allNodes = nodes.value
    // 首先找到所有根节点 (没有父节点或者父节点不存在于Map中的节点)
    // 在我们的例子中，根节点是 parentId 为 '0' 的节点
    for (const node of allNodes.values()) {
      if (node.parentId === '0') {
        tree.push(node)
      }
    }

    // 递归地为节点构建 children 数组
    const buildChildren = (node: BookmarkNode) => {
      // 每次构建时都清空并重新填充 children 数组
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

  // --- Actions ---

  function addNodes(nodeArray: BookmarkNode[]) {
    nodeArray.forEach(node => {
      // 为文件夹添加一个状态，表示其子节点是否已加载
      if (node.childrenCount && node.childrenCount > 0 && !node.children) {
        node.children = [] // 初始化为空数组，用于后续填充
        node._childrenLoaded = false
      }
      nodes.value.set(node.id, node)
    })
  }

  async function fetchRootNodes() {
    logger.info('BookmarkStore', '🚀 Fetching root nodes...')
    isLoading.value = true
    try {
      const res = (await sendMessageToBackend({
        type: 'get-tree-root'
      })) as BackendResponse<BookmarkNode[]>

      if (
        res &&
        res !== null &&
        typeof res === 'object' &&
        res.ok &&
        res.value
      ) {
        // 增加 res !== null 检查
        addNodes(res.value)
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Root nodes loaded: ${res.value.length} items.`
        )
      } else {
        throw new Error(res?.error || 'Failed to fetch root nodes')
      }
    } catch (error) {
      logger.error(
        'BookmarkStore',
        '❌ Fetching root nodes failed:',
        (error as Error).message
      )
    } finally {
      isLoading.value = false
    }
  }

  async function fetchChildren(parentId: string) {
    if (loadingChildren.value.has(parentId)) return

    logger.info('BookmarkStore', ` fetching children for ${parentId}...`)
    loadingChildren.value.add(parentId)
    try {
      const res = (await sendMessageToBackend({
        type: 'get-children',
        payload: { parentId }
      })) as BackendResponse<BookmarkNode[]>
      if (
        res &&
        res !== null &&
        typeof res === 'object' &&
        res.ok &&
        res.value
      ) {
        // 增加 res !== null 检查
        addNodes(res.value)
        const parentNode = nodes.value.get(parentId)
        if (parentNode) {
          parentNode._childrenLoaded = true
        }
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Children for ${parentId} loaded: ${res.value.length} items.`
        )
      } else {
        throw new Error(
          res?.error || `Failed to fetch children for ${parentId}`
        )
      }
    } catch (error) {
      logger.error(
        'BookmarkStore',
        `❌ Fetching children for ${parentId} failed:`,
        (error as Error).message
      )
    } finally {
      loadingChildren.value.delete(parentId)
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
        // This will cause a compile-time error if any case is missed.
        exhaustiveCheck(message)
    }
    lastUpdated.value = Date.now()
  }

  function setupListener() {
    chrome.runtime.onMessage.addListener(
      (message: ChromeRuntimeBookmarkMessage, _sender, sendResponse) => {
        // 使用更具体的类型
        if (message.channel === 'bookmarks-changed') {
          handleBookmarkChange(message.data)
          sendResponse({ status: 'ok' })
        } // Return true to indicate you wish to send a response asynchronously
        // (even if we are sending it synchronously here, it's good practice).
        return true
      }
    )
    logger.info(
      'BookmarkStore',
      '🎧 Listening for bookmark changes from background script.'
    )
  }

  // --- Initialization ---
  fetchRootNodes()
  setupListener()

  return {
    nodes,
    isLoading,
    loadingChildren,
    lastUpdated,
    bookmarkTree,
    fetchChildren,
    fetchRootNodes
  }
})
