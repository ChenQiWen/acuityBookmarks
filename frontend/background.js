// Minimal but functional Chrome MV3 Service Worker (module)
// - Handles common messages from extension pages
// - Opens management/settings pages
// - Provides notification helpers

// 静态导入（Service Worker 不支持动态 import）
import { bookmarkSyncService } from './src/services/bookmark-sync-service.js'
import './src/services/bookmark-crawler-trigger.js'

// 🎯 初始化服务（延迟加载）
async function initializeServices() {
  try {
    // 1. 初始化书签同步服务
    console.log('📚 初始化书签同步服务...')

    // 2. 同步书签到 IndexedDB
    console.log('🔄 开始同步书签到 IndexedDB...')
    await bookmarkSyncService.syncAllBookmarks()
    console.log('✅ 书签同步完成')

    // 3. Bookmark Crawler 已通过静态导入初始化
    console.log('✅ Bookmark Crawler 已初始化')

    // 4. 等待书签加载完成后自动开始爬取
    await startInitialCrawl()
  } catch (error) {
    console.error('❌ 服务初始化失败:', error)
  }
}

// 延迟执行初始化
setTimeout(initializeServices, 100)

/**
 * 初始爬取：等待 Chrome API 获取所有书签后开始爬取
 */
async function startInitialCrawl() {
  try {
    console.log('📚 正在获取所有书签...')

    // 1. 获取所有书签树
    const tree = await chrome.bookmarks.getTree()

    // 2. 扁平化书签树并提取所有 URL 书签（非文件夹）
    const allBookmarks = []
    function traverse(nodes) {
      for (const node of nodes) {
        if (node.url) {
          allBookmarks.push(node)
        }
        if (node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(tree)

    console.log(`📊 找到 ${allBookmarks.length} 个书签`)

    // 3. 去重（基于 URL）
    const uniqueBookmarks = []
    const seenUrls = new Set()
    for (const bookmark of allBookmarks) {
      if (!seenUrls.has(bookmark.url)) {
        seenUrls.add(bookmark.url)
        uniqueBookmarks.push(bookmark)
      }
    }

    console.log(`✅ 去重后剩余 ${uniqueBookmarks.length} 个书签`)

    // 4. 开始爬取（使用 bookmarkCrawler API，直接传入 Chrome 书签对象）
    if (globalThis.bookmarkCrawler && uniqueBookmarks.length > 0) {
      console.log('🚀 开始批量爬取书签...')

      // 使用低优先级批量爬取，避免影响用户体验
      globalThis.bookmarkCrawler.crawlChromeBookmarks(uniqueBookmarks, {
        onProgress: (current, total) => {
          if (current % 10 === 0 || current === total) {
            console.log(`⏳ 爬取进度: ${current}/${total}`)
          }
        },
        onComplete: stats => {
          console.log('🎉 初始爬取完成:', stats)
        }
      })
    } else {
      console.warn('⚠️ bookmarkCrawler 未就绪或没有书签需要爬取')
    }
  } catch (error) {
    console.error('❌ 初始爬取失败:', error)
  }
}

function openManagementPage() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('management.html')
      : 'management.html'
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url })
    }
  } catch {
    console.warn(
      'openManagementPage',
      'create lastError:',
      chrome.runtime.lastError?.message
    )
  }
}

function openSettingsPage() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('settings.html')
      : 'settings.html'
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url })
    }
  } catch {
    console.warn(
      'openSettingsPage',
      'create lastError:',
      chrome.runtime.lastError?.message
    )
  }
}

// Export for unknown modules that may import these
export { openManagementPage, openSettingsPage }

// Message handling
chrome?.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
  try {
    const type = msg && msg.type
    switch (type) {
      case 'ACUITY_NOTIFY_PING': {
        sendResponse({ ok: true })
        return
      }
      case 'ACUITY_NOTIFY': {
        const data = msg?.data || {}
        const title = data.title || 'Acuity'
        const message = data.message || ''
        const iconUrl =
          data.iconUrl ||
          (chrome?.runtime?.getURL
            ? chrome.runtime.getURL('logo.png')
            : 'logo.png')
        if (chrome?.notifications?.create) {
          chrome.notifications.create(
            { type: 'basic', title, message, iconUrl },
            id => {
              try {
                sendResponse({ notificationId: id || '' })
              } catch {
                console.warn(
                  'ACUITY_NOTIFY',
                  'create lastError:',
                  chrome.runtime.lastError?.message
                )
              }
            }
          )
          return true // async response
        }
        sendResponse({ notificationId: '' })
        return
      }
      case 'ACUITY_NOTIFY_CLEAR': {
        const id = msg?.data?.notificationId
        if (chrome?.notifications?.clear && id) {
          chrome.notifications.clear(id, () => {
            try {
              sendResponse({ ok: true })
            } catch {
              console.warn(
                'ACUITY_NOTIFY_CLEAR',
                'clear lastError:',
                chrome.runtime.lastError?.message
              )
            }
          })
          return true // async response
        }
        sendResponse({ ok: true })
        return
      }
      case 'OPEN_MANAGEMENT_PAGE': {
        openManagementPage()
        // 与前端约定：返回 success 字段用于判断
        sendResponse({ success: true, status: 'success' })
        return
      }
      case 'OPEN_SETTINGS_PAGE': {
        openSettingsPage()
        // 与前端约定：返回 success 字段用于判断
        sendResponse({ success: true, status: 'success' })
        return
      }
      case 'SYNC_BOOKMARKS': {
        // Stub: acknowledge sync request
        sendResponse({ ok: true })
        return
      }
      case 'get-bookmarks-paged': {
        ;(async () => {
          try {
            const limit = msg?.data?.limit ?? 100
            const offset = msg?.data?.offset ?? 0
            // 使用顶层静态导入的 bookmarkSyncService
            const items = await bookmarkSyncService.getAllBookmarks(
              limit,
              offset
            )
            sendResponse({
              ok: true,
              value: { items, limit, offset, total: items.length }
            })
          } catch (e) {
            sendResponse({ ok: false, error: String(e) })
          }
        })()
        return true // 异步响应
      }
      case 'get-children-paged': {
        ;(async () => {
          try {
            const parentId = msg?.data?.parentId ?? ''
            const limit = msg?.data?.limit ?? 100
            const offset = msg?.data?.offset ?? 0
            // 使用顶层静态导入的 bookmarkSyncService
            const items = await bookmarkSyncService.getChildrenByParentId(
              parentId,
              offset,
              limit
            )
            sendResponse({
              ok: true,
              value: { parentId, items, limit, offset, total: items.length }
            })
          } catch (e) {
            sendResponse({ ok: false, error: String(e) })
          }
        })()
        return true // 异步响应
      }
      case 'get-tree-root': {
        ;(async () => {
          try {
            // 使用顶层静态导入的 bookmarkSyncService
            const items = await bookmarkSyncService.getRootBookmarks()
            sendResponse({
              ok: true,
              value: items
            })
          } catch (e) {
            sendResponse({ ok: false, error: String(e) })
          }
        })()
        return true // 异步响应
      }
      default: {
        // Always respond to avoid runtime.lastError in callers
        sendResponse({ status: 'noop' })
        return
      }
    }
  } catch (e) {
    try {
      sendResponse({ status: 'error', message: String(e) })
    } catch {
      console.warn(
        'background.js',
        'onMessage lastError:',
        chrome.runtime.lastError?.message
      )
    }
  }
  // If we reach here synchronously, do not return true
})

// Optional: create context menus quickly (no imports required)
// 使用 onInstalled 事件避免重复创建
chrome.runtime.onInstalled.addListener(() => {
  try {
    if (chrome?.contextMenus) {
      // 先清除所有现有菜单
      chrome.contextMenus.removeAll(() => {
        // 创建新菜单
        chrome.contextMenus.create({
          id: 'ab-open-management',
          title: '打开书签管理',
          contexts: ['action']
        })
        chrome.contextMenus.create({
          id: 'ab-open-settings',
          title: '打开设置',
          contexts: ['action']
        })
      })
    }
  } catch (e) {
    console.warn('create context menus failed:', e)
  }
})

// 监听上下文菜单点击（只注册一次）
if (chrome?.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(info => {
    if (info.menuItemId === 'ab-open-management') openManagementPage()
    if (info.menuItemId === 'ab-open-settings') openSettingsPage()
  })
}
