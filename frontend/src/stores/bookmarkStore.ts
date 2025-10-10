import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { treeAppService } from '@/application/bookmark/tree-app-service'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'

export const useBookmarkStore = defineStore('bookmarks', () => {
  // --- State ---
  const bookmarks = ref<any[]>([])
  const isLoading = ref(true)
  const lastUpdated = ref<number | null>(null)

  // --- Getters ---
  const bookmarkTree = computed(() => {
    return treeAppService.buildViewTreeFromFlat(bookmarks.value)
  })

  // --- Actions ---

  /**
   * 从后台获取所有书签并初始化 Store
   */
  async function initializeStore() {
    logger.info('BookmarkStore', '🚀 Initializing bookmark store...')
    isLoading.value = true
    try {
      const res = await bookmarkAppService.getAllBookmarks()
      if (res.ok) {
        bookmarks.value = res.value
        lastUpdated.value = Date.now()
        logger.info(
          'BookmarkStore',
          `✅ Store initialized with ${bookmarks.value.length} bookmarks.`
        )
      } else {
        throw new Error(
          typeof res.error === 'string'
            ? res.error
            : 'Failed to fetch bookmarks'
        )
      }
    } catch (error) {
      logger.error(
        'BookmarkStore',
        '❌ Initialization failed:',
        (error as Error).message
      )
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 处理来自后台的精确更新消息
   * @param message - The structured message from the background script
   */
  function handleBookmarkChange(message: { type: string; payload: any }) {
    logger.debug('BookmarkStore', 'Received bookmark change:', message)
    const { type, payload } = message

    switch (type) {
      case 'BOOKMARK_CREATED':
        bookmarks.value.push(payload)
        break

      case 'BOOKMARK_REMOVED':
        bookmarks.value = bookmarks.value.filter(b => b.id !== payload.id)
        break

      case 'BOOKMARK_UPDATED':
        {
          const index = bookmarks.value.findIndex(b => b.id === payload.id)
          if (index !== -1) {
            Object.assign(bookmarks.value[index], payload.changes)
          }
        }
        break

      case 'BOOKMARK_MOVED':
        {
          const index = bookmarks.value.findIndex(b => b.id === payload.id)
          if (index !== -1) {
            bookmarks.value[index].parentId = payload.parentId
            bookmarks.value[index].index = payload.index
          }
        }
        break

      case 'CHILDREN_REORDERED':
        {
          // This is more complex as it affects multiple nodes' indices.
          // A simple and robust way is to re-fetch the children of the parent.
          // For a more granular approach, we would update the index of each child.
          const childIds = payload.childIds
          childIds.forEach((childId: string, index: number) => {
            const bookmarkIndex = bookmarks.value.findIndex(
              b => b.id === childId
            )
            if (bookmarkIndex !== -1) {
              bookmarks.value[bookmarkIndex].index = index
            }
          })
        }
        break

      default:
        logger.warn('BookmarkStore', `Unknown message type: ${type}`)
    }
    lastUpdated.value = Date.now()
  }

  /**
   * 设置监听器以接收来自后台的更新
   */
  function setupListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.channel === 'bookmarks-changed') {
        handleBookmarkChange(message.data)
        sendResponse({ status: 'ok' })
      }
      // Return true to indicate you wish to send a response asynchronously
      return true
    })
    logger.info(
      'BookmarkStore',
      '🎧 Listening for bookmark changes from background script.'
    )
  }

  // --- Initialization ---
  initializeStore()
  setupListener()

  return {
    bookmarks,
    isLoading,
    lastUpdated,
    bookmarkTree,
    initializeStore
  }
})
