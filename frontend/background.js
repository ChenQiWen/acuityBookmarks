// Minimal but functional Chrome MV3 Service Worker (module)
// - Handles common messages from extension pages
// - Opens management/settings pages
// - Provides notification helpers

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
try {
  if (chrome?.contextMenus?.create) {
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
    chrome.contextMenus.onClicked.addListener(info => {
      if (info.menuItemId === 'ab-open-management') openManagementPage()
      if (info.menuItemId === 'ab-open-settings') openSettingsPage()
    })
  }
} catch (e) {
  console.warn('create context menus failed:', e)
}
