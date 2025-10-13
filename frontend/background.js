// Minimal but functional Chrome MV3 Service Worker (module)
// - Handles common messages from extension pages
// - Opens management/settings pages
// - Provides notification helpers

// 🎯 初始化爬取工具（延迟加载）
// 使用动态 import 确保代码被加载和执行
async function initializeCrawler() {
  try {
    // 动态导入爬取工具，这会执行模块代码并挂载 globalThis.bookmarkCrawler
    await import('./src/services/bookmark-crawler-trigger.js')
    console.log('✅ Bookmark Crawler 已初始化')
    
    // 🚀 等待书签加载完成后自动开始爬取
    await startInitialCrawl()
  } catch (error) {
    console.error('❌ Bookmark Crawler 初始化失败:', error)
  }
}

// 延迟执行初始化
setTimeout(initializeCrawler, 100)

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
    
    // 4. 提取书签 ID 列表
    const bookmarkIds = uniqueBookmarks.map(b => b.id)
    
    // 5. 开始爬取（使用 bookmarkCrawler API）
    if (globalThis.bookmarkCrawler && bookmarkIds.length > 0) {
      console.log('🚀 开始批量爬取书签...')
      
      // 使用低优先级批量爬取，避免影响用户体验
      globalThis.bookmarkCrawler.crawlByIds(bookmarkIds, {
        onProgress: (current, total) => {
          if (current % 10 === 0 || current === total) {
            console.log(`⏳ 爬取进度: ${current}/${total}`)
          }
        },
        onComplete: (stats) => {
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
        try {
          const limit = msg?.data?.limit ?? 100
          const offset = msg?.data?.offset ?? 0
          // 轻量占位：返回空数组结构，避免前端报错
          sendResponse({
            ok: true,
            value: { items: [], limit, offset, total: 0 }
          })
        } catch (e) {
          sendResponse({ ok: false, error: String(e) })
        }
        return
      }
      case 'get-children-paged': {
        try {
          const parentId = msg?.data?.parentId ?? ''
          const limit = msg?.data?.limit ?? 100
          const offset = msg?.data?.offset ?? 0
          // 轻量占位：返回空孩子列表结构
          sendResponse({
            ok: true,
            value: { parentId, items: [], limit, offset, total: 0 }
          })
        } catch (e) {
          sendResponse({ ok: false, error: String(e) })
        }
        return
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
