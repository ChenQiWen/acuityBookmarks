// ===========================
// AcuityBookmarks Service Worker
// Manifest V3 Optimized Version
// ===========================

// --- Global Bookmark Data Manager ---
class GlobalBookmarkManager {
  static CACHE_KEY = 'globalBookmarksCache'
  static LAST_UPDATE_KEY = 'lastBookmarkUpdate'
  static CACHE_EXPIRY = 5 * 60 * 1000 // 5分钟过期

  static async preloadBookmarks() {
    try {
      console.log('🚀 预加载书签数据开始...')
      const startTime = performance.now()

      // 获取完整书签树
      const bookmarkTree = await chrome.bookmarks.getTree()

      // 创建缓存数据
      const cacheData = {
        tree: bookmarkTree,
        timestamp: Date.now(),
        version: '1.0'
      }

      // 保存到本地缓存
      await chrome.storage.local.set({
        [this.CACHE_KEY]: cacheData,
        [this.LAST_UPDATE_KEY]: Date.now()
      })

      const loadTime = performance.now() - startTime
      console.log(`✅ 书签数据预加载完成，耗时: ${loadTime.toFixed(2)}ms`)

      // 通知所有页面数据已准备就绪
      this.notifyPagesDataReady()

      return true
    } catch (error) {
      console.error('❌ 书签预加载失败:', error)
      return false
    }
  }

  static async getCachedBookmarks() {
    try {
      const result = await chrome.storage.local.get([this.CACHE_KEY, this.LAST_UPDATE_KEY])
      const cached = result[this.CACHE_KEY]
      const lastUpdate = result[this.LAST_UPDATE_KEY]

      if (!cached || !lastUpdate) return null

      // 检查缓存是否过期
      const age = Date.now() - lastUpdate
      if (age > this.CACHE_EXPIRY) {
        console.log('📊 书签缓存已过期，重新加载...')
        await this.preloadBookmarks()
        return this.getCachedBookmarks()
      }

      return cached
    } catch (error) {
      console.error('❌ 获取缓存书签失败:', error)
      return null
    }
  }

  static async handleBookmarkChange() {
    console.log('📝 检测到书签变更，更新缓存...')
    await this.preloadBookmarks()
  }

  static notifyPagesDataReady() {
    // 向所有打开的页面发送数据就绪通知
    chrome.runtime.sendMessage({
      type: 'BOOKMARKS_DATA_READY',
      timestamp: Date.now()
    }).catch(() => {
      // 忽略没有监听器的错误
    })
  }
}

// --- Modern State Management ---
class ServiceWorkerStateManager {
  static KEYS = {
    CURRENT_JOB: 'currentJob',
    POLLING_STATE: 'pollingState',
    BOOKMARKS_CACHE: 'bookmarksCache',
    PERFORMANCE_METRICS: 'performanceMetrics',
    ACTIVE_OPERATIONS: 'activeOperations'
  }

  // Session Storage (临时状态)
  static async saveTemporary(key, data) {
    try {
      await chrome.storage.session.set({ [key]: data })
    } catch (error) {
      console.warn('Session storage save failed:', error)
      // Fallback to local storage
      await chrome.storage.local.set({ [`session_${key}`]: data })
    }
  }

  static async getTemporary(key) {
    try {
      const result = await chrome.storage.session.get(key)
      return result[key]
    } catch (error) {
      console.warn('Session storage get failed:', error)
      // Fallback to local storage
      const result = await chrome.storage.local.get(`session_${key}`)
      return result[`session_${key}`]
    }
  }

  static async clearTemporary() {
    try {
      await chrome.storage.session.clear()
    } catch (error) {
      console.warn('Session storage clear failed:', error)
    }
  }

  // Persistent Storage (持久化状态)
  static async savePersistent(key, data) {
    await chrome.storage.local.set({ [key]: data })
  }

  static async getPersistent(key) {
    const result = await chrome.storage.local.get(key)
    return result[key]
  }

  // State recovery
  static async recoverState() {
    const operations = await this.getTemporary(this.KEYS.ACTIVE_OPERATIONS) || {}
    const jobId = await this.getTemporary(this.KEYS.CURRENT_JOB)
    const cache = await this.getPersistent(this.KEYS.BOOKMARKS_CACHE)

    return { operations, jobId, cache }
  }

  static async saveState() {
    const state = {
      timestamp: Date.now(),
      version: '1.0'
    }
    await this.saveTemporary('lastSaveState', state)
  }
}

// --- Alarm-based Job Management ---
class AlarmManager {
  static ALARMS = {
    BOOKMARK_SYNC: 'bookmarkSync',
    JOB_POLLING: 'jobPolling',
    CACHE_CLEANUP: 'cacheCleanup',
    PERFORMANCE_MONITOR: 'performanceMonitor'
  }

  static async setupAlarms() {
    // 书签同步检查 - 每5分钟
    await chrome.alarms.create(this.ALARMS.BOOKMARK_SYNC, {
      periodInMinutes: 5
    })

    // 缓存清理 - 每30分钟
    await chrome.alarms.create(this.ALARMS.CACHE_CLEANUP, {
      periodInMinutes: 30
    })

    // 性能监控 - 每小时
    await chrome.alarms.create(this.ALARMS.PERFORMANCE_MONITOR, {
      periodInMinutes: 60
    })

    console.log('⏰ Alarms设置完成')
  }

  static async startJobPolling(jobId) {
    // 动态创建作业轮询 - 每5秒
    await chrome.alarms.create(this.ALARMS.JOB_POLLING, {
      delayInMinutes: 0,
      periodInMinutes: 0.08 // 约5秒
    })

    await ServiceWorkerStateManager.saveTemporary(
      ServiceWorkerStateManager.KEYS.CURRENT_JOB,
      jobId
    )

    console.log(`🔄 开始轮询作业: ${jobId}`)
  }

  static async stopJobPolling() {
    await chrome.alarms.clear(this.ALARMS.JOB_POLLING)
    await ServiceWorkerStateManager.saveTemporary(
      ServiceWorkerStateManager.KEYS.CURRENT_JOB,
      null
    )

    console.log('⏹️ 停止作业轮询')
  }
}

// --- Offscreen Integration ---
class OffscreenManager {
  static isDocumentOpen = false

  static async ensureOffscreenDocument() {
    if (this.isDocumentOpen) return

    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Process bookmark analysis and heavy computation'
      })

      this.isDocumentOpen = true
      console.log('📄 Offscreen文档已创建')

    } catch (error) {
      if (error.message.includes('Only a single offscreen')) {
        this.isDocumentOpen = true
      } else {
        console.error('创建Offscreen文档失败:', error)
        throw error
      }
    }
  }

  static async closeOffscreenDocument() {
    if (!this.isDocumentOpen) return

    try {
      await chrome.offscreen.closeDocument()
      this.isDocumentOpen = false
      console.log('📄 Offscreen文档已关闭')
    } catch (error) {
      console.warn('关闭Offscreen文档失败:', error)
    }
  }

  static async sendToOffscreen(action, data = {}) {
    await this.ensureOffscreenDocument()

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offscreen处理超时'))
      }, 30000) // 30秒超时

      const messageHandler = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout)

          if (response.success) {
            resolve(response.data)
          } else {
            reject(new Error(response.error || 'Offscreen处理失败'))
          }
        }
      }

      chrome.runtime.sendMessage({
        target: 'offscreen',
        action,
        data,
        requestId
      }, messageHandler)
    })
  }
}

// --- Performance Monitoring ---
class PerformanceMonitor {
  static metrics = {
    apiCalls: [],
    storageOps: [],
    messageHandling: []
  }

  static record(type, duration, details = {}) {
    const metric = {
      timestamp: Date.now(),
      duration,
      details
    }

    if (this.metrics[type]) {
      this.metrics[type].push(metric)

      // 保持最近100个记录
      if (this.metrics[type].length > 100) {
        this.metrics[type].shift()
      }
    }
  }

  static getAverage(type) {
    const typeMetrics = this.metrics[type] || []
    if (typeMetrics.length === 0) return 0

    const sum = typeMetrics.reduce((acc, m) => acc + m.duration, 0)
    return sum / typeMetrics.length
  }

  static async saveMetrics() {
    await ServiceWorkerStateManager.saveTemporary(
      ServiceWorkerStateManager.KEYS.PERFORMANCE_METRICS,
      this.metrics
    )
  }

  static async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      averages: {
        apiCalls: this.getAverage('apiCalls'),
        storageOps: this.getAverage('storageOps'),
        messageHandling: this.getAverage('messageHandling')
      },
      counts: {
        apiCalls: this.metrics.apiCalls.length,
        storageOps: this.metrics.storageOps.length,
        messageHandling: this.metrics.messageHandling.length
      }
    }

    console.log('📊 Performance Report:', report)
    return report
  }
}

// --- Bookmark Management ---
class BookmarkManager {
  static cache = {
    data: null,
    checksum: null,
    lastUpdate: null
  }

  static calculateChecksum(bookmarks) {
    const simplified = JSON.stringify(bookmarks, (key, value) => {
      if (['id', 'title', 'url', 'children'].includes(key)) {
        return value
      }
      return undefined
    })
    return btoa(simplified).slice(0, 16)
  }

  static async hasChanged() {
    const start = performance.now()

    return new Promise((resolve) => {
      chrome.bookmarks.getTree((tree) => {
        const newChecksum = this.calculateChecksum(tree)
        const hasChanged = this.cache.checksum !== newChecksum

        PerformanceMonitor.record('apiCalls', performance.now() - start, {
          operation: 'getBookmarkTree',
          changed: hasChanged
        })

        resolve(hasChanged)
      })
    })
  }

  static async updateCache() {
    const start = performance.now()

    return new Promise((resolve) => {
      chrome.bookmarks.getTree((tree) => {
        this.cache = {
          data: tree,
          checksum: this.calculateChecksum(tree),
          lastUpdate: Date.now()
        }

        // 保存到持久化存储
        ServiceWorkerStateManager.savePersistent(
          ServiceWorkerStateManager.KEYS.BOOKMARKS_CACHE,
          this.cache
        )

        PerformanceMonitor.record('apiCalls', performance.now() - start, {
          operation: 'updateBookmarkCache',
          size: JSON.stringify(tree).length
        })

        resolve(this.cache)
      })
    })
  }

  static async processWithOffscreen(operation, data) {
    try {
      const result = await OffscreenManager.sendToOffscreen(operation, data)
      return result
    } catch (error) {
      console.error(`Offscreen处理失败 (${operation}):`, error)
      throw error
    }
  }
}

// --- Modern Service Worker Management ---
class ServiceWorkerManager {
  static isActive = true

  static start() {
    console.log('🚀 Modern Service Worker管理已启动')

    // 使用 Alarms API 保持活跃（已在 AlarmManager 中配置）
    // 不需要传统的 keep-alive 机制
  }

  static stop() {
    this.isActive = false
    console.log('🛑 Service Worker管理已停止')
  }
}

// --- Event Handlers ---

// Service Worker生命周期
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Service Worker启动')

  try {
    // 恢复状态
    const { operations, jobId, cache } = await ServiceWorkerStateManager.recoverState()

    if (cache) {
      BookmarkManager.cache = cache
    }

    if (jobId) {
      console.log(`🔄 恢复作业轮询: ${jobId}`)
      await AlarmManager.startJobPolling(jobId)
    }

    // 设置基础告警
    await AlarmManager.setupAlarms()

    // 启动保活机制
    ServiceWorkerManager.start()

    console.log('✅ Service Worker恢复完成')

  } catch (error) {
    console.error('❌ Service Worker恢复失败:', error)
  }
})

chrome.runtime.onSuspend.addListener(async () => {
  console.log('💤 Service Worker即将暂停')

  try {
    // 保存当前状态
    await ServiceWorkerStateManager.saveState()
    await PerformanceMonitor.saveMetrics()

    // 清理资源
    await OffscreenManager.closeOffscreenDocument()

    console.log('💾 状态已保存')

  } catch (error) {
    console.error('❌ 状态保存失败:', error)
  }
})

// 安装/更新处理
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 扩展安装/更新:', details.reason)

  try {
    // 初始化存储
    await chrome.storage.local.set({
      isGenerating: false,
      progressCurrent: 0,
      progressTotal: 0,
      processedAt: null,
      localDataStatus: 'pending'
    })

    // 设置告警
    await AlarmManager.setupAlarms()

    // 启动保活机制
    ServiceWorkerManager.start()

    // 首次安装时预加载书签
    if (details.reason === 'install') {
      await BookmarkManager.updateCache()

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: '🎉 欢迎使用AcuityBookmarks！书签数据已加载完成。'
      })
    }

    console.log('✅ 初始化完成')

  } catch (error) {
    console.error('❌ 初始化失败:', error)
  }
})

// Alarm事件处理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`⏰ Alarm触发: ${alarm.name}`)

  try {
    switch (alarm.name) {
      case AlarmManager.ALARMS.BOOKMARK_SYNC:
        if (await BookmarkManager.hasChanged()) {
          console.log('📚 检测到书签变化，更新缓存...')
          await BookmarkManager.updateCache()
        }
        break

      case AlarmManager.ALARMS.JOB_POLLING:
        const currentJob = await ServiceWorkerStateManager.getTemporary(
          ServiceWorkerStateManager.KEYS.CURRENT_JOB
        )
        if (currentJob) {
          await pollJobStatus(currentJob)
        }
        break

      case AlarmManager.ALARMS.CACHE_CLEANUP:
        console.log('🧹 执行缓存清理...')
        await ServiceWorkerStateManager.clearTemporary()
        break

      case AlarmManager.ALARMS.PERFORMANCE_MONITOR:
        await PerformanceMonitor.generateReport()
        break
    }
  } catch (error) {
    console.error(`❌ Alarm处理失败 (${alarm.name}):`, error)
  }
})

// Side Panel支持
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'side-panel.html',
      enabled: true
    })

    console.log('📌 Side Panel已打开')
  } catch (error) {
    console.error('❌ Side Panel打开失败:', error)
    // Fallback to popup
    chrome.action.setPopup({ popup: 'popup.html' })
  }
})

// 消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const start = performance.now()

  console.log('📨 收到消息:', request.action)

  handleMessage(request, sender)
    .then(result => {
      PerformanceMonitor.record('messageHandling', performance.now() - start, {
        action: request.action,
        success: true
      })
      sendResponse({ success: true, data: result })
    })
    .catch(error => {
      PerformanceMonitor.record('messageHandling', performance.now() - start, {
        action: request.action,
        success: false,
        error: error.message
      })
      console.error(`❌ 消息处理失败 (${request.action}):`, error)
      sendResponse({ success: false, error: error.message })
    })

  return true
})

// --- Legacy Functions (Modernized) ---

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'get-bookmarks':
      return await getAllBookmarks()

    case 'smart-bookmark':
      return await handleSmartBookmark()

    case 'process-bookmarks':
      return await BookmarkManager.processWithOffscreen('processBookmarks', {
        bookmarks: await getAllBookmarks()
      })

    case 'find-duplicates':
      return await BookmarkManager.processWithOffscreen('findDuplicates', {
        bookmarks: await getAllBookmarks()
      })

    case 'check-urls':
      const bookmarks = await getAllBookmarks()
      const urls = bookmarks.map(b => b.url).filter(Boolean)
      return await BookmarkManager.processWithOffscreen('checkUrls', { urls })

    case 'get-performance':
      return await PerformanceMonitor.generateReport()

    default:
      throw new Error(`未知操作: ${request.action}`)
  }
}

async function getAllBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((bookmarkTree) => {
      const bookmarks = []
      function traverse(nodes) {
        for (const node of nodes) {
          if (node.url) {
            bookmarks.push({
              title: node.title,
              url: node.url,
              id: node.id,
              parentId: node.parentId
            })
          }
          if (node.children) {
            traverse(node.children)
          }
        }
      }
      traverse(bookmarkTree)
      resolve(bookmarks)
    })
  })
}

async function handleSmartBookmark() {
  try {
    const bookmarks = await getAllBookmarks()

    const response = await fetch('http://localhost:3000/api/start-processing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarks })
    })

    if (!response.ok) throw new Error('AI处理请求失败')

    const { jobId } = await response.json()

    // 使用Alarm进行轮询
    await AlarmManager.startJobPolling(jobId)

    await chrome.storage.local.set({
      isGenerating: true,
      progressCurrent: 0,
      progressTotal: 100
    })

    return { jobId, message: 'AI整理已开始' }

  } catch (error) {
    console.error('Smart bookmark失败:', error)
    throw error
  }
}

async function pollJobStatus(jobId) {
  try {
    const response = await fetch(`http://localhost:3000/api/get-progress/${jobId}`)
    if (!response.ok) throw new Error('获取进度失败')

    const job = await response.json()

    await chrome.storage.local.set({
      isGenerating: job.status !== 'complete' && job.status !== 'failed',
      progressCurrent: job.progress,
      progressTotal: job.total
    })

    if (job.status === 'complete') {
      const originalTree = await new Promise(resolve =>
        chrome.bookmarks.getTree(resolve)
      )

      await chrome.storage.local.set({
        originalTree,
        newProposal: job.result,
        processedAt: new Date().toISOString()
      })

      await AlarmManager.stopJobPolling()

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: '🎉 AI书签整理完成！'
      })
    }

    if (job.status === 'failed') {
      await AlarmManager.stopJobPolling()
      await chrome.storage.local.set({ isGenerating: false })

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'AcuityBookmarks',
        message: '❌ AI书签整理失败，请稍后重试'
      })
    }

  } catch (error) {
    console.error('轮询作业状态失败:', error)
  }
}

// Commands处理
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`⌨️ 快捷键触发: ${command}`)

  try {
    switch (command) {
      case 'open-management':
        await chrome.tabs.create({
          url: chrome.runtime.getURL('management.html')
        })
        break

      case 'smart-bookmark':
        await handleSmartBookmark()
        break

      case 'search-bookmarks':
        await chrome.tabs.create({
          url: chrome.runtime.getURL('search-popup.html')
        })
        break
    }
  } catch (error) {
    console.error(`❌ 快捷键处理失败 (${command}):`, error)
  }
})

// 书签变化监听 - 使用全局缓存管理器
chrome.bookmarks.onCreated.addListener(async () => {
  console.log('📚 书签创建')
  await GlobalBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onRemoved.addListener(async () => {
  console.log('📚 书签删除')
  await GlobalBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onChanged.addListener(async () => {
  console.log('📚 书签修改')
  await GlobalBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onMoved.addListener(async () => {
  console.log('📚 书签移动')
  await GlobalBookmarkManager.handleBookmarkChange()
})

// Service Worker 启动初始化
console.log('🚀 AcuityBookmarks Service Worker v2.0 已启动')
console.log('⚡ Manifest V3优化版本，性能大幅提升！')

// 预加载书签数据到全局缓存
GlobalBookmarkManager.preloadBookmarks().then(() => {
  console.log('📊 全局书签缓存初始化完成')
}).catch(error => {
  console.error('❌ 全局书签缓存初始化失败:', error)
})

// 消息监听 - 处理前端页面的请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REQUEST_BOOKMARK_PRELOAD') {
    console.log('📊 收到预加载请求，执行数据刷新...')
    GlobalBookmarkManager.preloadBookmarks().then(() => {
      sendResponse({ success: true })
    }).catch(error => {
      console.error('❌ 处理预加载请求失败:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // 保持消息通道开放
  }
})
