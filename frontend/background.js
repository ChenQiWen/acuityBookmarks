// Minimal but functional Chrome MV3 Service Worker (module)
// - Handles common messages from extension pages
// - Opens management/settings pages
// - Provides notification helpers
// - 中心化监听书签变化并同步到 IndexedDB

// 静态导入（Service Worker 不支持动态 import）
import { bookmarkSyncService } from './src/services/bookmark-sync-service.js'
import { indexedDBManager } from './src/utils-legacy/indexeddb-manager.js'
// 移除 bookmark-crawler-trigger 的导入，因为它在 Service Worker 中有兼容性问题

// ===== 状态管理配置 =====
const STATE_KEYS = {
  INITIALIZED: 'AB_INITIALIZED', // 是否已完成首次初始化
  DB_READY: 'AB_DB_READY', // 数据库是否就绪
  SCHEMA_VERSION: 'AB_SCHEMA_VERSION', // 数据库架构版本
  BOOKMARK_COUNT: 'AB_BOOKMARK_COUNT', // 书签总数
  LAST_SYNCED_AT: 'AB_LAST_SYNCED_AT', // 上次同步时间戳
  INSTALL_REASON: 'AB_INSTALL_REASON' // 最后一次安装原因
}

const CURRENT_SCHEMA_VERSION = 8

/**
 * 获取扩展状态
 */
async function getExtensionState() {
  const result = await chrome.storage.local.get(Object.values(STATE_KEYS))
  return {
    initialized: result[STATE_KEYS.INITIALIZED] || false,
    dbReady: result[STATE_KEYS.DB_READY] || false,
    schemaVersion: result[STATE_KEYS.SCHEMA_VERSION] || 0,
    bookmarkCount: result[STATE_KEYS.BOOKMARK_COUNT] || 0,
    lastSyncedAt: result[STATE_KEYS.LAST_SYNCED_AT] || 0,
    installReason: result[STATE_KEYS.INSTALL_REASON] || null
  }
}

/**
 * 更新扩展状态
 */
async function updateExtensionState(updates) {
  const stateUpdates = {}
  if (updates.initialized !== undefined)
    stateUpdates[STATE_KEYS.INITIALIZED] = updates.initialized
  if (updates.dbReady !== undefined)
    stateUpdates[STATE_KEYS.DB_READY] = updates.dbReady
  if (updates.schemaVersion !== undefined)
    stateUpdates[STATE_KEYS.SCHEMA_VERSION] = updates.schemaVersion
  if (updates.bookmarkCount !== undefined)
    stateUpdates[STATE_KEYS.BOOKMARK_COUNT] = updates.bookmarkCount
  if (updates.lastSyncedAt !== undefined)
    stateUpdates[STATE_KEYS.LAST_SYNCED_AT] = updates.lastSyncedAt
  if (updates.installReason !== undefined)
    stateUpdates[STATE_KEYS.INSTALL_REASON] = updates.installReason

  await chrome.storage.local.set(stateUpdates)
  console.log('📊 [State] 状态已更新:', stateUpdates)
}

// 调试通知开关（仅开发阶段使用）
const DEV_NOTIFICATIONS = true
let notifyCounter = 0
function devNotify(message) {
  if (!DEV_NOTIFICATIONS || !chrome?.notifications?.create) return
  const title = 'AcuityBookmarks 调试'
  try {
    // 使用唯一 ID 和时间戳，确保每个通知都能显示
    const notificationId = `acuity-dev-${Date.now()}-${++notifyCounter}`
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title,
      message: String(message),
      priority: 2 // 高优先级
    })
    console.log(`📢 [Notification] ${message}`)
  } catch {
    console.warn('devNotify', 'failed:', message)
  }
}

// 🎯 初始化服务（按需调用：安装/启动时）
// 注意：此函数当前未使用，保留供未来需要
// async function initializeServices() {
//   try {
//     // 1. 初始化书签同步服务
//     console.log('📚 初始化书签同步服务...')
//     devNotify('初始化：开始')
//
//     // 2. 同步书签到 IndexedDB
//     console.log('🔄 开始同步书签到 IndexedDB...')
//     devNotify('初始化：开始全量同步')
//     await bookmarkSyncService.syncAllBookmarks()
//     console.log('✅ 书签同步完成')
//     devNotify('初始化：全量同步完成')
//
//     // 3. 强制检查书签数据完整性
//     console.log('🔍 检查书签数据完整性...')
//     const stats = await bookmarkSyncService.getAllBookmarks(999999, 0)
//     const totalBookmarks = stats.filter(b => b.url).length
//     console.log(`📊 检查完成，总书签数: ${totalBookmarks}`)
//     devNotify(`初始化：数据校验完成，总书签数 ${totalBookmarks}`)
//
//     if (totalBookmarks === 0) {
//       console.log('⚠️ 检测到书签数据丢失，强制重新同步...')
//       await bookmarkSyncService.syncAllBookmarks()
//       console.log('✅ 强制重新同步完成')
//     }
//
//     // 4. 设置书签变化监听器（中心化同步）
//     setupBookmarkChangeListeners()
//     devNotify('初始化：监听器已就绪')
//
//     // 5. Bookmark Crawler 已移除有问题的导入（已在静态导入中处理）
//
//     // 6. 等待书签加载完成后自动开始爬取
//     await startInitialCrawl()
//     devNotify('初始化：初始爬取完成')
//   } catch (error) {
//     console.error('❌ 服务初始化失败:', error)
//     devNotify('初始化失败')
//   }
// }

// 移除延迟初始化：仅在 onInstalled/onStartup 中调用，避免误导
// 在当前活动标签页注入原生 alert
async function injectAlert(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs || !tabs[0] || !tabs[0].id) return
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: msg => {
        // eslint-disable-next-line no-alert, no-undef
        alert(msg)
      },
      args: [String(message)]
    })
  } catch (e) {
    console.warn('injectAlert failed:', e)
  }
}

// 📝 注意：以下函数已注释，因为当前未使用
// 保留供未来需要时启用
/**
 * 🔄 设置书签变化监听器
 *
 * 架构原则：单向数据流
 * Chrome API → IndexedDB → 广播消息 → UI 更新
 */
// function _setupBookmarkChangeListeners() {
//   console.log('👂 [Background] 设置书签变化监听器...')
//
//   // 事件合并与节流，避免风暴式全量同步
//   /** @type {Set<string>} */
//   const pendingEvents = new Set()
//   let debounceTimer = null
//   const debounceMs = 300
//
//   const scheduleCoalescedSync = (eventType, id) => {
//     try {
//       if (id) pendingEvents.add(String(id))
//       if (debounceTimer) clearTimeout(debounceTimer)
//       debounceTimer = setTimeout(async () => {
//         const {size} = pendingEvents
//         const ids = Array.from(pendingEvents)
//         pendingEvents.clear()
//         console.log(
//           `🧮 [Background] 合并 ${size} 个书签事件，触发一次同步（示例ID: ${ids.slice(0, 3).join(', ')}...)`
//         )
//         await syncAndBroadcast(eventType, size > 1 ? 'batch' : ids[0] || 'unknown')
//       }, debounceMs)
//     } catch (e) {
//       console.warn('coalesced sync schedule failed:', e)
//     }
//   }
//
//   // 监听书签创建
//   chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
//     console.log('📝 [Background] 书签已创建:', bookmark.title)
//     try {
//       // 首选增量队列
//       bookmarkSyncService.enqueueIncremental('created', String(id))
//     } catch {
//       scheduleCoalescedSync('created', id)
//     }
//   })
//
//   // 监听书签删除
//   chrome.bookmarks.onRemoved.addListener(async id => {
//     console.log('🗑️ [Background] 书签已删除:', id)
//     try {
//       bookmarkSyncService.enqueueIncremental('removed', String(id))
//     } catch {
//       scheduleCoalescedSync('removed', id)
//     }
//   })
//
//   // 监听书签修改
//   chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
//     console.log('✏️ [Background] 书签已修改:', changeInfo.title)
//     try {
//       bookmarkSyncService.enqueueIncremental('changed', String(id))
//     } catch {
//       scheduleCoalescedSync('changed', id)
//     }
//   })
//
//   // 监听书签移动
//   chrome.bookmarks.onMoved.addListener(async id => {
//     console.log('📁 [Background] 书签已移动:', id)
//     try {
//       bookmarkSyncService.enqueueIncremental('moved', String(id))
//     } catch {
//       scheduleCoalescedSync('moved', id)
//     }
//   })
//
//   // 监听导入事件
//   chrome.bookmarks.onImportBegan.addListener(() => {
//     console.log('📥 [Background] 书签导入开始...')
//   })
//
//   chrome.bookmarks.onImportEnded.addListener(async () => {
//     console.log('✅ [Background] 书签导入完成')
//     scheduleCoalescedSync('import-ended', 'all')
//   })
//
//   console.log('✅ [Background] 书签变化监听器已设置')
// }

// 📝 注意：以下函数已注释，因为当前未使用
// 保留供未来需要时启用
/**
 * 🔄 同步到 IndexedDB 并广播更新消息
 *
 * @param {string} eventType - 事件类型
 * @param {string} id - 书签 ID
 */
// async function _syncAndBroadcast(eventType, id) {
//   try {
//     console.log(`🔄 [Background] 同步到 IndexedDB: ${eventType} ${id}`)
//
//     // 1. 完整同步到 IndexedDB（确保 pathIds 等字段正确）
//     // ✅ syncAllBookmarks 内部有 isSyncing 锁，会自动跳过重复同步
//     await bookmarkSyncService.syncAllBookmarks()
//
//     // 2. 广播消息到所有页面
//     chrome.runtime
//       .sendMessage({
//         type: 'acuity-bookmarks-db-synced',
//         eventType,
//         bookmarkId: id,
//         timestamp: Date.now()
//       })
//       .catch(() => {
//         // 忽略"没有接收者"的错误
//       })
//
//     console.log(`✅ [Background] 同步完成并已广播: ${eventType}`)
//   } catch (error) {
//     console.error('❌ [Background] 同步失败:', error)
//   }
// }

// 📝 注意：以下函数已注释，因为当前未使用
// 保留供未来需要时启用
/**
 * 初始爬取：从 IndexedDB 获取所有书签后开始爬取
 * ✅ 符合单向数据流：Chrome API → Background → IndexedDB → Crawler
 */
// async function _startInitialCrawl() {
//   try {
//     console.log('📚 正在从 IndexedDB 获取所有书签...')
//
//     // 1. ✅ 跳过同步，因为 initializeServices() 已经同步过了
//     // await bookmarkSyncService.syncAllBookmarks()
//
//     // 2. ✅ 从 IndexedDB 读取所有书签
//     await indexedDBManager.initialize()
//
//     const allBookmarks = await indexedDBManager.getAllBookmarks()
//     const urlBookmarks = allBookmarks.filter(b => b.url)
//
//     console.log(`📊 找到 ${urlBookmarks.length} 个书签`)
//
//     // 3. 去重（基于 URL）
//     const uniqueBookmarks = []
//     const seenUrls = new Set()
//     for (const bookmark of urlBookmarks) {
//       if (!seenUrls.has(bookmark.url)) {
//         seenUrls.add(bookmark.url)
//         uniqueBookmarks.push(bookmark)
//       }
//     }
//
//     console.log(`✅ 去重后剩余 ${uniqueBookmarks.length} 个书签`)
//
//     // 4. 转换为 Chrome 书签格式（爬虫需要）
//     const chromeBookmarks = uniqueBookmarks.map(b => ({
//       id: b.id,
//       parentId: b.parentId,
//       title: b.title || '',
//       url: b.url,
//       dateAdded: b.dateAdded,
//       dateGroupModified: b.dateGroupModified
//     }))
//
//     // 5. 开始爬取（使用 bookmarkCrawler API，传入 Chrome 书签对象）
//     if (globalThis.bookmarkCrawler && chromeBookmarks.length > 0) {
//       console.log('🚀 开始批量爬取书签...')
//
//       // 使用低优先级批量爬取，避免影响用户体验
//       globalThis.bookmarkCrawler.crawlChromeBookmarks(chromeBookmarks, {
//         onProgress: (current, total) => {
//           if (current % 10 === 0 || current === total) {
//             console.log(`⏳ 爬取进度: ${current}/${total}`)
//           }
//         },
//         onComplete: stats => {
//           console.log('🎉 初始爬取完成:', stats)
//         }
//       })
//     } else {
//       console.warn('⚠️ bookmarkCrawler 未就绪或没有书签需要爬取')
//     }
//   } catch (error) {
//     console.error('❌ 初始爬取失败:', error)
//   }
// }

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
        console.log('[Background] 📬 收到 get-children-paged 请求', {
          parentId: msg?.data?.parentId,
          limit: msg?.data?.limit,
          offset: msg?.data?.offset
        })
        devNotify(`get-children-paged：查询 ${msg?.data?.parentId}`)
        ;(async () => {
          try {
            const parentId = msg?.data?.parentId ?? ''
            const limit = msg?.data?.limit ?? 100
            const offset = msg?.data?.offset ?? 0
            console.log(
              '[Background] 🔍 调用 bookmarkSyncService.getChildrenByParentId...'
            )
            // 使用顶层静态导入的 bookmarkSyncService
            const items = await bookmarkSyncService.getChildrenByParentId(
              parentId,
              offset,
              limit
            )
            console.log(
              `[Background] ✅ getChildrenByParentId 完成，返回 ${items.length} 条数据`
            )
            devNotify(`get-children-paged：完成，数量 ${items.length}`)
            // ✅ 直接返回 items 数组，保持与 get-tree-root 一致的格式
            sendResponse({
              ok: true,
              value: items
            })
          } catch (e) {
            console.error('[Background] ❌ get-children-paged 失败:', e)
            devNotify(`get-children-paged：失败`)
            sendResponse({ ok: false, error: String(e) })
          }
        })()
        return true // 异步响应
      }
      case 'get-tree-root': {
        console.log('[Background] 📬 收到 get-tree-root 请求')
        // Fail-fast 2s：先回空数组解除首屏阻塞，真正数据稍后通过事件刷新
        try {
          let responded = false
          const done = payload => {
            if (responded) return
            responded = true
            try {
              sendResponse(payload)
            } catch (err) {
              void err
            }
          }

          const failFastTimer = setTimeout(() => {
            console.warn(
              '[Background] ⏱️ get-tree-root 2s fail-fast，先回空数组'
            )
            devNotify('get-tree-root：2s fail-fast 返回空数组')
            done({ ok: true, value: [], meta: { failFast: true } })
          }, 2000)

          ;(async () => {
            try {
              // 📖 读取状态
              const state = await getExtensionState()
              console.log('[Background] 📊 当前状态:', state)

              if (!state.dbReady) {
                clearTimeout(failFastTimer)
                console.warn('[Background] ⚠️ DB 未就绪，返回空数组')
                devNotify('get-tree-root：DB 未就绪')
                done({ ok: true, value: [], meta: { notReady: true } })
                return
              }

              console.log(
                '[Background] 🔍 调用 bookmarkSyncService.getRootBookmarks()...'
              )
              devNotify('get-tree-root：开始查询根节点')
              const t0 = Date.now()
              const items = await bookmarkSyncService.getRootBookmarks()

              const t1 = Date.now()
              console.log(
                `[Background] ✅ getRootBookmarks 完成，耗时 ${(t1 - t0).toFixed(0)}ms，返回 ${items.length} 条数据`
              )
              clearTimeout(failFastTimer)
              devNotify(`get-tree-root：查询完成，数量 ${items.length}`)
              done({ ok: true, value: items })
            } catch (e) {
              clearTimeout(failFastTimer)
              console.error('[Background] ❌ get-tree-root 失败:', e)
              devNotify('get-tree-root：失败')
              done({ ok: false, error: String(e) })
            }
          })()
        } catch (e) {
          console.error('[Background] ❌ get-tree-root 外层异常:', e)
          try {
            sendResponse({ ok: false, error: String(e) })
          } catch {
            console.warn('[Background] ❌ get-tree-root 外层异常:', e)
          }
        }
        return true // 异步响应（保持通道）
      }
      case 'get-global-stats': {
        ;(async () => {
          try {
            // 从 IndexedDB 获取所有书签并统计
            const allBookmarks = await bookmarkSyncService.getAllBookmarks(
              999999,
              0
            )
            const totalBookmarks = allBookmarks.filter(
              b => b.url && !b.isFolder
            ).length
            const totalFolders = allBookmarks.filter(b => b.isFolder).length
            sendResponse({
              ok: true,
              value: {
                totalBookmarks,
                totalFolders
              }
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
chrome.runtime.onInstalled.addListener(async details => {
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
    // ✅ 状态驱动的初始化流程
    try {
      const reason = details?.reason || 'unknown'
      console.log('🧩 [Background] onInstalled: 触发原因:', reason)

      // 📖 1. 读取当前状态
      const state = await getExtensionState()
      console.log('📊 [State] 当前状态:', state)

      // 🔀 2. 根据状态决定执行路径
      if (!state.initialized) {
        // ═══════════════════════════════════════════════
        // 路径 A: 首次安装
        // ═══════════════════════════════════════════════
        console.log('🎉 [Background] 【路径 A】首次安装，准备同步书签...')
        devNotify('首次安装：准备同步')

        // 延迟 500ms 再开始（让扩展完全加载）
        await new Promise(resolve => setTimeout(resolve, 500))

        injectAlert('AcuityBookmarks：首次安装，正在同步书签...').catch(e => {
          console.warn('[Background] injectAlert 失败:', e)
        })

        // 执行全量同步（会触发懒加载初始化数据库）
        await indexedDBManager.initialize()
        await bookmarkSyncService.syncAllBookmarks()

        // 获取书签总数
        const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
        const totalBookmarks = rootBookmarks.reduce(
          (sum, node) => sum + (node.bookmarksCount || 0),
          0
        )

        // 更新状态
        await updateExtensionState({
          initialized: true,
          dbReady: true,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          bookmarkCount: totalBookmarks,
          lastSyncedAt: Date.now(),
          installReason: reason
        })

        console.log('✅ [Background] 首次安装完成')
        devNotify(`首次安装：完成 (${totalBookmarks} 条书签)`)

        injectAlert(
          `AcuityBookmarks：同步完成 (${totalBookmarks} 条书签)`
        ).catch(e => {
          console.warn('[Background] injectAlert 失败:', e)
        })
      } else if (state.schemaVersion < CURRENT_SCHEMA_VERSION) {
        // ═══════════════════════════════════════════════
        // 路径 B: 架构版本升级
        // ═══════════════════════════════════════════════
        console.log(
          `🔧 [Background] 【路径 B】架构升级: v${state.schemaVersion} → v${CURRENT_SCHEMA_VERSION}`
        )
        devNotify('架构升级：开始')

        // 延迟 1 秒确保旧连接释放
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 重新初始化数据库（触发 onupgradeneeded）
        await indexedDBManager.initialize()

        // 检查数据完整性
        const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
        const totalBookmarks = rootBookmarks.reduce(
          (sum, node) => sum + (node.bookmarksCount || 0),
          0
        )

        if (totalBookmarks === 0) {
          console.warn('⚠️ [Background] 架构升级后数据为空，执行全量同步...')
          await bookmarkSyncService.syncAllBookmarks()
          const newRootBookmarks = await bookmarkSyncService.getRootBookmarks()
          const newTotalBookmarks = newRootBookmarks.reduce(
            (sum, node) => sum + (node.bookmarksCount || 0),
            0
          )

          await updateExtensionState({
            dbReady: true,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            bookmarkCount: newTotalBookmarks,
            lastSyncedAt: Date.now()
          })

          devNotify(`架构升级：完成 (重建 ${newTotalBookmarks} 条书签)`)
        } else {
          await updateExtensionState({
            dbReady: true,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            bookmarkCount: totalBookmarks
          })

          devNotify(`架构升级：完成 (保留 ${totalBookmarks} 条书签)`)
        }
      } else if (state.bookmarkCount === 0) {
        // ═══════════════════════════════════════════════
        // 路径 C: 数据丢失，需要重新同步
        // ═══════════════════════════════════════════════
        console.log('⚠️ [Background] 【路径 C】数据丢失，重新同步...')
        devNotify('数据丢失：重新同步')

        // 延迟 1 秒确保旧连接释放
        await new Promise(resolve => setTimeout(resolve, 1000))

        await indexedDBManager.initialize()
        await bookmarkSyncService.syncAllBookmarks()

        const rootBookmarks = await bookmarkSyncService.getRootBookmarks()
        const totalBookmarks = rootBookmarks.reduce(
          (sum, node) => sum + (node.bookmarksCount || 0),
          0
        )

        await updateExtensionState({
          dbReady: true,
          bookmarkCount: totalBookmarks,
          lastSyncedAt: Date.now()
        })

        console.log('✅ [Background] 数据恢复完成')
        devNotify(`数据恢复：完成 (${totalBookmarks} 条书签)`)
      } else {
        // ═══════════════════════════════════════════════
        // 路径 D: 正常重新加载（最常见）
        // ═══════════════════════════════════════════════
        console.log(
          '🔄 [Background] 【路径 D】正常重新加载，跳过初始化（懒加载）'
        )
        console.log(
          `📊 [Background] 数据状态：${state.bookmarkCount} 条书签，架构版本 ${state.schemaVersion}`
        )
        devNotify('重新加载：就绪')

        // 只更新标记，不打开数据库（懒加载）
        await updateExtensionState({
          dbReady: true,
          installReason: reason
        })
      }
    } catch (err) {
      console.error('❌ [Background] onInstalled: 初始化失败', err)
      devNotify(`初始化失败：${String(err).slice(0, 50)}`)

      injectAlert('AcuityBookmarks：初始化失败，请查看扩展控制台').catch(() => {
        // 忽略 alert 失败
      })
    }
  } catch (e) {
    console.warn('create context menus failed:', e)
  }
})

// 浏览器启动时也做一次幂等的检查与准备
if (chrome?.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    try {
      console.log('🧩 [Background] onStartup: 幂等检查与准备...')
      devNotify('启动：检查并同步')
      await bookmarkSyncService.syncAllBookmarks()
      console.log('🧩 [Background] onStartup: 准备完成')
    } catch (e) {
      console.warn('🧩 [Background] onStartup: 同步失败', e)
    }
  })
}

// 监听上下文菜单点击（只注册一次）
if (chrome?.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(info => {
    if (info.menuItemId === 'ab-open-management') openManagementPage()
    if (info.menuItemId === 'ab-open-settings') openSettingsPage()
  })
}

// 监听快捷键命令
if (chrome?.commands?.onCommand) {
  chrome.commands.onCommand.addListener(command => {
    console.log('🎹 [Background] 快捷键命令:', command)

    switch (command) {
      case 'open-management':
        console.log('📚 [Background] 快捷键：打开书签管理')
        openManagementPage()
        break
      case 'open-settings':
        console.log('⚙️ [Background] 快捷键：打开设置')
        openSettingsPage()
        break
      case 'open-side-panel':
        console.log('📋 [Background] 快捷键：切换书签侧边栏')
        toggleSidePanel()
        break
      case '_execute_action':
        console.log('🎯 [Background] 快捷键：激活扩展程序')
        // 这个由 Chrome 自动处理，打开 popup
        break
      default:
        console.log('❓ [Background] 未知快捷键命令:', command)
    }
  })
}

// 切换侧边栏函数
function toggleSidePanel() {
  try {
    if (chrome?.sidePanel?.open) {
      // Chrome 114+ 支持 sidePanel API
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    } else if (chrome?.tabs?.query) {
      // 降级方案：打开侧边栏页面
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) {
          const url = chrome?.runtime?.getURL
            ? chrome.runtime.getURL('side-panel.html')
            : 'side-panel.html'
          chrome.tabs.create({ url })
        }
      })
    }
  } catch (error) {
    console.warn('toggleSidePanel', 'failed:', error)
  }
}
