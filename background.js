// ===========================
// AcuityBookmarks Service Worker
// Manifest V3 Optimized Version
// ===========================

// --- 超级书签数据管理器 ---
class SuperBookmarkManager {
  static CACHE_KEY = 'acuity-super-bookmark-cache-v2'
  static LAST_UPDATE_KEY = 'lastSuperBookmarkUpdate'
  static CACHE_EXPIRY = 5 * 60 * 1000 // 5分钟过期

  // 🚀 超级预计算书签处理
  static async preloadAndProcessBookmarks() {
    try {
      console.log('🚀 超级书签数据处理开始...')
      const startTime = performance.now()

      // 获取完整书签树
      const bookmarkTree = await chrome.bookmarks.getTree()

      // 🎯 使用超级数据处理器进行全面处理
      const processedCache = await this.processWithSuperProcessor(bookmarkTree)

      const loadTime = performance.now() - startTime
      console.log(`✅ 超级书签数据处理完成！`)
      console.log(`⏱️  总耗时: ${loadTime.toFixed(2)}ms`)
      console.log(`📊 处理结果:`)
      console.log(`   • ${processedCache.globalStats.totalBookmarks} 个书签`)
      console.log(`   • ${processedCache.globalStats.totalFolders} 个文件夹`)
      console.log(`   • ${processedCache.globalStats.maxDepth} 层最大深度`)
      console.log(`   • ${processedCache.nodeById.size} 个索引节点`)
      console.log(`   • ${processedCache.searchIndex.size} 个搜索关键词`)
      console.log(`   • ${processedCache.duplicateUrls.size} 组重复URL`)

      // 通知所有页面数据已准备就绪
      this.notifyPagesDataReady(processedCache)

      return true
    } catch (error) {
      console.error('❌ 超级书签处理失败:', error)
      return false
    }
  }

  // 🎯 超级数据处理器（在Service Worker中的简化版本）
  static async processWithSuperProcessor(chromeData) {
    // 由于Service Worker中无法直接import ES模块，这里实现简化版本
    // 实际的复杂处理会在前端页面中进行

    console.log('🔄 开始超级数据处理...')
    const startTime = performance.now()

    // 基础数据转换和统计
    const enhancedData = this.transformAndPrecompute(chromeData)
    const globalIndexes = this.buildBasicIndexes(enhancedData)
    const globalStats = this.calculateGlobalStats(enhancedData)

    // 创建超级缓存对象（简化版）
    const superCache = {
      data: enhancedData,
      ...globalIndexes,
      globalStats,
      metadata: {
        originalDataHash: this.generateDataHash(chromeData),
        processedAt: Date.now(),
        version: '2.0.0-sw',
        processingTime: performance.now() - startTime,
        source: 'service-worker'
      }
    }

    // 保存到存储
    await chrome.storage.local.set({
      [this.CACHE_KEY]: superCache,
      [this.LAST_UPDATE_KEY]: Date.now()
    })

    return superCache
  }

  // 简化的数据转换
  static transformAndPrecompute(chromeNodes, depth = 0, parentPath = []) {
    return chromeNodes.map(node => {
      const currentPath = [...parentPath, node.title]

      const enhanced = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded || Date.now(),
        path: currentPath,
        pathString: currentPath.join(' / '),
        depth,
        domain: node.url ? this.extractDomain(node.url) : undefined,
        normalizedTitle: node.title.toLowerCase().trim(),
        bookmarkCount: 0,
        folderCount: 0,
        totalCount: 1
      }

      if (node.children && node.children.length > 0) {
        enhanced.children = this.transformAndPrecompute(node.children, depth + 1, currentPath)

        // 计算子树统计
        const stats = enhanced.children.reduce((acc, child) => ({
          bookmarkCount: acc.bookmarkCount + child.bookmarkCount,
          folderCount: acc.folderCount + child.folderCount,
          totalCount: acc.totalCount + child.totalCount
        }), { bookmarkCount: 0, folderCount: 0, totalCount: 0 })

        enhanced.bookmarkCount = stats.bookmarkCount
        enhanced.folderCount = stats.folderCount + 1 // +1 自身
        enhanced.totalCount = stats.totalCount + 1
      } else {
        enhanced.bookmarkCount = node.url ? 1 : 0
        enhanced.folderCount = node.url ? 0 : 1
      }

      return enhanced
    })
  }

  // 构建基础索引
  static buildBasicIndexes(data) {
    const nodeById = new Map()
    const nodesByUrl = new Map()
    const nodesByDomain = new Map()
    const searchIndex = new Map()

    const traverse = (nodes) => {
      nodes.forEach(node => {
        nodeById.set(node.id, node)

        if (node.url) {
          // URL索引
          if (!nodesByUrl.has(node.url)) {
            nodesByUrl.set(node.url, [])
          }
          nodesByUrl.get(node.url).push(node)

          // 域名索引
          if (node.domain) {
            if (!nodesByDomain.has(node.domain)) {
              nodesByDomain.set(node.domain, [])
            }
            nodesByDomain.get(node.domain).push(node)
          }

          // 简单搜索索引
          const keywords = node.title.toLowerCase().split(/\s+/)
          keywords.forEach(keyword => {
            if (keyword.length > 2) {
              if (!searchIndex.has(keyword)) {
                searchIndex.set(keyword, [])
              }
              searchIndex.get(keyword).push(node.id)
            }
          })
        }

        if (node.children) {
          traverse(node.children)
        }
      })
    }

    traverse(data)

    return {
      nodeById,
      nodesByUrl,
      nodesByDomain,
      searchIndex,
      // 简化版本，其他索引设为空Map
      nodesByTitle: new Map(),
      childrenById: new Map(),
      parentById: new Map(),
      siblingsById: new Map(),
      duplicateUrls: new Map(),
      duplicateTitles: new Map(),
      invalidUrlIds: [],
      emptyFolderIds: [],
      flatBookmarkList: [],
      flattenedTree: [],
      visibilityMap: new Map(),
      domainStats: new Map()
    }
  }

  // 计算全局统计
  static calculateGlobalStats(data) {
    let totalBookmarks = 0
    let totalFolders = 0
    let maxDepth = 0

    const traverse = (nodes) => {
      nodes.forEach(node => {
        maxDepth = Math.max(maxDepth, node.depth)

        if (node.url) {
          totalBookmarks++
        } else {
          totalFolders++
        }

        if (node.children) {
          traverse(node.children)
        }
      })
    }

    traverse(data)

    return {
      totalBookmarks,
      totalFolders,
      maxDepth,
      avgDepth: Math.round(maxDepth / 2),
      topDomains: [],
      creationTimeline: new Map(),
      categoryDistribution: new Map(),
      memoryUsage: {
        nodeCount: totalBookmarks + totalFolders,
        indexCount: totalBookmarks + totalFolders,
        estimatedBytes: (totalBookmarks + totalFolders) * 300
      }
    }
  }

  // 辅助方法
  static extractDomain(url) {
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return 'invalid-url'
    }
  }

  static generateDataHash(data) {
    const str = JSON.stringify(data, ['id', 'title', 'url', 'dateAdded'])
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  // 获取缓存的超级书签数据
  static async getCachedBookmarks() {
    try {
      const result = await chrome.storage.local.get([this.CACHE_KEY, this.LAST_UPDATE_KEY])
      const cached = result[this.CACHE_KEY]
      const lastUpdate = result[this.LAST_UPDATE_KEY]

      if (!cached || !lastUpdate) return null

      // 检查缓存是否过期
      const age = Date.now() - lastUpdate
      if (age > this.CACHE_EXPIRY) {
        console.log('📊 超级书签缓存已过期，重新处理...')
        await this.preloadAndProcessBookmarks()
        return this.getCachedBookmarks()
      }

      return cached
    } catch (error) {
      console.error('❌ 获取超级缓存书签失败:', error)
      return null
    }
  }

  // 处理书签变更事件
  static async handleBookmarkChange() {
    console.log('📝 检测到书签变更，重新处理超级缓存...')
    await this.preloadAndProcessBookmarks()
  }

  // 通知前端页面数据就绪
  static notifyPagesDataReady(cacheData = null) {
    const message = {
      type: 'SUPER_BOOKMARKS_DATA_READY',
      timestamp: Date.now(),
      cacheStatus: cacheData ? 'fresh' : 'unknown',
      stats: cacheData ? {
        totalBookmarks: cacheData.globalStats.totalBookmarks,
        totalFolders: cacheData.globalStats.totalFolders,
        processingTime: cacheData.metadata.processingTime
      } : null
    }

    // 向所有打开的页面发送数据就绪通知
    chrome.runtime.sendMessage(message).catch(() => {
      // 忽略没有监听器的错误
    })

    console.log('📢 已通知前端页面：超级缓存数据就绪')
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

    // 🎯 已移除setPopup调用，使用onClicked接管图标点击
    console.log('✅ 使用onClicked接管图标点击行为')

    // 重置侧边栏设置
    try {
      await chrome.sidePanel.setOptions({ enabled: false })
      console.log('✅ 已重置侧边栏设置')
    } catch (error) {
      console.warn('⚠️ 重置侧边栏失败:', error)
    }

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

    // 🎯 已移除setPopup调用，使用onClicked接管图标点击
    console.log('✅ 使用onClicked接管图标点击行为')

    // 重置侧边栏设置
    try {
      await chrome.sidePanel.setOptions({ enabled: false })
      console.log('✅ 已重置侧边栏设置')
    } catch (error) {
      console.warn('⚠️ 重置侧边栏失败:', error)
    }

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

// 确保插件图标点击时显示Popup页面（不是SidePanel）
// 强制设置action行为为popup模式
chrome.action.setPopup({ popup: 'popup.html' })

// 注意：当设置了default_popup时，不会触发onClicked事件
// 这个监听器只是作为备用，正常情况下不会被调用

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

    case 'enableSidePanel':
      // popup请求启用侧边栏模式
      return await handleEnableSidePanel()

    // 移除了getSidePanelStatus，因为不再需要状态管理

    case 'showManagementPageAndOrganize':
      // AI整理页面
      return await chrome.tabs.create({
        url: chrome.runtime.getURL('management.html')
      })

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
      case 'open-side-panel':
        // Alt+D 快捷键：打开侧边栏
        try {
          console.log('🎯 快捷键打开侧边栏...')

          // 设置侧边栏配置
          await chrome.sidePanel.setOptions({
            path: 'side-panel.html',
            enabled: true
          })

          // 获取当前活动标签页
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.windowId) {
            // 直接打开侧边栏
            await chrome.sidePanel.open({ windowId: tab.windowId })
            console.log('✅ 快捷键成功打开侧边栏')

            // 🎯 关键：立即禁用侧边栏，确保下次点击图标显示popup
            setTimeout(async () => {
              try {
                await chrome.sidePanel.setOptions({ enabled: false });
                console.log('🔄 已禁用侧边栏，下次点击图标将显示popup');
              } catch (err) {
                console.warn('禁用侧边栏失败:', err);
              }
            }, 500); // 给侧边栏500ms时间完全打开

            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'images/icon128.png',
              title: 'AcuityBookmarks - 侧边栏',
              message: '✅ 侧边栏已打开！点击扩展图标仍然会显示popup页面'
            })
          } else {
            throw new Error('无法获取当前窗口')
          }
        } catch (error) {
          console.warn('⚠️ 快捷键打开侧边栏失败，回退方案:', error)

          // 回退方案：在新标签页打开
          await chrome.tabs.create({
            url: chrome.runtime.getURL('side-panel.html')
          })

          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'AcuityBookmarks - 管理页面',
            message: '💡 侧边栏API不可用，已在新标签页中打开管理页面'
          })
        }
        break

      case 'open-management':
        await chrome.tabs.create({
          url: chrome.runtime.getURL('management.html')
        })
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
  await SuperBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onRemoved.addListener(async () => {
  console.log('📚 书签删除')
  await SuperBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onChanged.addListener(async () => {
  console.log('📚 书签修改')
  await SuperBookmarkManager.handleBookmarkChange()
})

chrome.bookmarks.onMoved.addListener(async () => {
  console.log('📚 书签移动')
  await SuperBookmarkManager.handleBookmarkChange()
})

// Service Worker 启动初始化
console.log('🚀 AcuityBookmarks Service Worker v2.0 已启动')
console.log('⚡ Manifest V3优化版本，性能大幅提升！')

// 🎯 确保侧边栏默认禁用，让onClicked能够触发
chrome.sidePanel.setOptions({ enabled: false }).catch(console.warn);

// 🎯 接管点击扩展图标的行为 - 永远打开popup
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('🖱️ 用户点击扩展图标 - 永远打开popup')

    // 永远打开popup，不管侧边栏状态如何
    await chrome.action.openPopup();
    console.log('✅ 点击图标: 已打开Popup');
  } catch (error) {
    console.error('❌ 处理图标点击失败:', error);
    // 如果openPopup失败，尝试其他方式
    console.warn('⚠️ openPopup失败，可能需要重新加载扩展');
  }
});

console.log('✅ 已设置扩展图标点击监听器')

// 🔧 处理打开侧边栏的请求
async function handleEnableSidePanel() {
  try {
    console.log('🎯 Popup请求打开侧边栏...')

    // 设置侧边栏配置
    await chrome.sidePanel.setOptions({
      path: 'side-panel.html',
      enabled: true
    });

    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      // 直接打开侧边栏
      await chrome.sidePanel.open({ windowId: tab.windowId });
      console.log('✅ Popup成功打开侧边栏');

      // 🎯 关键：立即禁用侧边栏，确保下次点击图标显示popup
      setTimeout(async () => {
        try {
          await chrome.sidePanel.setOptions({ enabled: false });
          console.log('🔄 已禁用侧边栏，下次点击图标将显示popup');
        } catch (err) {
          console.warn('禁用侧边栏失败:', err);
        }
      }, 500); // 给侧边栏500ms时间完全打开

      return { success: true, message: '🎉 侧边栏已打开！' };
    } else {
      throw new Error('无法获取当前窗口');
    }
  } catch (error) {
    console.error('❌ Popup打开侧边栏失败:', error);
    return {
      success: false,
      message: `打开侧边栏失败: ${error.message}`,
      fallback: true
    };
  }
}

// 🚀 启动超级书签数据处理
SuperBookmarkManager.preloadAndProcessBookmarks().then(() => {
  console.log('🎉 超级书签缓存系统初始化完成！')
}).catch(error => {
  console.error('❌ 超级书签缓存初始化失败:', error)
})

// 消息监听 - 处理前端页面的请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REQUEST_BOOKMARK_PRELOAD' || message.type === 'REQUEST_SUPER_CACHE_REFRESH') {
    console.log('📊 收到超级缓存刷新请求，执行数据处理...')
    SuperBookmarkManager.preloadAndProcessBookmarks().then(() => {
      sendResponse({ success: true, source: 'super-cache' })
    }).catch(error => {
      console.error('❌ 超级缓存刷新失败:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // 保持消息通道开放
  }
})
