export function initializeMessageHandler(handlers) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    ;(async () => {
      try {
        switch (message.type) {
          case 'TOGGLE_SIDEBAR':
            await handlers.toggleSidePanelUnified('右键菜单')
            sendResponse({ status: 'success' })
            break
          case 'SHOW_NOTIFICATION':
            handlers.showNotification(
              message.payload.title,
              message.payload.message,
              message.payload.iconUrl,
              message.payload.buttons
            )
            sendResponse({ status: 'success' })
            break
          case 'HEALTH_CHECK': {
            const health = await handlers.getHealth()
            sendResponse({ status: 'success', data: health })
            break
          }
          // Bookmark actions
          case 'GET_BOOKMARK_SUBTREE': {
            const subtree = await handlers.getBookmarkSubtree(
              message.payload.id
            )
            sendResponse({ status: 'success', data: subtree })
            break
          }
          case 'GET_BOOKMARK_NODES': {
            const nodes = await handlers.getBookmarkNodes(message.payload.ids)
            sendResponse({ status: 'success', data: nodes })
            break
          }
          case 'GET_BOOKMARK_CHILDREN': {
            const children = await handlers.getBookmarkChildren(
              message.payload.id
            )
            sendResponse({ status: 'success', data: children })
            break
          }
          case 'GET_PAGINATED_BOOKMARKS': {
            const { parentId, page, pageSize } = message.payload
            const paginatedBookmarks = await handlers.getPaginatedBookmarks(
              parentId,
              page,
              pageSize
            )
            sendResponse({ status: 'success', data: paginatedBookmarks })
            break
          }
          case 'SEARCH_BOOKMARKS': {
            const bookmarks = await handlers.searchBookmarks(
              message.payload.query
            )
            sendResponse({ status: 'success', data: bookmarks })
            break
          }
          case 'SYNC_BOOKMARKS': {
            await handlers.syncBookmarks()
            sendResponse({ status: 'success' })
            break
          }
          // Settings actions
          case 'GET_SETTINGS': {
            const settings = await handlers.getSettings()
            sendResponse({ status: 'success', data: settings })
            break
          }
          case 'UPDATE_SETTINGS': {
            await handlers.updateSettings(message.payload)
            sendResponse({ status: 'success' })
            break
          }
          // Sidebar state actions
          case 'GET_SIDEBAR_STATE': {
            const state = await handlers.getSidebarState()
            sendResponse({ status: 'success', data: state })
            break
          }
          case 'SET_SIDEBAR_STATE': {
            await handlers.setSidebarState(message.payload)
            sendResponse({ status: 'success' })
            break
          }
          // Search history actions
          case 'GET_SEARCH_HISTORY': {
            const history = await handlers.getSearchHistory()
            sendResponse({ status: 'success', data: history })
            break
          }
          case 'ADD_SEARCH_HISTORY': {
            await handlers.addSearchHistory(message.payload.term)
            sendResponse({ status: 'success' })
            break
          }
          case 'DELETE_SEARCH_HISTORY': {
            await handlers.deleteSearchHistory(message.payload.term)
            sendResponse({ status: 'success' })
            break
          }
          case 'CLEAR_SEARCH_HISTORY': {
            await handlers.clearSearchHistory()
            sendResponse({ status: 'success' })
            break
          }
          // Page actions
          case 'OPEN_MANAGEMENT_PAGE': {
            await handlers.openManagementPage()
            sendResponse({ status: 'success' })
            break
          }
          case 'OPEN_SETTINGS_PAGE': {
            await handlers.openSettingsPage()
            sendResponse({ status: 'success' })
            break
          }
          // AI actions
          case 'GENERATE_TAGS': {
            const tags = await handlers.generateTagsForBookmark(
              message.payload.bookmark
            )
            sendResponse({ status: 'success', data: tags })
            break
          }
          case 'GENERATE_EMBEDDINGS': {
            const embeddings = await handlers.generateEmbeddingsForBookmark(
              message.payload.bookmark
            )
            sendResponse({ status: 'success', data: embeddings })
            break
          }
          case 'SEMANTIC_SEARCH': {
            const results = await handlers.semanticSearch(message.payload.query)
            sendResponse({ status: 'success', data: results })
            break
          }
          // Vectorize actions
          case 'ADD_OR_UPDATE_VECTOR': {
            const { id, values, metadata } = message.payload
            await handlers.addOrUpdateVector(id, values, metadata)
            sendResponse({ status: 'success' })
            break
          }
          case 'QUERY_VECTORS': {
            const { vector, topK } = message.payload
            const results = await handlers.queryVectors(vector, topK)
            sendResponse({ status: 'success', data: results })
            break
          }
          default:
            sendResponse({ status: 'error', message: 'Unknown message type' })
            break
        }
      } catch (error) {
        console.error(`Error handling message type ${message.type}:`, error)
        sendResponse({ status: 'error', message: error.message })
      }
    })()
    return true // Indicates that the response is sent asynchronously
  })
}
