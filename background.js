/**
 * AcuityBookmarks Service Worker - 统一架构版本
 *
 * 核心职责：
 * 1. 数据预处理中心 - 从Chrome API获取数据，进行深度处理
 * 2. IndexedDB管理 - 统一的数据存储和访问
 * 3. 消息处理中心 - 响应前端页面的API调用
 * 4. 数据同步服务 - 定期与Chrome书签同步
 * 5. 图标缓存管理 - 网站图标获取和缓存
 */

// 已移除对外部ES模块的导入，避免在Service Worker中触发模块错误

// ==================== 统一日志管理（Service Worker内置） ====================
// 在 Service Worker 环境中实现轻量 logger，并代理 console，保持统一风格
;(() => {
  const levelToStyle = {
    info: 'background: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 3px;',
    warn: 'background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px;',
    error:
      'background: #ffebee; color: #b71c1c; padding: 2px 6px; border-radius: 3px;',
    debug:
      'background: #f3e5f5; color: #4a148c; padding: 2px 6px; border-radius: 3px;'
  }

  // 保留原始 console 引用，避免递归
  const original = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console),
    debug: (console.debug || console.log).bind(console)
  }

  function formatLabel(scope, level) {
    const style = levelToStyle[level] || levelToStyle.info
    return [`%c${scope}`, style]
  }

  // 日志级别控制（统一放置于代理内部）
  const LOG_LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }
  // 默认日志级别改为 info，便于在SW控制台看到关键运行日志
  let LOG_LEVEL = 'info'
  function shouldLog(level) {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[LOG_LEVEL]
  }
  function setLogLevel(level) {
    if (level in LOG_LEVEL_ORDER) LOG_LEVEL = level
  }

  const logger = {
    info(scope, ...args) {
      if (!shouldLog('info')) return
      const [label, style] = formatLabel(scope, 'info')
      original.info(label, style, ...args)
    },
    warn(scope, ...args) {
      if (!shouldLog('warn')) return
      const [label, style] = formatLabel(scope, 'warn')
      original.warn(label, style, ...args)
    },
    error(scope, ...args) {
      if (!shouldLog('error')) return
      const [label, style] = formatLabel(scope, 'error')
      original.error(label, style, ...args)
    },
    debug(scope, ...args) {
      if (!shouldLog('debug')) return
      const [label, style] = formatLabel(scope, 'debug')
      original.info(label, style, ...args)
    }
  }

  // 统一代理：将 console 输出路由到带作用域的 logger
  console.log = (...args) => logger.info('ServiceWorker', ...args)
  console.info = (...args) => logger.info('ServiceWorker', ...args)
  console.warn = (...args) => logger.warn('ServiceWorker', ...args)
  console.error = (...args) => logger.error('ServiceWorker', ...args)
  console.debug = (...args) => logger.debug('ServiceWorker', ...args)

  // 暴露便于调试
  self.__SW_LOGGER__ = logger
  self.__SW_SET_LOG_LEVEL__ = setLogLevel
})()

// 在 Service Worker 全局作用域提供 logger 别名，便于直接使用
const logger = self.__SW_LOGGER__

/**
 * 轻量标签生成（Service Worker内置，避免模块导入）
 * 基于标题、URL和常见关键字做快速标签推断
 */
async function simpleGenerateTags(title = '', url = '') {
  try {
    const text = `${title} ${url}`.toLowerCase()
    const candidates = new Set()

    // 提取基本关键词（支持 Unicode 字母/数字）
    const wordMatches = text.match(/\b[\p{L}\p{N}-]{3,}\b/gu) || []
    wordMatches.slice(0, 10).forEach(w => candidates.add(w))

    // 基础领域映射
    const mappings = {
      technology: [
        'github',
        'stackoverflow',
        'developer',
        'api',
        'documentation',
        'code',
        'programming',
        'react',
        'vue',
        'angular',
        'javascript',
        'typescript',
        'python',
        'java',
        'css',
        'html'
      ],
      news: [
        'news',
        'article',
        'blog',
        'medium',
        'zhihu',
        'juejin',
        '新闻',
        '文章',
        '博客'
      ],
      tools: [
        'tool',
        'utility',
        'service',
        'app',
        'software',
        '工具',
        '应用',
        '服务'
      ]
    }
    for (const [tag, list] of Object.entries(mappings)) {
      if (list.some(kw => text.includes(kw))) candidates.add(tag)
    }

    // 根据域名补充一个来源标签
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      if (hostname) {
        const parts = hostname.split('.')
        const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
        if (base) candidates.add(base)
      }
    } catch (e) {
      // 忽略无效URL
      console.warn('[AI] 解析URL失败', e)
    }

    return Array.from(candidates).filter(Boolean).slice(0, 8)
  } catch (e) {
    console.warn('[AI] 生成标签失败', e)
    return []
  }
}

// ==================== AI 标签生成（Cloudflare Workers AI） ====================
// 说明：为避免在Service Worker中使用前端TS模块，这里实现最小AI调用版本
// 接口兼容后端/Cloudflare的 /api/ai/complete 端点
const AI_BASE_CANDIDATES = [
  // Prefer Cloudflare Workers local dev (wrangler dev)
  'http://127.0.0.1:8787',
  'http://localhost:8787',
  // Production Worker
  'https://acuitybookmarks.cqw547847.workers.dev'
]

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      },
      signal: controller.signal
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`AI API HTTP ${resp.status}: ${text || resp.statusText}`)
    }
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

function parseAiText(answer) {
  if (typeof answer === 'string') return answer
  if (typeof answer?.response === 'string') return answer.response
  if (typeof answer?.output_text === 'string') return answer.output_text
  if (Array.isArray(answer?.choices) && answer.choices.length > 0) {
    const choice = answer.choices[0]
    return choice?.message?.content || choice?.text || ''
  }
  try {
    return JSON.stringify(answer)
  } catch (e) {
    console.warn('[AI] 解析响应失败', e)
    return ''
  }
}

async function cloudflareGenerateTags(title = '', url = '') {
  const input = `${title} ${url}`.trim()
  if (!input) return []

  // 提示词与前端保持一致的意图（简短、结构化JSON数组）
  const TAG_PROMPT = `You are a bookmark tagging assistant. Based on the bookmark's title and content, generate 2-3 relevant tags.
- Output ONLY a JSON array of short tag strings
- Tags must be concise, lowercase, hyphen-separated if needed
- No explanations or extra text`

  const body = {
    prompt: `${TAG_PROMPT}\n\nInput: "${title}", content: "${url}"`,
    model: '@cf/meta/llama-3.1-8b-instruct',
    temperature: 0.2,
    max_tokens: 64,
    stream: false
  }

  // 依次尝试本地开发与线上Worker
  for (const base of AI_BASE_CANDIDATES) {
    try {
      const answer = await fetchJsonWithTimeout(
        `${base}/api/ai/complete`,
        {
          method: 'POST',
          body: JSON.stringify(body)
        },
        12000
      )
      const text = parseAiText(answer).trim()
      if (!text) continue
      let tags = []
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          tags = parsed.filter(t => typeof t === 'string' && t.length > 0)
        }
      } catch (e) {
        console.warn('[AI] 解析标签失败', e)
        tags = text
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0)
      }
      return tags.slice(0, 3)
    } catch (e) {
      // 继续尝试下一个base
      logger.warn(
        'ServiceWorker',
        '⚠️ [AI] 调用失败，尝试下一个提供者:',
        base,
        e?.message || e
      )
    }
  }

  // 所有AI提供者不可用，回退
  return []
}

async function generateTagsSmart(title = '', url = '') {
  // 先尝试AI生成，失败则回退到本地简单生成
  try {
    const aiTags = await cloudflareGenerateTags(title, url)
    if (aiTags && aiTags.length > 0) return aiTags
  } catch (err) {
    logger.warn(
      'ServiceWorker',
      '⚠️ [AI] 云端生成失败，回退本地:',
      err?.message || err
    )
  }
  return simpleGenerateTags(title, url)
}

// ==================== AI 嵌入生成（Cloudflare Workers AI） ====================
async function cloudflareGenerateEmbedding(text = '') {
  const body = {
    text,
    model: '@cf/baai/bge-m3'
  }

  for (const base of AI_BASE_CANDIDATES) {
    try {
      const answer = await fetchJsonWithTimeout(
        `${base}/api/ai/embedding`,
        {
          method: 'POST',
          body: JSON.stringify(body)
        },
        15000
      )
      // 兼容多种返回格式
      if (Array.isArray(answer)) return answer
      if (Array.isArray(answer?.data)) return answer.data
      if (Array.isArray(answer?.vector)) return answer.vector
      if (Array.isArray(answer?.response)) return answer.response
      // Cloudflare有时返回 { embeddings: [ ... ] }
      if (Array.isArray(answer?.embeddings)) return answer.embeddings
    } catch (e) {
      logger.warn(
        'ServiceWorker',
        '⚠️ [AI] 嵌入生成失败，尝试下一个提供者:',
        base,
        e?.message || e
      )
    }
  }
  return []
}

// 注意：Service Worker中无法直接import ES模块
// 需要将核心组件的类定义复制到这里，或者使用importScripts

// 由于Chrome扩展的限制，我们需要重新定义核心类
// 在真实项目中，可以考虑使用打包工具来处理这个问题

// 日志控制已集成到统一代理中，可通过 self.__SW_SET_LOG_LEVEL__('info'|'warn'|...) 动态调整

// ==================== 数据库配置 ====================

const DB_CONFIG = {
  NAME: 'AcuityBookmarksDB',
  VERSION: 4,
  STORES: {
    BOOKMARKS: 'bookmarks',
    GLOBAL_STATS: 'globalStats',
    SETTINGS: 'settings',
    SEARCH_HISTORY: 'searchHistory',
    FAVICON_CACHE: 'faviconCache',
    FAVICON_STATS: 'faviconStats',
    CRAWL_METADATA: 'crawlMetadata',
    EMBEDDINGS: 'embeddings',
    AI_JOBS: 'ai_jobs'
  }
}

const CURRENT_DATA_VERSION = '2.0.0'
const SYNC_INTERVAL = 60000 // 1分钟同步间隔

// ==================== 存储配额监控 ====================
class StorageQuotaMonitor {
  constructor() {
    this.WARNING_THRESHOLD = 0.8 // 80%
    this.CRITICAL_THRESHOLD = 0.95 // 95%
  }

  async checkQuota() {
    try {
      // eslint-disable-next-line no-undef
      const estimateFn = navigator?.storage?.estimate
      if (!estimateFn) return

      const estimate = await estimateFn()
      const usage = Number(estimate?.usage || 0)
      const quota = Number(estimate?.quota || 1)
      const percentUsed = quota > 0 ? usage / quota : 0

      if (percentUsed > this.CRITICAL_THRESHOLD) {
        try {
          chrome.notifications.create({
            type: 'basic',
            title: 'Storage Critical',
            message: `Storage usage: ${(percentUsed * 100).toFixed(1)}%`,
            iconUrl: 'images/icon48.png'
          })
        } catch (err) {
          // ignore notification errors in SW
          logger.warn('ServiceWorker', '⚠️ [存储配额] 通知失败', err)
        }
        logger.warn('ServiceWorker', '🚨 [存储配额] 严重告警', {
          usage,
          quota,
          percentUsed
        })
      } else if (percentUsed > this.WARNING_THRESHOLD) {
        logger.warn('ServiceWorker', '⚠️ [存储配额] 预警', {
          usage,
          quota,
          percentUsed
        })
      }
    } catch (error) {
      logger.warn('ServiceWorker', '⚠️ [存储配额] 检查失败', error)
    }
  }
}

const storageQuotaMonitor = new StorageQuotaMonitor()

// 注册配额检查 alarms（每小时）
try {
  chrome.alarms.create('StorageQuotaCheck', { periodInMinutes: 60 })
} catch (e) {
  logger.warn('ServiceWorker', '⚠️ [存储配额] 注册 alarms 失败:', e)
}

// ==================== IndexedDB管理器 ====================

/**
 * IndexedDB 管理器（运行于 Service Worker）
 * - 负责数据库的初始化、版本迁移与事务封装；
 * - 提供批量写入、重试与指数退避，提升稳定性；
 * - 对外暴露 CRUD 与统计查询接口，供业务层使用。
 */
class ServiceWorkerIndexedDBManager {
  constructor() {
    this.db = null
    this.isInitialized = false
    this.initPromise = null
  }

  async _ensureReady() {
    // 已有连接则直接返回
    if (this.db) return

    // 正在初始化则等待同一承诺
    if (this.initPromise) {
      await this.initPromise
    } else {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('IndexedDB初始化进行中或失败，请稍后重试')
    }
  }

  async initialize() {
    if (this.isInitialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  async _doInitialize() {
    logger.info('ServiceWorker', '🚀 [Service Worker] IndexedDB初始化开始...', {
      name: DB_CONFIG.NAME,
      version: DB_CONFIG.VERSION
    })

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION)

      request.onerror = () => {
        const { error } = request
        logger.error(
          'ServiceWorker',
          '❌ [Service Worker] IndexedDB初始化失败:',
          error
        )
        this.initPromise = null
        reject(
          new Error(`IndexedDB初始化失败: ${error?.message || 'Unknown error'}`)
        )
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        this.initPromise = null

        logger.info(
          'ServiceWorker',
          '✅ [Service Worker] IndexedDB初始化成功',
          {
            version: this.db.version,
            stores: Array.from(this.db.objectStoreNames)
          }
        )

        resolve()
      }

      request.onupgradeneeded = event => {
        const db = event.target.result
        const { oldVersion } = event
        const { newVersion } = event

        logger.info('ServiceWorker', '🔧 [Service Worker] 数据库升级', {
          from: oldVersion,
          to: newVersion
        })

        try {
          this._createStores(db)
          logger.info('ServiceWorker', '✅ [Service Worker] 表结构创建完成')
        } catch (error) {
          logger.error(
            'ServiceWorker',
            '❌ [Service Worker] 表结构创建失败:',
            error
          )
          throw error
        }
      }

      request.onblocked = () => {
        logger.warn(
          'ServiceWorker',
          '⚠️ [Service Worker] 升级被阻塞，其他标签页可能正在使用数据库'
        )
      }
    })
  }

  _createStores(db) {
    // 创建书签表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOOKMARKS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建书签表...')
      const bookmarkStore = db.createObjectStore(DB_CONFIG.STORES.BOOKMARKS, {
        keyPath: 'id'
      })

      // 创建高性能索引
      bookmarkStore.createIndex('parentId', 'parentId', { unique: false })
      bookmarkStore.createIndex('url', 'url', { unique: false })
      bookmarkStore.createIndex('domain', 'domain', { unique: false })
      bookmarkStore.createIndex('titleLower', 'titleLower', { unique: false })
      bookmarkStore.createIndex('depth', 'depth', { unique: false })
      bookmarkStore.createIndex('pathIds', 'pathIds', {
        unique: false,
        multiEntry: true
      })
      bookmarkStore.createIndex('keywords', 'keywords', {
        unique: false,
        multiEntry: true
      })
      bookmarkStore.createIndex('tags', 'tags', {
        unique: false,
        multiEntry: true
      })
      bookmarkStore.createIndex('dateAdded', 'dateAdded', { unique: false })
      bookmarkStore.createIndex('isFolder', 'isFolder', { unique: false })
      bookmarkStore.createIndex('category', 'category', { unique: false })
      bookmarkStore.createIndex('createdYear', 'createdYear', { unique: false })
      bookmarkStore.createIndex('visitCount', 'visitCount', { unique: false })

      logger.info('ServiceWorker', '✅ [Service Worker] 书签表创建完成')
    }

    // 创建全局统计表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.GLOBAL_STATS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建全局统计表...')
      db.createObjectStore(DB_CONFIG.STORES.GLOBAL_STATS, {
        keyPath: 'key'
      })
      logger.info('ServiceWorker', '✅ [Service Worker] 全局统计表创建完成')
    }

    // 创建设置表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SETTINGS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建设置表...')
      const settingsStore = db.createObjectStore(DB_CONFIG.STORES.SETTINGS, {
        keyPath: 'key'
      })
      settingsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      settingsStore.createIndex('type', 'type', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 设置表创建完成')
    }

    // 创建搜索历史表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SEARCH_HISTORY)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建搜索历史表...')
      const historyStore = db.createObjectStore(
        DB_CONFIG.STORES.SEARCH_HISTORY,
        {
          keyPath: 'id',
          autoIncrement: true
        }
      )
      historyStore.createIndex('query', 'query', { unique: false })
      historyStore.createIndex('timestamp', 'timestamp', { unique: false })
      historyStore.createIndex('source', 'source', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 搜索历史表创建完成')
    }

    // 创建图标缓存表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_CACHE)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建图标缓存表...')
      const faviconStore = db.createObjectStore(
        DB_CONFIG.STORES.FAVICON_CACHE,
        {
          keyPath: 'domain'
        }
      )
      faviconStore.createIndex('timestamp', 'timestamp', { unique: false })
      faviconStore.createIndex('lastAccessed', 'lastAccessed', {
        unique: false
      })
      faviconStore.createIndex('accessCount', 'accessCount', { unique: false })
      faviconStore.createIndex('bookmarkCount', 'bookmarkCount', {
        unique: false
      })
      faviconStore.createIndex('isPopular', 'isPopular', { unique: false })
      faviconStore.createIndex('quality', 'quality', { unique: false })
      faviconStore.createIndex('expiresAt', 'expiresAt', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 图标缓存表创建完成')
    }

    // 创建图标统计表
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_STATS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建图标统计表...')
      const faviconStatsStore = db.createObjectStore(
        DB_CONFIG.STORES.FAVICON_STATS,
        {
          keyPath: 'key'
        }
      )
      faviconStatsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 图标统计表创建完成')
    }

    // 创建爬虫元数据表（用于书签健康度与HTTP状态统计）
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.CRAWL_METADATA)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建爬虫元数据表...')
      const crawlStore = db.createObjectStore(DB_CONFIG.STORES.CRAWL_METADATA, {
        keyPath: 'bookmarkId'
      })
      crawlStore.createIndex('domain', 'domain', { unique: false })
      crawlStore.createIndex('source', 'source', { unique: false })
      crawlStore.createIndex('httpStatus', 'httpStatus', { unique: false })
      crawlStore.createIndex('statusGroup', 'statusGroup', { unique: false })
      crawlStore.createIndex('lastCrawled', 'lastCrawled', { unique: false })
      crawlStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 爬虫元数据表创建完成')
    }

    // 创建嵌入向量表（用于语义搜索/AI管线）
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.EMBEDDINGS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建嵌入向量表...')
      const embeddingStore = db.createObjectStore(DB_CONFIG.STORES.EMBEDDINGS, {
        keyPath: 'bookmarkId'
      })
      // 索引：更新时间、维度（可选）、域名
      embeddingStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      embeddingStore.createIndex('domain', 'domain', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] 嵌入向量表创建完成')
    }

    // 创建AI作业表（用于异步任务/重试/状态跟踪）
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.AI_JOBS)) {
      logger.info('ServiceWorker', '📊 [Service Worker] 创建AI作业表...')
      const jobStore = db.createObjectStore(DB_CONFIG.STORES.AI_JOBS, {
        keyPath: 'id'
      })
      jobStore.createIndex('status', 'status', { unique: false })
      jobStore.createIndex('type', 'type', { unique: false })
      jobStore.createIndex('createdAt', 'createdAt', { unique: false })
      jobStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      logger.info('ServiceWorker', '✅ [Service Worker] AI作业表创建完成')
    }
  }

  async withTransaction(
    storeNames,
    type,
    callback,
    { maxRetries = 3, initialBackoff = 50, retryFactor = 2 } = {}
  ) {
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        if (!this.db) {
          await this.initialize()
        }
        const tx = this.db.transaction(storeNames, type)
        const stores = Array.isArray(storeNames)
          ? storeNames.map(name => tx.objectStore(name))
          : tx.objectStore(storeNames)
        const result = await callback(stores, tx)
        await new Promise(resolve => {
          tx.oncomplete = () => resolve()
        })
        return result
      } catch (error) {
        if (
          error.name === 'AbortError' ||
          error.name === 'TransactionInactiveError'
        ) {
          attempt++
          if (attempt >= maxRetries) {
            throw error
          }
          const backoff = initialBackoff * Math.pow(retryFactor, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, backoff))
        } else {
          throw error
        }
      }
    }
  }

  _ensureDB() {
    if (!this.db) {
      throw new Error('IndexedDB未初始化，请先调用initialize()')
    }
    return this.db
  }

  // 动态计算批次大小（基于设备内存与数据规模）
  calculateOptimalBatchSize(totalRecords) {
    const memoryGB = self.navigator.deviceMemory || 4
    const baseBatchSize = memoryGB >= 8 ? 5000 : 2000
    if (totalRecords < 1000) return totalRecords
    if (totalRecords > 100000) return Math.min(baseBatchSize, 1000)
    return baseBatchSize
  }

  // 批量插入书签
  async insertBookmarks(bookmarks) {
    await this._ensureReady()

    const total = bookmarks.length
    if (total === 0) return

    // 动态计算批次大小
    const batchSize = this.calculateOptimalBatchSize(total)

    const startTime = performance.now()
    logger.info(
      'ServiceWorker',
      `📥 [Service Worker] 准备分批插入 ${total} 条书签（每批 ${batchSize}）...`
    )

    let processedCount = 0

    for (let i = 0; i < total; i += batchSize) {
      const chunk = bookmarks.slice(i, i + batchSize)

      try {
        await this.withTransaction(
          [DB_CONFIG.STORES.BOOKMARKS],
          'readwrite',
          async stores => {
            const store = stores[0]
            const promises = chunk.map(bookmark => {
              return new Promise((resolve, reject) => {
                const req = store.put(bookmark)
                req.onsuccess = () => {
                  processedCount++
                  resolve()
                }
                req.onerror = () => {
                  logger.error(
                    'ServiceWorker',
                    `❌ [Service Worker] 插入失败: ${bookmark?.id}`,
                    req.error
                  )
                  reject(req.error)
                }
              })
            })
            await Promise.all(promises)
          }
        )

        logger.info(
          'ServiceWorker',
          `📊 [Service Worker] 插入进度: ${processedCount}/${total}`
        )

        // 批间让步
        if (i + batchSize < total) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      } catch (e) {
        logger.error(
          'ServiceWorker',
          `❌ [Service Worker] 第 ${(i / batchSize) | 0} 批插入失败:`,
          e
        )
      }
    }

    const duration = performance.now() - startTime
    logger.info(
      'ServiceWorker',
      `✅ [Service Worker] 分批插入完成: ${processedCount}/${total} 条, 耗时: ${duration.toFixed(2)}ms`
    )
  }

  // 获取所有书签
  async getAllBookmarks() {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 根据ID获取书签
  async getBookmarkById(id) {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * 更新单个书签的部分字段（如 tags）
   */
  async updateBookmark(id, patch = {}) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
      const store = tx.objectStore(DB_CONFIG.STORES.BOOKMARKS)

      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const record = getReq.result
        if (!record) {
          resolve(false)
          return
        }

        // 合并更新并维护派生字段（最小化修改）
        const updated = { ...record, ...patch }
        if (typeof updated.title === 'string') {
          updated.titleLower = updated.title.toLowerCase()
        }
        if (Array.isArray(updated.tags)) {
          // 去重与标准化
          updated.tags = Array.from(
            new Set(updated.tags.map(t => String(t).trim()).filter(Boolean))
          )
        }

        const putReq = store.put(updated)
        putReq.onsuccess = () => resolve(true)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  // 批量更新书签（针对已计算好的完整记录）
  async updateBookmarksBatch(records = []) {
    await this._ensureReady()
    const total = records.length
    if (total === 0) return

    const batchSize = this.calculateOptimalBatchSize(total)
    let processedCount = 0
    const startTime = performance.now()

    for (let i = 0; i < total; i += batchSize) {
      const chunk = records.slice(i, i + batchSize)
      try {
        await this.withTransaction(
          [DB_CONFIG.STORES.BOOKMARKS],
          'readwrite',
          async stores => {
            const store = stores[0]
            const promises = chunk.map(
              rec =>
                new Promise((resolve, reject) => {
                  const req = store.put(rec)
                  req.onsuccess = () => {
                    processedCount++
                    resolve()
                  }
                  req.onerror = () => reject(req.error)
                })
            )
            await Promise.all(promises)
          }
        )

        if (i + batchSize < total) {
          await new Promise(r => setTimeout(r, 0))
        }
      } catch (e) {
        logger.error(
          'ServiceWorker',
          `❌ [Service Worker] 批量更新第 ${(i / batchSize) | 0} 批失败:`,
          e
        )
      }
    }

    const duration = performance.now() - startTime
    logger.info(
      'ServiceWorker',
      `✅ [Service Worker] 批量更新完成: ${processedCount}/${total} 条, 耗时: ${duration.toFixed(2)}ms`
    )
  }

  // 批量删除书签（按ID数组）
  async deleteBookmarksBatch(ids = []) {
    await this._ensureReady()
    const total = ids.length
    if (total === 0) return

    const batchSize = this.calculateOptimalBatchSize(total)
    let processedCount = 0
    const startTime = performance.now()

    for (let i = 0; i < total; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize)
      try {
        await this.withTransaction(
          [DB_CONFIG.STORES.BOOKMARKS],
          'readwrite',
          async stores => {
            const store = stores[0]
            const promises = chunk.map(
              id =>
                new Promise((resolve, reject) => {
                  const req = store.delete(id)
                  req.onsuccess = () => {
                    processedCount++
                    resolve()
                  }
                  req.onerror = () => reject(req.error)
                })
            )
            await Promise.all(promises)
          }
        )

        if (i + batchSize < total) {
          await new Promise(r => setTimeout(r, 0))
        }
      } catch (e) {
        logger.error(
          'ServiceWorker',
          `❌ [Service Worker] 批量删除第 ${(i / batchSize) | 0} 批失败:`,
          e
        )
      }
    }

    const duration = performance.now() - startTime
    logger.info(
      'ServiceWorker',
      `✅ [Service Worker] 批量删除完成: ${processedCount}/${total} 条, 耗时: ${duration.toFixed(2)}ms`
    )
  }

  // 根据父ID获取子书签
  async getChildrenByParentId(parentId) {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const index = store.index('parentId')
      const request = index.getAll(parentId)

      request.onsuccess = () => {
        const results = request.result.sort((a, b) => a.index - b.index)
        resolve(results)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 搜索书签
  async searchBookmarks(query, options = {}) {
    const db = this._ensureDB()
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0)

    if (searchTerms.length === 0) {
      return []
    }

    const { limit = 100, minScore = 0 } = options

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const results = []

      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result

        if (cursor && results.length < limit) {
          const bookmark = cursor.value
          const searchResult = this._calculateSearchScore(
            bookmark,
            searchTerms,
            options
          )

          if (searchResult.score > minScore) {
            results.push(searchResult)
          }

          cursor.continue()
        } else {
          // 按分数排序
          results.sort((a, b) => b.score - a.score)
          resolve(results)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  _calculateSearchScore(bookmark, searchTerms) {
    let score = 0
    const matchedFields = []
    const highlights = {}

    for (const term of searchTerms) {
      // 标题匹配
      if (bookmark.titleLower.includes(term)) {
        const weight = bookmark.titleLower.startsWith(term) ? 100 : 50
        score += weight
        matchedFields.push('title')
        if (!highlights.title) highlights.title = []
        highlights.title.push(term)
      }

      // URL匹配
      if (bookmark.urlLower && bookmark.urlLower.includes(term)) {
        score += 30
        matchedFields.push('url')
        if (!highlights.url) highlights.url = []
        highlights.url.push(term)
      }

      // 域名匹配
      if (bookmark.domain && bookmark.domain.includes(term)) {
        score += 20
        matchedFields.push('domain')
        if (!highlights.domain) highlights.domain = []
        highlights.domain.push(term)
      }

      // 爬虫元数据加权匹配（派生字段，低成本提升精度）
      const metaBoost =
        typeof bookmark.metaBoost === 'number'
          ? bookmark.metaBoost
          : (() => {
              if (!bookmark.metadataUpdatedAt) return 1.0
              const ageDays =
                (Date.now() - bookmark.metadataUpdatedAt) /
                (24 * 60 * 60 * 1000)
              if (ageDays > 180) return 0.6
              if (ageDays > 90) return 0.8
              return 1.0
            })()

      if (bookmark.metaTitleLower && bookmark.metaTitleLower.includes(term)) {
        score += Math.round(40 * metaBoost)
        matchedFields.push('meta_title')
        if (!highlights.meta_title) highlights.meta_title = []
        highlights.meta_title.push(term)
      }

      if (
        Array.isArray(bookmark.metaKeywordsTokens) &&
        bookmark.metaKeywordsTokens.some(k => k.includes(term))
      ) {
        score += Math.round(25 * metaBoost)
        matchedFields.push('meta_keywords')
        if (!highlights.meta_keywords) highlights.meta_keywords = []
        highlights.meta_keywords.push(term)
      }

      if (
        bookmark.metaDescriptionLower &&
        bookmark.metaDescriptionLower.includes(term)
      ) {
        score += Math.round(10 * metaBoost)
        matchedFields.push('meta_desc')
        if (!highlights.meta_desc) highlights.meta_desc = []
        highlights.meta_desc.push(term)
      }

      // 关键词匹配
      if (
        bookmark.keywords &&
        bookmark.keywords.some(keyword => keyword.includes(term))
      ) {
        score += 15
        matchedFields.push('keywords')
        if (!highlights.keywords) highlights.keywords = []
        highlights.keywords.push(term)
      }

      // 标签匹配
      if (
        bookmark.tags &&
        bookmark.tags.some(tag => tag.toLowerCase().includes(term))
      ) {
        score += 10
        matchedFields.push('tags')
        if (!highlights.tags) highlights.tags = []
        highlights.tags.push(term)
      }
    }

    return {
      bookmark,
      score,
      matchedFields: [...new Set(matchedFields)],
      highlights
    }
  }

  // 清空所有书签
  async clearAllBookmarks() {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.BOOKMARKS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
      const request = store.clear()

      request.onsuccess = () => {
        logger.info('ServiceWorker', '✅ [Service Worker] 所有书签已清空')
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 更新全局统计
  async updateGlobalStats(stats) {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.GLOBAL_STATS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)

      const statsRecord = {
        key: 'basic',
        ...stats,
        lastUpdated: Date.now()
      }

      const request = store.put(statsRecord)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 获取全局统计
  async getGlobalStats() {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.GLOBAL_STATS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)
      const request = store.get('basic')
      request.onsuccess = () => {
        const { key, ...status } = request
        logger.info(
          'ServiceWorker',
          '📊 [Service Worker] 获取全局统计:',
          status,
          key
        )
        if (status) {
          resolve(status)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 添加搜索历史
  async addSearchHistory(
    query,
    results,
    executionTime = 0,
    source = 'management'
  ) {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)

      const historyRecord = {
        query,
        results,
        executionTime,
        source,
        timestamp: Date.now()
      }

      const request = store.add(historyRecord)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // ==================== 嵌入与AI作业操作 ====================

  async saveEmbedding(embeddingRecord) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.EMBEDDINGS], 'readwrite')
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        store.put(embeddingRecord)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async getEmbedding(bookmarkId) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.EMBEDDINGS], 'readonly')
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        const req = store.get(bookmarkId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async getAllEmbeddings() {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.EMBEDDINGS], 'readonly')
        const store = tx.objectStore(DB_CONFIG.STORES.EMBEDDINGS)
        const results = []
        const req = store.openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (cursor) {
            results.push(cursor.value)
            cursor.continue()
          } else {
            resolve(results)
          }
        }
        req.onerror = () => reject(req.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  // ==================== Crawl Metadata APIs ====================
  async upsertCrawlMetadata(record) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(
          [DB_CONFIG.STORES.CRAWL_METADATA],
          'readwrite'
        )
        const store = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
        const now = Date.now()
        const toSave = { ...record, updatedAt: record.updatedAt || now }
        store.put(toSave)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async getCrawlMetadataByBookmarkId(bookmarkId) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.CRAWL_METADATA], 'readonly')
        const store = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
        const req = store.get(bookmarkId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async getAllCrawlMetadata() {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.CRAWL_METADATA], 'readonly')
        const store = tx.objectStore(DB_CONFIG.STORES.CRAWL_METADATA)
        const results = []
        const req = store.openCursor()
        req.onsuccess = () => {
          const cursor = req.result
          if (cursor) {
            results.push(cursor.value)
            cursor.continue()
          } else {
            resolve(results)
          }
        }
        req.onerror = () => reject(req.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async upsertAIJob(job) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.AI_JOBS], 'readwrite')
        const store = tx.objectStore(DB_CONFIG.STORES.AI_JOBS)
        store.put(job)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async getAIJob(id) {
    const db = this._ensureDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([DB_CONFIG.STORES.AI_JOBS], 'readonly')
        const store = tx.objectStore(DB_CONFIG.STORES.AI_JOBS)
        const req = store.get(id)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 获取搜索历史
  async getSearchHistory(limit = 20) {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
      const index = store.index('timestamp')

      const results = []
      const request = index.openCursor(null, 'prev')

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 清空搜索历史
  async clearSearchHistory() {
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SEARCH_HISTORY],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SEARCH_HISTORY)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 保存设置
  async saveSetting(key, value, type, description) {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)

      const setting = {
        key,
        value,
        type: type || typeof value,
        description,
        updatedAt: Date.now()
      }

      const request = store.put(setting)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 获取设置
  async getSetting(key) {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readonly'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
      const request = store.get(key)

      request.onsuccess = () => {
        const { result } = request
        resolve(result ? result.value : null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 删除设置
  async deleteSetting(key) {
    await this._ensureReady()
    const db = this._ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [DB_CONFIG.STORES.SETTINGS],
        'readwrite'
      )
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  // 检查数据库健康状态
  async checkDatabaseHealth() {
    try {
      const db = this._ensureDB()
      const expectedStores = Object.values(DB_CONFIG.STORES)
      const existingStores = Array.from(db.objectStoreNames)

      const missingStores = expectedStores.filter(
        store => !existingStores.includes(store)
      )
      const extraStores = existingStores.filter(
        store => !expectedStores.includes(store)
      )

      const isHealthy = missingStores.length === 0 && extraStores.length === 0

      return {
        isHealthy,
        version: db.version,
        expectedStores,
        existingStores,
        missingStores,
        extraStores,
        lastCheck: Date.now(),
        errors: []
      }
    } catch (error) {
      return {
        isHealthy: false,
        version: 0,
        expectedStores: Object.values(DB_CONFIG.STORES),
        existingStores: [],
        missingStores: Object.values(DB_CONFIG.STORES),
        extraStores: [],
        lastCheck: Date.now(),
        errors: [error.message]
      }
    }
  }

  // 获取数据库统计
  async getDatabaseStats() {
    const db = this._ensureDB()

    const getStoreCount = storeName => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.count()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }

    try {
      const [bookmarkCount, faviconCount, searchHistoryCount, settingsCount] =
        await Promise.all([
          getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
          getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
          getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
          getStoreCount(DB_CONFIG.STORES.SETTINGS)
        ])

      const totalSize =
        bookmarkCount * 1000 +
        faviconCount * 2000 +
        searchHistoryCount * 100 +
        settingsCount * 50

      return {
        bookmarkCount,
        faviconCount,
        searchHistoryCount,
        settingsCount,
        totalSize,
        indexSize: totalSize * 0.1,
        lastOptimized: Date.now()
      }
    } catch (error) {
      throw new Error(`获取数据库统计失败: ${error.message}`)
    }
  }
}

// ==================== 数据预处理器 ====================

/**
 * 书签预处理器
 * - 拉取并扁平化 Chrome 书签树；
 * - 增强节点（域名、分类、关键字等）并建立关系索引；
 * - 产出可持久化的数据结构供同步与搜索使用。
 */
class ServiceWorkerBookmarkPreprocessor {
  constructor() {
    this.urlRegex = /^https?:\/\//
    this.domainRegex = /^https?:\/\/([^/]+)/
    // 派生字段缓存（LRU + TTL）：domain/titleLower/urlLower
    this.derivedFieldsCache = new Map()
    this.derivedCacheMax = 10000 // 最大缓存条目数
    this.derivedCacheTTL = 3600000 // 1小时过期
  }

  // 读取缓存：校验TTL并提升至最近使用（LRU）
  _getDerivedCache(key) {
    const entry = this.derivedFieldsCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.derivedCacheTTL) {
      // 过期则移除
      this.derivedFieldsCache.delete(key)
      return null
    }
    // LRU：提升至最新
    this.derivedFieldsCache.delete(key)
    this.derivedFieldsCache.set(key, entry)
    return entry
  }

  // 写入缓存：设置时间戳并按容量逐出最旧项
  _setDerivedCache(key, value) {
    const entry = { ...value, timestamp: Date.now() }
    if (this.derivedFieldsCache.has(key)) {
      this.derivedFieldsCache.delete(key)
    }
    this.derivedFieldsCache.set(key, entry)
    // 超容量则逐出最旧项
    while (this.derivedFieldsCache.size > this.derivedCacheMax) {
      const oldestKey = this.derivedFieldsCache.keys().next().value
      this.derivedFieldsCache.delete(oldestKey)
    }
  }

  async processBookmarks() {
    logger.info('ServiceWorker', '🚀 [预处理器] 开始处理书签数据...')
    const startTime = performance.now()

    try {
      // 1. 从Chrome API获取原始数据
      const chromeTree = await this._getChromeBookmarks()
      const originalDataHash = this._generateDataHash(chromeTree)

      // 2. 扁平化处理
      const flatBookmarks = this._flattenBookmarks(chromeTree)
      logger.info(
        'ServiceWorker',
        `📊 [预处理器] 扁平化完成: ${flatBookmarks.length} 个节点`
      )

      // 3. 增强处理
      const enhancedBookmarks = this._enhanceBookmarks(flatBookmarks)

      // 4. 生成统计信息
      const stats = this._generateStats(enhancedBookmarks)

      const endTime = performance.now()
      const processingTime = endTime - startTime

      logger.info(
        'ServiceWorker',
        `✅ [预处理器] 处理完成: ${enhancedBookmarks.length} 条记录, 耗时: ${processingTime.toFixed(2)}ms`
      )

      return {
        bookmarks: enhancedBookmarks,
        stats,
        metadata: {
          originalDataHash,
          processedAt: Date.now(),
          version: CURRENT_DATA_VERSION,
          processingTime
        }
      }
    } catch (error) {
      logger.error('ServiceWorker', '❌ [预处理器] 处理失败:', error)
      throw new Error(`书签预处理失败: ${error.message}`)
    }
  }

  async _getChromeBookmarks() {
    try {
      if (!chrome?.bookmarks?.getTree) {
        throw new Error('Chrome Bookmarks API 不可用')
      }

      // ✅ 现代化：使用Promise API替代回调风格
      const tree = await chrome.bookmarks.getTree()
      return tree || []
    } catch (error) {
      logger.error('ServiceWorker', '❌ 获取Chrome书签树失败:', error)
      throw new Error(
        `获取书签树失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  _flattenBookmarks(tree, parentPath = [], parentIds = []) {
    const flattened = []
    const stack = []
    const visited = new Set()

    // 初始化栈（逆序入栈以保持与递归相同的遍历顺序）
    for (let i = tree.length - 1; i >= 0; i--) {
      stack.push({ node: tree[i], path: parentPath, ids: parentIds })
    }

    while (stack.length > 0) {
      const { node, path, ids } = stack.pop()

      if (node.id === '0') {
        const children = node.children || []
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push({ node: children[i], path: [], ids: [] })
        }
        continue
      }

      if (visited.has(node.id)) {
        continue
      }
      visited.add(node.id)

      flattened.push({
        ...node,
        _parentPath: path,
        _parentIds: ids
      })

      if (node.children && node.children.length > 0) {
        const childPath = [...path, node.title]
        const childIds = [...ids, node.id]
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push({ node: node.children[i], path: childPath, ids: childIds })
        }
      }
    }

    return flattened
  }

  _enhanceBookmarks(flatBookmarks) {
    const enhanced = []
    const childrenMap = new Map()

    // 建立父子关系映射
    for (const bookmark of flatBookmarks) {
      if (bookmark.parentId) {
        if (!childrenMap.has(bookmark.parentId)) {
          childrenMap.set(bookmark.parentId, [])
        }
        childrenMap.get(bookmark.parentId).push(bookmark)
      }
    }

    // 将进度日志频率动态化，最多打印约 50 次，避免海量日志拖慢 SW
    const progressStep = Math.max(1000, Math.ceil(flatBookmarks.length / 50))
    for (let i = 0; i < flatBookmarks.length; i++) {
      const node = flatBookmarks[i]

      if (i % progressStep === 0) {
        logger.info(
          'ServiceWorker',
          `📊 [预处理器] 增强进度: ${i}/${flatBookmarks.length}`
        )
      }

      const enhanced_record = this._enhanceSingleBookmark(node, childrenMap)
      enhanced.push(enhanced_record)
    }

    // 计算兄弟节点关系
    this._calculateSiblingRelations(enhanced)

    return enhanced
  }

  _enhanceSingleBookmark(node, childrenMap) {
    const isFolder = !node.url
    const children = childrenMap.get(node.id) || []

    const parentPath = node._parentPath || []
    const parentIds = node._parentIds || []
    const path = [...parentPath, node.title]
    const pathIds = [...parentIds, node.id]

    // 命中缓存则复用派生字段（含TTL与LRU提升）
    const cached = this._getDerivedCache(node.id)
    const cacheValid = Boolean(cached)

    let domain, urlLower
    if (node.url) {
      if (cacheValid && cached.urlLower && cached.domain) {
        ;({ domain } = cached)
      } else {
        urlLower = node.url.toLowerCase()
        const domainMatch = node.url.match(this.domainRegex)
        if (domainMatch) {
          domain = domainMatch[1].toLowerCase()
        }
      }
    }

    const titleLower =
      cacheValid && cached.titleLower
        ? cached.titleLower
        : node.title.toLowerCase()

    const keywords = this._generateKeywords(node.title, node.url, domain)
    // 避免深度递归：仅统计直接子项（大数据量下更稳健）
    const childrenCount = children.length
    let directBookmarks = 0
    let directFolders = 0
    for (const c of children) {
      if (c && c.url) directBookmarks++
      else directFolders++
    }
    const bookmarksCount = directBookmarks
    const folderCount = directFolders
    const category = this._analyzeCategory(node.title, node.url, domain)

    // 写入/刷新派生字段缓存（LRU+TTL）
    try {
      this._setDerivedCache(node.id, { domain, titleLower, urlLower })
    } catch (error) {
      logger.error('ServiceWorker', '❌ 写入书签缓存失败:', error)
    }

    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      url: node.url,
      dateAdded: node.dateAdded,
      dateGroupModified: node.dateGroupModified,
      index: node.index || 0,

      path,
      pathString: path.join(' / '),
      pathIds,
      pathIdsString: pathIds.join(' / '),
      ancestorIds: parentIds,
      siblingIds: [],
      depth: pathIds.length,

      titleLower,
      urlLower,
      domain,
      keywords,

      isFolder,
      childrenCount,
      bookmarksCount,
      folderCount,

      tags: [],
      category,
      notes: undefined,
      lastVisited: undefined,
      visitCount: 0,

      createdYear: node.dateAdded
        ? new Date(node.dateAdded).getFullYear()
        : new Date().getFullYear(),
      createdMonth: node.dateAdded
        ? new Date(node.dateAdded).getMonth() + 1
        : new Date().getMonth() + 1,
      domainCategory: domain ? this._categorizeDomain(domain) : undefined,

      flatIndex: 0,
      isVisible: true,
      sortKey: `${String(node.index || 0).padStart(10, '0')}_${node.title}`,

      dataVersion: CURRENT_DATA_VERSION,
      lastCalculated: Date.now()
    }
  }

  _calculateSiblingRelations(bookmarks) {
    const siblingGroups = new Map()

    for (const bookmark of bookmarks) {
      const parentId = bookmark.parentId || 'root'
      if (!siblingGroups.has(parentId)) {
        siblingGroups.set(parentId, [])
      }
      siblingGroups.get(parentId).push(bookmark)
    }

    for (const siblings of siblingGroups.values()) {
      for (const bookmark of siblings) {
        bookmark.siblingIds = siblings
          .filter(sibling => sibling.id !== bookmark.id)
          .map(sibling => sibling.id)
      }
    }
  }

  _generateKeywords(title, url, domain, maxKeywords = 10) {
    const keywords = new Set()

    const titleWords = title
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)

    titleWords.forEach(word => keywords.add(word))

    if (url) {
      const urlKeywords = url
        .toLowerCase()
        .replace(/https?:\/\//, '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2)

      urlKeywords.slice(0, 3).forEach(word => keywords.add(word))
    }

    if (domain) {
      keywords.add(domain)
      const domainParts = domain.split('.')
      if (domainParts.length >= 2) {
        keywords.add(domainParts[domainParts.length - 2])
      }
    }

    return Array.from(keywords).slice(0, maxKeywords)
  }

  _analyzeCategory(title, url) {
    const titleLower = title.toLowerCase()
    const urlLower = url?.toLowerCase() || ''

    if (
      this._matchesKeywords(`${titleLower} ${urlLower}`, [
        'github',
        'stackoverflow',
        'developer',
        'api',
        'documentation',
        'code',
        'programming',
        'react',
        'vue',
        'angular',
        'javascript',
        'typescript',
        'python',
        'java',
        'css',
        'html'
      ])
    ) {
      return 'technology'
    }

    if (
      this._matchesKeywords(`${titleLower} ${urlLower}`, [
        'news',
        'article',
        'blog',
        'medium',
        'zhihu',
        'juejin',
        '新闻',
        '文章',
        '博客'
      ])
    ) {
      return 'news'
    }

    if (
      this._matchesKeywords(`${titleLower} ${urlLower}`, [
        'tool',
        'utility',
        'service',
        'app',
        'software',
        '工具',
        '应用',
        '服务'
      ])
    ) {
      return 'tools'
    }

    return undefined
  }

  _matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword))
  }

  _categorizeDomain(domain) {
    if (
      [
        'twitter.com',
        'facebook.com',
        'linkedin.com',
        'instagram.com',
        'weibo.com'
      ].includes(domain)
    ) {
      return 'social'
    }
    if (
      [
        'github.com',
        'stackoverflow.com',
        'developer.mozilla.org',
        'npmjs.com'
      ].includes(domain)
    ) {
      return 'tech'
    }
    if (
      [
        'bbc.com',
        'cnn.com',
        'nytimes.com',
        'reuters.com',
        'xinhuanet.com'
      ].includes(domain)
    ) {
      return 'news'
    }
    return 'other'
  }

  _generateStats(bookmarks) {
    const folderBookmarks = bookmarks.filter(b => b.isFolder)
    const urlBookmarks = bookmarks.filter(b => !b.isFolder)

    const domainCounts = new Map()
    urlBookmarks.forEach(bookmark => {
      if (bookmark.domain) {
        domainCounts.set(
          bookmark.domain,
          (domainCounts.get(bookmark.domain) || 0) + 1
        )
      }
    })

    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: Math.round((count / urlBookmarks.length) * 100 * 100) / 100
      }))

    const creationTimeline = new Map()
    bookmarks.forEach(bookmark => {
      if (bookmark.dateAdded) {
        const date = new Date(bookmark.dateAdded)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        creationTimeline.set(key, (creationTimeline.get(key) || 0) + 1)
      }
    })

    const categoryDistribution = new Map()
    bookmarks.forEach(bookmark => {
      if (bookmark.category) {
        categoryDistribution.set(
          bookmark.category,
          (categoryDistribution.get(bookmark.category) || 0) + 1
        )
      }
    })

    const urlCounts = new Map()
    urlBookmarks.forEach(bookmark => {
      if (bookmark.url) {
        urlCounts.set(bookmark.url, (urlCounts.get(bookmark.url) || 0) + 1)
      }
    })
    const duplicateUrls = Array.from(urlCounts.values()).filter(
      count => count > 1
    ).length

    const emptyFolders = folderBookmarks.filter(
      folder => folder.childrenCount === 0
    ).length
    // 避免 Math.max(...array) 在超大数组上触发参数展开导致的栈溢出
    let maxDepth = 0
    for (let i = 0; i < bookmarks.length; i++) {
      const d = bookmarks[i].depth || 0
      if (d > maxDepth) maxDepth = d
    }

    return {
      totalBookmarks: urlBookmarks.length,
      totalFolders: folderBookmarks.length,
      totalNodes: bookmarks.length,
      maxDepth,
      totalDomains: domainCounts.size,
      topDomains,
      creationTimeline,
      categoryDistribution,
      duplicateUrls,
      emptyFolders,
      brokenLinks: 0,
      memoryUsage: {
        nodeCount: bookmarks.length,
        indexCount: 0,
        // 避免对超大数组 stringify 触发内存峰值，采用粗略估算
        estimatedBytes: Math.round(bookmarks.length * 800)
      },
      lastUpdated: Date.now(),
      version: CURRENT_DATA_VERSION
    }
  }

  _generateDataHash(data) {
    try {
      // 对Chrome书签树进行迭代式遍历并流式更新哈希，避免递归导致栈溢出与超大JSON字符串
      if (!data) {
        return `empty_${Date.now()}`
      }

      // 将输入标准化为数组（Chrome.bookmarks.getTree() 返回数组）
      const roots = Array.isArray(data) ? data : [data]
      if (roots.length === 0) {
        return `empty_${Date.now()}`
      }

      // 双哈希寄存器，减少碰撞风险；使用32位整数滚动混合
      let h1 = 0 | 0
      let h2 = 0 | 0
      let nodeCount = 0

      const updateWithCharCode = code => {
        // 经典DJB2变体 + 另一路乘性混合
        h1 = ((h1 << 5) + h1 + code) | 0 // h1*33 + code
        h2 = (Math.imul(h2 ^ 0x45d9f3b, 2654435761) + code) | 0
      }

      const updateWithString = str => {
        // 避免创建大的中间字符串，这里直接按字符更新
        for (let i = 0; i < str.length; i++) {
          updateWithCharCode(str.charCodeAt(i))
        }
      }

      const updateWithField = (label, value) => {
        updateWithString(label)
        if (value == null) return
        updateWithString(String(value))
        // 字段分隔符
        updateWithCharCode(124) // '|' 分隔
      }

      // 迭代遍历（与 _flattenBookmarks 一致：逆序入栈保持稳定顺序）
      const stack = []
      for (let i = roots.length - 1; i >= 0; i--) stack.push(roots[i])
      const visited = new Set()

      while (stack.length) {
        const node = stack.pop()
        if (!node || typeof node !== 'object') continue
        const nid = node.id
        if (nid && visited.has(nid)) continue
        if (nid) visited.add(nid)

        nodeCount++

        // 使用最小必要字段参与哈希，保证稳定且与旧版语义接近
        updateWithField('i:', node.id)
        updateWithField('t:', node.title)
        updateWithField('u:', node.url)
        updateWithField('p:', node.parentId)
        updateWithField('d:', node.dateAdded)

        const children = Array.isArray(node.children) ? node.children : []
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push(children[i])
        }
      }

      // 合成最终哈希：两路异或，附带节点计数，降低碰撞率
      const mixed = (h1 ^ h2) >>> 0
      return `${Math.abs(mixed).toString(36)}_${nodeCount.toString(36)}`
    } catch (error) {
      logger.error('ServiceWorker', '❌ [预处理器] 生成数据哈希失败:', error)
      return `error_${Date.now()}`
    }
  }
}

// ==================== 书签管理服务 ====================

/**
 * 书签管理服务（核心业务协调者）
 * - 负责装载数据、周期同步与健康检查；
 * - 提供页面与后台交互的统一接口；
 * - 封装与 IndexedDB 的交互与批处理策略。
 */
class BookmarkManagerService {
  constructor() {
    this.dbManager = new ServiceWorkerIndexedDBManager()
    this.preprocessor = new ServiceWorkerBookmarkPreprocessor()
    this.isReady = false
    this.lastSyncTime = 0
    this.lastDataHash = null
    // 引入读写服务以完成类引用，避免未使用告警
    this.readService = new BookmarkReadService(this.dbManager)
    this.writeService = new BookmarkWriteService(this.dbManager)
  }

  async initialize() {
    logger.info('ServiceWorker', '🚀 [书签管理服务] 初始化开始...')

    try {
      // 1. 初始化数据库
      await this.dbManager.initialize()

      // 2. 检查是否需要首次数据加载
      const stats = await this.dbManager.getGlobalStats()
      if (!stats) {
        logger.info(
          'ServiceWorker',
          '📊 [书签管理服务] 首次使用，加载书签数据...'
        )
        await this.loadBookmarkData()
      } else {
        logger.info(
          'ServiceWorker',
          '📊 [书签管理服务] 数据已存在，检查是否需要同步...'
        )
        await this.checkAndSync()
      }

      this.isReady = true
      logger.info('ServiceWorker', '✅ [书签管理服务] 初始化完成')

      // 3. 启动定期同步（使用 alarms）
      this.startPeriodicSync()
    } catch (error) {
      logger.error('ServiceWorker', '❌ [书签管理服务] 初始化失败:', error)
      throw error
    }
  }

  async loadBookmarkData() {
    logger.info('ServiceWorker', '🔄 [书签管理服务] 重新加载书签数据...')

    try {
      // 并发保护：若已有重载在进行，直接复用同一承诺
      if (this._loadingPromise) {
        logger.info(
          'ServiceWorker',
          '⏳ [书签管理服务] 正在重载，等待现有任务完成...'
        )
        return await this._loadingPromise
      }

      this._loadingPromise = (async () => {
        // 1. 预处理书签数据
        const result = await this.preprocessor.processBookmarks()

        // 2. 拉取缓存数据
        const cached = await this.dbManager.getAllBookmarks()

        // 3. 构建映射
        const cachedMap = new Map(cached.map(b => [b.id, b]))
        const chromeMap = new Map(result.bookmarks.map(b => [b.id, b]))

        // 4. 计算差异
        const toInsert = result.bookmarks.filter(b => !cachedMap.has(b.id))
        const toUpdate = result.bookmarks.filter(b => {
          const c = cachedMap.get(b.id)
          if (!c) return false
          // 只在关键字段变化时更新
          return (
            c.title !== b.title ||
            c.url !== b.url ||
            c.parentId !== b.parentId ||
            c.index !== b.index
          )
        })
        const toDelete = cached.filter(b => !chromeMap.has(b.id))

        // 5. 批量执行增量同步
        if (toDelete.length) {
          await this.dbManager.deleteBookmarksBatch(toDelete.map(b => b.id))
        }
        if (toInsert.length) {
          await this.dbManager.insertBookmarks(toInsert)
        }
        if (toUpdate.length) {
          await this.dbManager.updateBookmarksBatch(toUpdate)
        }

        // 6. 更新统计信息
        await this.dbManager.updateGlobalStats(result.stats)

        // 7. 更新状态
        this.lastDataHash = result.metadata.originalDataHash
        this.lastSyncTime = Date.now()

        logger.info(
          'ServiceWorker',
          `✅ [书签管理服务] 增量同步完成: 新增 ${toInsert.length}、更新 ${toUpdate.length}、删除 ${toDelete.length}`
        )

        // 前端快速刷新：广播一次数据库已同步完成
        try {
          chrome.runtime
            .sendMessage({ type: 'BOOKMARKS_DB_SYNCED', timestamp: Date.now() })
            .catch(() => {})
        } catch (e) {
          logger.debug('ServiceWorker', 'BOOKMARKS_DB_SYNCED notify failed', e)
        }
      })()

      return await this._loadingPromise
    } catch (error) {
      logger.error(
        'ServiceWorker',
        '❌ [书签管理服务] 加载书签数据失败:',
        error
      )
      throw error
    } finally {
      // 清理并发保护句柄
      this._loadingPromise = null
    }
  }

  async checkAndSync() {
    try {
      // 简化的同步检查：直接重新加载
      // 在生产环境中，这里可以实现更精细的增量同步
      const chromeTree = await this.preprocessor._getChromeBookmarks()
      const currentHash = this.preprocessor._generateDataHash(chromeTree)

      if (currentHash !== this.lastDataHash) {
        logger.info(
          'ServiceWorker',
          '🔄 [书签管理服务] 检测到Chrome书签变化，开始同步...'
        )
        await this.loadBookmarkData()
        return true
      }

      logger.info('ServiceWorker', '✅ [书签管理服务] 数据已是最新，无需同步')
      return false
    } catch (error) {
      logger.error('ServiceWorker', '❌ [书签管理服务] 同步检查失败:', error)
      return false
    }
  }

  startPeriodicSync() {
    const periodMinutes = Math.max(1, Math.floor(SYNC_INTERVAL / 60000))
    try {
      chrome.alarms.create('AcuityBookmarksPeriodicSync', {
        periodInMinutes: periodMinutes
      })
      logger.info(
        'ServiceWorker',
        `🔄 [书签管理服务] 定期同步已启动（chrome.alarms），间隔: ${periodMinutes} 分钟`
      )
    } catch (error) {
      // 按文档建议：不再回退至 setInterval，避免 SW 休眠问题
      logger.warn(
        'ServiceWorker',
        '⚠️ [书签管理服务] 创建 alarms 失败（不回退 setInterval）:',
        error
      )
    }
  }

  // 健康检查
  async healthCheck() {
    try {
      await this.dbManager._ensureDB()
      const stats = await this.dbManager.getGlobalStats()

      return {
        success: true,
        ready: this.isReady && Boolean(stats),
        initialized: this.dbManager.isInitialized,
        dataVersion: CURRENT_DATA_VERSION,
        lastUpdate: this.lastSyncTime
      }
    } catch (error) {
      return {
        success: false,
        ready: false,
        initialized: false,
        error: error.message
      }
    }
  }

  // API方法代理
  async getAllBookmarks() {
    return this.dbManager.getAllBookmarks()
  }

  async getBookmarkById(id) {
    return this.dbManager.getBookmarkById(id)
  }

  async getChildrenByParentId(parentId) {
    return this.dbManager.getChildrenByParentId(parentId)
  }

  async searchBookmarks(query, options) {
    return this.dbManager.searchBookmarks(query, options)
  }

  async getGlobalStats() {
    return this.dbManager.getGlobalStats()
  }

  async getDatabaseHealth() {
    return this.dbManager.checkDatabaseHealth()
  }

  async getDatabaseStats() {
    return this.dbManager.getDatabaseStats()
  }

  async getSearchHistory(limit) {
    return this.dbManager.getSearchHistory(limit)
  }

  async addSearchHistory(query, results, executionTime, source) {
    return this.dbManager.addSearchHistory(
      query,
      results,
      executionTime,
      source
    )
  }

  async clearSearchHistory() {
    return this.dbManager.clearSearchHistory()
  }

  async getSetting(key) {
    return this.dbManager.getSetting(key)
  }

  async saveSetting(key, value, type, description) {
    return this.dbManager.saveSetting(key, value, type, description)
  }

  async deleteSetting(key) {
    return this.dbManager.deleteSetting(key)
  }

  async forceReload() {
    await this.loadBookmarkData()
  }

  async syncBookmarks() {
    try {
      // 始终强制重载，以确保“立即更新”必然刷新IndexedDB
      const chromeTree = await this.preprocessor._getChromeBookmarks()
      const currentHash = this.preprocessor._generateDataHash(chromeTree)
      const changed = currentHash !== this.lastDataHash
      await this.loadBookmarkData()
      return changed
    } catch (error) {
      logger.error('ServiceWorker', '❌ [书签管理服务] 同步失败:', error)
      return false
    }
  }

  // 健康度概览统计：404/500/4xx/5xx 与重复数量
  async getBookmarkHealthOverview() {
    try {
      const metas = await this.dbManager.getAllCrawlMetadata()
      const totalScanned = Array.isArray(metas) ? metas.length : 0
      let http404 = 0,
        http500 = 0,
        other4xx = 0,
        other5xx = 0
      for (const m of metas || []) {
        const s = Number(m?.httpStatus || 0)
        const g = String(m?.statusGroup || '')
        const st = String(m?.status || '')
        if (s === 404) http404++
        else if (s === 500) http500++
        else if (g === '4xx') other4xx++
        else if (g === '5xx') other5xx++
        // 将未分类但标记为失败/错误的记录也计入异常（归入other4xx）
        else if (g === 'error' || st === 'failed') other4xx++
      }

      const bookmarks = await this.dbManager.getAllBookmarks()
      const urlMap = new Map()
      for (const b of bookmarks || []) {
        if (b?.url) {
          const key = normalizeUrl(b.url)
          urlMap.set(key, (urlMap.get(key) || 0) + 1)
        }
      }
      const duplicateCount = Array.from(urlMap.values()).filter(
        n => n > 1
      ).length

      return {
        totalScanned,
        http404,
        http500,
        other4xx,
        other5xx,
        duplicateCount
      }
    } catch (e) {
      logger.warn('ServiceWorker', '⚠️ [健康度] 概览统计失败:', e)
      return {
        totalScanned: 0,
        http404: 0,
        http500: 0,
        other4xx: 0,
        other5xx: 0,
        duplicateCount: 0
      }
    }
  }
}

// ==================== 读写分离基础类（CQRS） ====================

class BookmarkReadService {
  constructor(dbManager) {
    this.db = dbManager
  }

  getAll() {
    return this.db.getAllBookmarks()
  }

  getById(id) {
    return this.db.getBookmarkById(id)
  }

  search(query, options = {}) {
    return this.db.searchBookmarks(query, options)
  }
}

class BookmarkWriteService {
  constructor(dbManager) {
    this.db = dbManager
    this.queue = []
  }

  queueInsert(records = []) {
    if (records && records.length) this.queue.push({ type: 'insert', records })
  }

  queueUpdate(records = []) {
    if (records && records.length) this.queue.push({ type: 'update', records })
  }

  queueDelete(ids = []) {
    if (ids && ids.length) this.queue.push({ type: 'delete', ids })
  }

  async flush() {
    const ops = this.queue.splice(0)
    for (const op of ops) {
      if (op.type === 'insert') {
        await this.db.insertBookmarks(op.records)
      } else if (op.type === 'update') {
        await this.db.updateBookmarksBatch(op.records)
      } else if (op.type === 'delete') {
        await this.db.deleteBookmarksBatch(op.ids)
      }
    }
  }
}

// ==================== 全局实例 ====================

const bookmarkManager = new BookmarkManagerService()

// ==================== 消息处理中心 ====================

// 语义搜索向量范数缓存，减少重复计算开销
const EMBED_NORM_CACHE = new Map()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, data } = message

  logger.info('ServiceWorker', `📨 [Service Worker] 收到消息: ${type}`, data)

  const handleMessage = async () => {
    try {
      switch (type) {
        case 'ACUITY_NOTIFY_PING': {
          try {
            sendResponse({ ok: true })
            return true
          } catch (e) {
            sendResponse({ ok: false, error: e?.message || String(e) })
            return false
          }
        }
        case 'ACUITY_NOTIFY': {
          try {
            const title = (data && data.title) || 'AcuityBookmarks'
            const messageText = (data && data.message) || ''
            const timeoutMs = Number(data && data.timeoutMs) || 2500
            let iconUrl = (data && data.iconUrl) || ''
            try {
              if (
                !iconUrl ||
                (!/^https?:\/\//.test(iconUrl) &&
                  !iconUrl.startsWith('chrome-extension://'))
              ) {
                const cleaned = String(iconUrl || 'logo.png').replace(/^\//, '')
                iconUrl = chrome.runtime.getURL(cleaned)
              }
            } catch (e) {
              console.warn('[notifications] failed to resolve iconUrl', e)
            }
            chrome.notifications.create(
              {
                type: 'basic',
                title,
                message: messageText,
                iconUrl
              },
              notificationId => {
                try {
                  if (timeoutMs > 0 && notificationId) {
                    setTimeout(() => {
                      try {
                        chrome.notifications.clear(notificationId)
                      } catch (e) {
                        console.warn('[notifications] clear failed', e)
                      }
                    }, timeoutMs)
                  }
                } catch (e) {
                  console.warn('[notifications] setup clear failed', e)
                }
                sendResponse({ ok: true, notificationId: notificationId || '' })
              }
            )
            return true // async response
          } catch (e) {
            console.warn('[notifications] create failed', e)
            sendResponse({ ok: false, error: e?.message || String(e) })
            return false
          }
        }
        case 'ACUITY_NOTIFY_CLEAR': {
          try {
            const id = data && data.notificationId
            if (id) {
              chrome.notifications.clear(id, () => sendResponse({ ok: true }))
              return true
            }
            sendResponse({ ok: false, error: 'missing id' })
            return false
          } catch (e) {
            sendResponse({ ok: false, error: e?.message || String(e) })
            return false
          }
        }
        case 'HEALTH_CHECK':
          return await bookmarkManager.healthCheck()

        // --- 新的按需加载接口 ---
        case 'get-tree-root':
          try {
            const rootNodes =
              await bookmarkManager.dbManager.getChildrenByParentId('0')
            sendResponse({ ok: true, value: rootNodes })
          } catch (error) {
            sendResponse({ ok: false, error: error.message })
          }
          break

        case 'get-children':
          try {
            const { parentId } = data
            if (!parentId) throw new Error('parentId is required')
            const children =
              await bookmarkManager.dbManager.getChildrenByParentId(parentId)
            sendResponse({ ok: true, value: children })
          } catch (error) {
            sendResponse({ ok: false, error: error.message })
          }
          break

        // --- 已废弃的全量加载接口 ---
        case 'get-all-bookmarks':
          logger.warn(
            'ServiceWorker',
            '⚠️ [DEPRECATED] "get-all-bookmarks" is deprecated and should not be used in production.'
          )
          // 返回空数组以避免旧代码出错，同时促使开发者迁移到新接口
          sendResponse({ ok: true, value: [] })
          break

        case 'search-bookmarks':
          try {
            const { query, options } = data
            const results = await bookmarkManager.searchBookmarks(
              query,
              options
            )
            sendResponse({ ok: true, value: results })
          } catch (error) {
            sendResponse({ ok: false, error: error.message })
          }
          break

        case 'get-global-stats':
        case 'GET_GLOBAL_STATS':
        case 'GET_BOOKMARK_STATS': {
          const stats = await bookmarkManager.getGlobalStats()
          return { success: true, data: stats }
        }

        case 'sync-bookmarks': {
          const changed = await bookmarkManager.syncBookmarks()
          return { success: true, data: { changed } }
        }

        case 'FORCE_RELOAD_DATA':
          await bookmarkManager.forceReload()
          return { success: true }

        case 'GET_DATABASE_HEALTH': {
          const health = await bookmarkManager.getDatabaseHealth()
          return { success: true, data: health }
        }

        case 'TOGGLE_SIDEPANEL':
          // 🎯 已移除：Popup现在直接调用Chrome API以保持用户手势
          logger.warn(
            'ServiceWorker',
            '⚠️ TOGGLE_SIDEPANEL消息已弃用，Popup应直接调用Chrome API'
          )
          return { success: false, error: 'TOGGLE_SIDEPANEL已弃用' }

        case 'GET_DATABASE_STATS': {
          const dbStats = await bookmarkManager.getDatabaseStats()
          return { success: true, data: dbStats }
        }

        case 'GET_BOOKMARK_HEALTH': {
          const healthOverview =
            await bookmarkManager.getBookmarkHealthOverview()
          return { success: true, data: healthOverview }
        }

        case 'GET_SEARCH_HISTORY': {
          const history = await bookmarkManager.getSearchHistory(data.limit)
          return { success: true, data: history }
        }

        case 'SIDE_PANEL_STATE_CHANGED':
          // 前端（popup/side-panel）同步状态广播，后台仅记录与更新跟踪状态，避免报“未知消息类型”
          try {
            const wantOpen = Boolean(message?.isOpen ?? data?.isOpen)
            // 轻量更新跟踪状态（不强制查询tab/window，避免无权限场景报错）
            sidePanelOpenState.isOpen = wantOpen
            // 其他字段保持不变，避免覆盖真实窗口跟踪
            logger.info(
              'ServiceWorker',
              `📊 [Service Worker] 侧边栏状态同步: ${wantOpen ? 'open' : 'closed'}`
            )
            return { success: true }
          } catch (e) {
            logger.warn(
              'ServiceWorker',
              '⚠️ [Service Worker] 同步侧边栏状态失败:',
              e
            )
            return { success: false, error: e?.message || String(e) }
          }

        case 'ADD_SEARCH_HISTORY':
          await bookmarkManager.addSearchHistory(
            data.query,
            data.resultCount,
            data.executionTime,
            data.source
          )
          return { success: true }

        case 'CLEAR_SEARCH_HISTORY':
          await bookmarkManager.clearSearchHistory()
          return { success: true }

        case 'GET_SETTING': {
          const setting = await bookmarkManager.getSetting(data.key)
          return { success: true, data: setting }
        }

        case 'SAVE_SETTING':
          await bookmarkManager.saveSetting(
            data.key,
            data.value,
            undefined,
            data.description
          )
          return { success: true }

        case 'DELETE_SETTING':
          await bookmarkManager.deleteSetting(data.key)
          return { success: true }

        case 'OPEN_MANAGEMENT_PAGE': {
          // 打开管理页面
          const managementUrl = chrome.runtime.getURL('management.html')
          await chrome.tabs.create({ url: managementUrl })
          return { success: true }
        }

        case 'OPEN_SETTINGS_PAGE':
          try {
            const settingsUrl = chrome.runtime.getURL('settings.html')
            await chrome.tabs.create({ url: settingsUrl })
            return { success: true }
          } catch (e) {
            return { success: false, error: e?.message || String(e) }
          }

        case 'SHOW_MANAGEMENT_PAGE_AND_ORGANIZE':
          // 已移除：AI整理入口
          return { success: false, error: 'AI organize is removed' }

        case 'PREPARE_MANAGEMENT_DATA': {
          // 准备管理页面数据（确保IndexedDB已初始化）
          const healthStatus = await bookmarkManager.healthCheck()
          return healthStatus
        }

        case 'BATCH_GENERATE_TAGS': {
          // 批量为所有书签生成标签；data.force 为 true 时覆盖已有标签
          const res = await batchGenerateTagsForAllBookmarks({
            force: Boolean(data?.force)
          })
          return res
        }

        case 'GENERATE_EMBEDDINGS': {
          // 批量为所有书签生成嵌入；data.force 为 true 时覆盖已有嵌入
          const er = await batchGenerateEmbeddingsForAllBookmarks({
            force: Boolean(data?.force)
          })
          return er
        }

        case 'GET_EMBEDDING_COVERAGE': {
          try {
            const all = await bookmarkManager.dbManager.getAllBookmarks()
            const urlBookmarks = (all || []).filter(b => !b.isFolder && b.url)
            const allEmbeds = await bookmarkManager.dbManager.getAllEmbeddings()
            const embedSet = new Set(
              (allEmbeds || []).map(e => String(e.bookmarkId))
            )
            let withEmb = 0
            for (const b of urlBookmarks) {
              if (embedSet.has(String(b.id))) withEmb++
            }
            const total = urlBookmarks.length
            const missing = Math.max(0, total - withEmb)
            return {
              success: true,
              data: { total, withEmbeddings: withEmb, missing }
            }
          } catch (e) {
            return { success: false, error: e?.message || String(e) }
          }
        }

        case 'SEARCH_SEMANTIC': {
          // 语义搜索：对查询生成嵌入，与已存嵌入计算余弦相似度（支持阈值与范数缓存）
          try {
            const query = String(data?.query || '')
            const topK = Number(data?.topK || 50)
            const minSim = Number(data?.minSim ?? 0.2)
            if (!query.trim()) return { success: true, data: [] }

            const qVec = await cloudflareGenerateEmbedding(query)
            if (!Array.isArray(qVec) || qVec.length === 0) {
              throw new Error('查询嵌入生成失败')
            }

            const allEmbeds = await bookmarkManager.dbManager.getAllEmbeddings()
            const qNorm = Math.sqrt(qVec.reduce((s, v) => s + v * v, 0)) || 1

            const scored = []
            for (const rec of allEmbeds) {
              const v = Array.isArray(rec.vector) ? rec.vector : []
              if (!v.length) continue
              const len = Math.min(v.length, qVec.length)
              let dot = 0
              for (let i = 0; i < len; i++) dot += (v[i] || 0) * (qVec[i] || 0)
              // 使用缓存的范数，避免重复计算
              let vNorm = EMBED_NORM_CACHE.get(rec.bookmarkId)
              if (!vNorm) {
                vNorm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
                EMBED_NORM_CACHE.set(rec.bookmarkId, vNorm)
              }
              const sim = dot / (qNorm * vNorm)
              if (sim >= minSim) {
                scored.push({
                  id: rec.bookmarkId,
                  title: rec.title,
                  url: rec.url,
                  domain: rec.domain,
                  score: sim
                })
              }
            }
            scored.sort((a, b) => b.score - a.score)
            const top = scored.slice(0, Math.max(1, topK))
            return { success: true, data: top }
          } catch (e) {
            return { success: false, error: e?.message || String(e) }
          }
        }

        case 'VECTORIZE_SYNC': {
          // 将本地IndexedDB中的嵌入向量批量同步到 Cloudflare Vectorize
          try {
            const batchSize = Number(data?.batchSize || 300)
            const timeout = Number(data?.timeout || 20000)
            const force = Boolean(data?.force)
            const res = await vectorizeUpsertAllEmbeddings({
              batchSize,
              timeout,
              force
            })
            if (res.success) {
              try {
                await bookmarkManager.saveSetting(
                  'vectorize.lastManualAt',
                  Date.now(),
                  'number',
                  '最后一次手动Vectorize时间'
                )
                await bookmarkManager.saveSetting(
                  'vectorize.lastManualStats',
                  res,
                  'json',
                  '上次手动Vectorize统计'
                )
              } catch {
                // 忽略设置保存错误
              }
              return {
                success: true,
                data: {
                  upserted: res.upserted,
                  batches: res.batches,
                  attempted: res.attempted,
                  dimension: res.dimension
                }
              }
            }
            return { success: false, error: res.error || 'Vectorize 同步失败' }
          } catch (e) {
            return { success: false, error: e?.message || String(e) }
          }
        }

        case 'VECTORIZE_QUERY': {
          // 代理 Cloudflare Vectorize 查询，返回匹配结果基本信息
          try {
            const query = String(data?.query || '')
            const topK = Number(data?.topK || 10)
            const returnMetadata = data?.returnMetadata || 'indexed'
            const returnValues = Boolean(data?.returnValues)

            for (const base of AI_BASE_CANDIDATES) {
              try {
                const resp = await fetchJsonWithTimeout(
                  `${base}/api/vectorize/query`,
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      text: query,
                      topK,
                      returnMetadata,
                      returnValues
                    })
                  },
                  Number(data?.timeout || 15000)
                )
                if (resp && resp.success && Array.isArray(resp.matches)) {
                  const mapped = resp.matches.map(m => {
                    const meta = m?.metadata || {}
                    return {
                      id: String(m?.id || meta.bookmarkId || ''),
                      title: meta.title || '',
                      url: meta.url || '',
                      domain: meta.domain || '',
                      score: Number(m?.score ?? m?.similarity ?? 0)
                    }
                  })
                  return { success: true, data: mapped }
                }
              } catch {
                // 继续尝试下一个base
              }
            }
            throw new Error('Vectorize query failed')
          } catch (e) {
            return { success: false, error: e?.message || String(e) }
          }
        }

        default:
          throw new Error(`未知消息类型: ${type}`)
      }
    } catch (error) {
      logger.error(
        'ServiceWorker',
        `❌ [Service Worker] 处理消息失败 ${type}:`,
        error
      )
      return { success: false, error: error.message }
    }
  }

  // 异步处理消息
  handleMessage()
    .then(response => {
      logger.info(
        'ServiceWorker',
        `📤 [Service Worker] 响应消息 ${type}:`,
        response
      )
      sendResponse(response)
    })
    .catch(error => {
      logger.error(
        'ServiceWorker',
        `❌ [Service Worker] 消息处理异常 ${type}:`,
        error
      )
      sendResponse({ success: false, error: error.message })
    })

  // 返回true表示异步响应
  return true
})

// ==================== Service Worker生命周期 ====================

// Service Worker安装事件

// ========== 字体预取与缓存 ========== //
const FONT_PRELOAD_LIST = [
  // 仅预取常用字体，可根据需要扩展
  {
    lang: 'zh-Hans',
    family: 'NotoSansSC',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100..900&display=swap'
  },
  {
    lang: 'zh-Hant',
    family: 'NotoSansTC',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100..900&display=swap'
  },
  {
    lang: 'ja',
    family: 'NotoSansJP',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap'
  },
  {
    lang: 'ko',
    family: 'NotoSansKR',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap'
  },
  {
    lang: 'ar',
    family: 'NotoSansArabic',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@100..900&display=swap'
  },
  {
    lang: 'default',
    family: 'NotoSans',
    cssUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..900&display=swap'
  }
]

const FONT_DB_NAME = 'acuity-font-cache-v1'
const FONT_STORE_NAME = 'fonts'
const FONT_CACHE_VERSION = 'v1'

function openFontDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FONT_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FONT_STORE_NAME)) {
        db.createObjectStore(FONT_STORE_NAME)
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })
}

async function setFontCache(key, buf) {
  try {
    const db = await openFontDB()
    const payload = { buf, version: FONT_CACHE_VERSION, ts: Date.now() }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FONT_STORE_NAME, 'readwrite')
      const store = tx.objectStore(FONT_STORE_NAME)
      const req = store.put(payload, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    logger.warn('ServiceWorker', '[FontPreload] IndexedDB put error', e)
  }
}

async function extractWoff2UrlFromCss(cssText) {
  const m = cssText.match(/url\((https?:[^)]+\.woff2)\)/i)
  return m ? m[1] : null
}

async function fetchFontAndCache({ lang, family, cssUrl }) {
  const cacheKey = `${family}:${lang}`
  try {
    logger.info(
      'ServiceWorker',
      `[FontPreload] 预取 ${family} (${lang}) CSS:`,
      cssUrl
    )
    const cssResp = await fetch(cssUrl, { cache: 'force-cache' })
    if (!cssResp.ok) throw new Error(`fetch css failed: ${cssResp.status}`)
    const cssText = await cssResp.text()
    const woff2Url = await extractWoff2UrlFromCss(cssText)
    if (!woff2Url) throw new Error('no woff2 url in css')
    logger.info('ServiceWorker', `[FontPreload] 预取 woff2:`, woff2Url)
    const fontResp = await fetch(woff2Url, {
      cache: 'force-cache',
      mode: 'cors'
    })
    if (!fontResp.ok) throw new Error(`fetch woff2 failed: ${fontResp.status}`)
    const buf = await fontResp.arrayBuffer()
    await setFontCache(cacheKey, buf)
    logger.info('ServiceWorker', `[FontPreload] 缓存成功:`, cacheKey)
  } catch (e) {
    logger.warn(
      'ServiceWorker',
      `[FontPreload] 预取失败: ${family} (${lang})`,
      e && e.message ? e.message : e
    )
  }
}

self.addEventListener('install', event => {
  logger.info('ServiceWorker', '🚀 [Service Worker] 安装中...')
  event.waitUntil(
    (async () => {
      for (const font of FONT_PRELOAD_LIST) {
        await fetchFontAndCache(font)
      }
    })()
  )
  self.skipWaiting()
})

// Service Worker激活事件
self.addEventListener('activate', event => {
  logger.info('ServiceWorker', '🚀 [Service Worker] 激活中...')
  event.waitUntil(clients.claim())
})

// ==================== 实时书签同步 ====================

/**
 * 批量为所有书签生成标签并写入IndexedDB
 * - 默认仅为无标签的书签生成；传入 force=true 则覆盖更新
 * - 顺序处理以降低AI请求压力
 */
async function batchGenerateTagsForAllBookmarks({ force = false } = {}) {
  try {
    logger.info('ServiceWorker', '🚀 [批量标签] 开始为所有书签生成标签...', {
      force
    })
    const all = await bookmarkManager.dbManager.getAllBookmarks()
    let processed = 0,
      updated = 0

    for (const b of all) {
      // 仅处理有URL的书签
      if (!b || !b.url) continue

      const hasTags = Array.isArray(b.tags) && b.tags.length > 0
      if (!force && hasTags) {
        processed++
        continue
      }

      try {
        const tags = await generateTagsSmart(b.title || '', b.url || '')
        if (tags && tags.length > 0) {
          await bookmarkManager.dbManager.updateBookmark(b.id, { tags })
          updated++
        }
      } catch (err) {
        logger.warn(
          'ServiceWorker',
          '⚠️ [批量标签] 单项生成失败:',
          b?.id,
          err?.message || err
        )
      }

      processed++
      // 适度让出事件循环，避免阻塞
      if (processed % 25 === 0) await new Promise(r => setTimeout(r, 10))
    }

    // 刷新缓存并通知前端
    await invalidateBookmarkCache()
    notifyFrontendBookmarkUpdate('batch-tags-generated', 'all', { force })

    // 通知前端：数据库已完成同步
    try {
      chrome.runtime
        .sendMessage({ type: 'BOOKMARKS_DB_SYNCED', timestamp: Date.now() })
        .catch(() => {})
    } catch (e) {
      logger.debug('ServiceWorker', 'BOOKMARKS_DB_SYNCED notify failed', e)
    }

    logger.info(
      'ServiceWorker',
      `✅ [批量标签] 完成。处理: ${processed}, 更新: ${updated}`
    )
    return { success: true, processed, updated }
  } catch (error) {
    logger.error('ServiceWorker', '❌ [批量标签] 执行失败:', error)
    return { success: false, error: error?.message || String(error) }
  }
}

// 批量生成并存储所有书签的嵌入向量（用于手动触发与自动任务调用）
async function batchGenerateEmbeddingsForAllBookmarks({
  force = false,
  maxCount = Infinity
} = {}) {
  try {
    // 使用统一的 bookmarkManager.dbManager，修复未定义变量
    await bookmarkManager.dbManager.initialize()
    const bookmarks = await bookmarkManager.dbManager.getAllBookmarks()

    // 读取现有嵌入，构建已存在集合以避免重复计算
    const existing = await bookmarkManager.dbManager.getAllEmbeddings()
    const hasEmbed = new Set(
      Array.isArray(existing) ? existing.map(r => String(r.bookmarkId)) : []
    )

    // 目标：非文件夹，且（强制或尚无嵌入）
    const rawTargets = bookmarks.filter(
      b => !b.isFolder && (force || !hasEmbed.has(String(b.id)))
    )
    const targets = Number.isFinite(maxCount)
      ? rawTargets.slice(0, Math.max(0, maxCount))
      : rawTargets

    let processed = 0
    const start = Date.now()

    for (const bk of targets) {
      const text = `${bk.title || ''} ${bk.url || ''}`.trim()
      if (!text) continue

      const vector = await cloudflareGenerateEmbedding(text)
      if (!Array.isArray(vector) || vector.length === 0) continue

      const record = {
        bookmarkId: bk.id,
        url: bk.url,
        domain: bk.domain,
        title: bk.title,
        model: '@cf/baai/bge-m3',
        vector,
        dimension: vector.length,
        updatedAt: Date.now(),
        // 生成新嵌入后，清除 Vectorize 同步标记，等待后续同步
        vectorizeSyncedAt: null
      }
      await bookmarkManager.dbManager.saveEmbedding(record)
      processed++

      // 适度让出事件循环，避免长时间阻塞 SW
      if (processed % 25 === 0) {
        await new Promise(r => setTimeout(r, 10))
      }
    }

    const duration = Date.now() - start
    return { success: true, processed, total: targets.length, duration }
  } catch (error) {
    logger.error('ServiceWorker', '❌ [AI] 批量生成嵌入失败:', error)
    return { success: false, error: error?.message || String(error) }
  }
}

// ============= 嵌入自动生成（后台任务） ============= //
async function maybeRunAutoEmbeddingJob({
  dailyQuota: _dq = 300,
  perRunMax: _pm = 150
} = {}) {
  try {
    // 读取设置：是否开启自动生成、最后运行时间
    const enabled = await bookmarkManager.getSetting(
      'embedding.autoGenerateEnabled'
    )
    if (
      enabled === false ||
      (typeof enabled === 'object' && enabled?.value === false)
    ) {
      logger.info('ServiceWorker', '🧠 [嵌入自动] 已禁用，跳过')
      return { skipped: true, reason: 'disabled' }
    }

    // 默认为开启（若从未写入设置）
    if (enabled === null || typeof enabled === 'undefined') {
      try {
        await bookmarkManager.saveSetting(
          'embedding.autoGenerateEnabled',
          true,
          'boolean',
          '是否自动生成嵌入'
        )
      } catch {
        // 忽略写入错误
      }
    }

    const lastRunAt = await bookmarkManager.getSetting('embedding.lastAutoAt')
    const now = Date.now()
    const ONE_DAY = 24 * 60 * 60 * 1000
    if (typeof lastRunAt === 'number' && now - lastRunAt < ONE_DAY) {
      logger.info('ServiceWorker', '🧠 [嵌入自动] 24小时内已运行过，跳过')
      return { skipped: true, reason: 'recently-run' }
    }

    // 计算本日剩余额度（简单起见：若无记录则使用默认 dailyQuota）
    // 读取执行参数
    let dailyQuota = Number(
      await bookmarkManager.getSetting('embedding.auto.dailyQuota')
    )
    if (!Number.isFinite(dailyQuota) || dailyQuota <= 0) dailyQuota = _dq
    let perRunMax = Number(
      await bookmarkManager.getSetting('embedding.auto.perRunMax')
    )
    if (!Number.isFinite(perRunMax) || perRunMax <= 0) perRunMax = _pm
    const nightOrIdleOnly = await bookmarkManager.getSetting(
      'embedding.auto.nightOrIdleOnly'
    )

    // 夜间/空闲模式：如果开启，则仅在本地夜间（22:00-7:00）或浏览器 idle 时运行
    if (
      nightOrIdleOnly === true ||
      (typeof nightOrIdleOnly === 'object' && nightOrIdleOnly?.value === true)
    ) {
      try {
        const hour = new Date().getHours()
        const isNight = hour >= 22 || hour < 7
        let isIdle = false
        if (chrome?.idle?.queryState) {
          await new Promise(resolve => {
            try {
              chrome.idle.queryState(60, state => {
                isIdle = state === 'idle' || state === 'locked'
                resolve()
              })
            } catch {
              resolve()
            }
          })
        }
        if (!isNight && !isIdle) {
          logger.info(
            'ServiceWorker',
            '🧠 [嵌入自动] 已开启夜间/空闲限制，当前不满足，跳过'
          )
          return { skipped: true, reason: 'not-night-or-idle' }
        }
      } catch {
        // 出错则忽略限制，继续执行
      }
    }

    const todayKey = `embedding.daily.used.${new Date().toISOString().slice(0, 10)}`
    const usedToday = Number((await bookmarkManager.getSetting(todayKey)) || 0)
    if (usedToday >= dailyQuota) {
      logger.info('ServiceWorker', '🧠 [嵌入自动] 今日配额已用尽，跳过')
      return { skipped: true, reason: 'quota-exhausted' }
    }
    const remaining = Math.max(0, dailyQuota - usedToday)
    const maxThisRun = Math.min(perRunMax, remaining)
    if (maxThisRun <= 0) {
      logger.info('ServiceWorker', '🧠 [嵌入自动] 本次可用额度为0，跳过')
      return { skipped: true, reason: 'no-remaining' }
    }

    logger.info('ServiceWorker', '🧠 [嵌入自动] 开始执行', {
      maxThisRun,
      usedToday,
      dailyQuota
    })
    const res = await batchGenerateEmbeddingsForAllBookmarks({
      force: false,
      maxCount: maxThisRun
    })
    if (res && res.success) {
      try {
        await bookmarkManager.saveSetting(
          'embedding.lastAutoAt',
          now,
          'number',
          '最后一次自动嵌入时间'
        )
        await bookmarkManager.saveSetting(
          'embedding.lastAutoStats',
          {
            processed: res.processed,
            total: res.total,
            duration: res.duration
          },
          'json',
          '上次自动生成统计'
        )
        await bookmarkManager.saveSetting(
          todayKey,
          usedToday + (res.processed || 0),
          'number',
          '当日已用嵌入生成次数'
        )
      } catch {
        // 忽略写入错误
      }
      // 可选：自动进行 Vectorize 同步
      try {
        const autoSync = await bookmarkManager.getSetting(
          'vectorize.autoSyncEnabled'
        )
        if (
          autoSync === true ||
          (typeof autoSync === 'object' && autoSync?.value === true)
        ) {
          const syncRes = await vectorizeUpsertAllEmbeddings({
            batchSize: 300,
            timeout: 20000
          })
          await bookmarkManager.saveSetting(
            'vectorize.lastAutoAt',
            Date.now(),
            'number',
            '最后一次自动Vectorize时间'
          )
          await bookmarkManager.saveSetting(
            'vectorize.lastAutoStats',
            syncRes,
            'json',
            '上次自动Vectorize统计'
          )
        }
      } catch (e) {
        logger.warn(
          'ServiceWorker',
          '⚠️ [嵌入自动] Vectorize 自动同步失败',
          e?.message || e
        )
      }
      logger.info('ServiceWorker', '✅ [嵌入自动] 完成', res)
      return { ...res, skipped: false }
    } else {
      logger.warn('ServiceWorker', '⚠️ [嵌入自动] 执行失败', res?.error)
      return { skipped: false, error: res?.error || 'unknown' }
    }
  } catch (e) {
    logger.warn('ServiceWorker', '⚠️ [嵌入自动] 任务异常', e?.message || e)
    return { skipped: false, error: e?.message || String(e) }
  }
}

// 向 Cloudflare Vectorize 批量上载全部本地嵌入
async function vectorizeUpsertAllEmbeddings({
  batchSize = 300,
  timeout = 20000,
  force = false
} = {}) {
  try {
    const allEmbeds = await bookmarkManager.dbManager.getAllEmbeddings()
    // 选择范围：未同步记录，或在 force=true 时包含所有已有向量记录
    const valid = (allEmbeds || []).filter(
      r => Array.isArray(r?.vector) && r.vector.length > 0
    )
    const selected = force ? valid : valid.filter(r => !r.vectorizeSyncedAt)
    const vectors = selected
      .map(rec => ({
        id: String(rec.bookmarkId || rec.id || rec.url),
        values: Array.isArray(rec.vector) ? rec.vector : [],
        metadata: {
          bookmarkId: rec.bookmarkId,
          url: rec.url,
          domain: rec.domain,
          title: rec.title,
          model: rec.model,
          dimension: rec.dimension,
          updatedAt: rec.updatedAt
        }
      }))
      .filter(v => Array.isArray(v.values) && v.values.length > 0)

    if (!vectors.length)
      return {
        success: true,
        upserted: 0,
        batches: 0,
        attempted: 0,
        dimension: 0
      }

    const attempted = vectors.length
    const dimension = Array.isArray(vectors[0]?.values)
      ? vectors[0].values.length
      : 0

    const chunks = []
    for (let i = 0; i < vectors.length; i += batchSize) {
      chunks.push(vectors.slice(i, i + batchSize))
    }

    let upserted = 0
    let lastError = null
    for (const chunk of chunks) {
      let ok = false
      for (const base of AI_BASE_CANDIDATES) {
        try {
          const resp = await fetchJsonWithTimeout(
            `${base}/api/vectorize/upsert`,
            {
              method: 'POST',
              body: JSON.stringify({ vectors: chunk })
            },
            timeout
          )
          if (resp && resp.success) {
            const affected = Array.isArray(resp?.mutation?.ids)
              ? resp.mutation.ids.length
              : typeof resp.attempted === 'number' && resp.attempted > 0
                ? resp.attempted
                : Array.isArray(resp?.mutation)
                  ? resp.mutation.length
                  : chunk.length
            upserted += affected
            logger.info('ServiceWorker', '[Vectorize] upsert 批次成功', {
              base,
              affected,
              attempted: resp.attempted || chunk.length
            })
            ok = true
            break
          }
        } catch (err) {
          lastError = err
          // 尝试下一个base
        }
      }
      if (!ok) {
        throw new Error(lastError?.message || 'Vectorize upsert failed')
      }
    }
    // 标记这些记录已同步（粗略：将刚才选择的 selected 全部打标；如有失败已在上方抛错）
    try {
      const now = Date.now()
      const db = bookmarkManager.dbManager._ensureDB
        ? bookmarkManager.dbManager._ensureDB()
        : null
      if (db) {
        const tx = db.transaction(['embeddings'], 'readwrite')
        const store = tx.objectStore('embeddings')
        for (const rec of selected) {
          try {
            const updated = { ...rec, vectorizeSyncedAt: now }
            store.put(updated)
          } catch {
            // 忽略单项失败
          }
        }
      } else {
        // 回退：逐条通过已有API覆盖
        for (const rec of selected) {
          try {
            await bookmarkManager.dbManager.saveEmbedding({
              ...rec,
              vectorizeSyncedAt: now
            })
          } catch {
            // 忽略单项失败
          }
        }
      }
    } catch (e) {
      logger.warn(
        'ServiceWorker',
        '[Vectorize] 标记同步状态失败（忽略）',
        e?.message || e
      )
    }
    return {
      success: true,
      upserted,
      batches: chunks.length,
      attempted,
      dimension
    }
  } catch (e) {
    return { success: false, error: e?.message || String(e) }
  }
}

/**
 * 失效书签缓存
 */
async function invalidateBookmarkCache() {
  try {
    logger.info(
      'ServiceWorker',
      '🔄 [书签同步] 开始刷新书签数据（重建并写入IndexedDB）...'
    )

    // 统一走完整加载流程：预处理 → 清空 → 批量写入 → 更新统计
    await bookmarkManager.loadBookmarkData()

    logger.info(
      'ServiceWorker',
      '✅ [书签同步] 书签数据刷新完成（IndexedDB已更新）'
    )

    // 追加：广播一次“数据库已同步完成”的轻量通知，便于前端走快速刷新路径
    try {
      chrome.runtime
        .sendMessage({ type: 'BOOKMARKS_DB_SYNCED', timestamp: Date.now() })
        .catch(() => {})
    } catch (e) {
      logger.debug('ServiceWorker', 'BOOKMARKS_DB_SYNCED notify failed', e)
    }
  } catch (error) {
    logger.error('ServiceWorker', '❌ [书签同步] 刷新书签数据失败:', error)
    throw error
  }
}

// ==================== 健康扫描队列与辅助工具 ====================
const DOMAIN_LAST_REQ = new Map()
const ROBOTS_CACHE = new Map()
const MIN_DOMAIN_INTERVAL_MS = 1500

function normalizeUrl(raw = '') {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/$/, '') || '/'
    return `${u.protocol}//${host}${path}`
  } catch {
    return String(raw || '').trim()
  }
}

function getDomainFromUrl(raw = '') {
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function waitForDomainSlot(domain) {
  const last = DOMAIN_LAST_REQ.get(domain) || 0
  const now = Date.now()
  const diff = now - last
  if (diff < MIN_DOMAIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_DOMAIN_INTERVAL_MS - diff))
  }
  DOMAIN_LAST_REQ.set(domain, Date.now())
}

async function robotsAllowed(url) {
  const domain = getDomainFromUrl(url)
  const cached = ROBOTS_CACHE.get(domain)
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
    return cached.allowedAll
  }
  try {
    const robotsUrl = `https://${domain}/robots.txt`
    const resp = await fetch(robotsUrl, { method: 'GET' })
    let allowedAll = true
    if (resp.ok) {
      const txt = await resp.text()
      // 极简解析：如存在 "User-agent: *" 且 "Disallow: /" 则拒绝
      if (/User-agent:\s*\*/i.test(txt) && /Disallow:\s*\//i.test(txt)) {
        allowedAll = false
      }
    }
    ROBOTS_CACHE.set(domain, { allowedAll, fetchedAt: Date.now() })
    return allowedAll
  } catch {
    // 获取robots失败则默认允许（与多数站点兼容）
    ROBOTS_CACHE.set(domain, { allowedAll: true, fetchedAt: Date.now() })
    return true
  }
}

// ==================== Offscreen Documents 支持 ====================
/**
 * createOffscreenDocument
 * 在需要进行 DOM 解析前确保已创建离屏文档。
 *
 * 设计要点：
 * - 优先尝试 `chrome.offscreen.hasDocument()`，若不可用则忽略异常；
 * - 使用理由 `DOM_SCRAPING`，与 Manifest V3 的安全模型一致；
 * - 失败不抛出致命错误，仅记录日志，调用方可选择正则解析回退。
 */
async function createOffscreenDocument() {
  try {
    // 若已存在，则直接返回
    if (chrome.offscreen && (await chrome.offscreen.hasDocument())) return
  } catch {
    // hasDocument 在部分版本不可用，忽略错误
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Parse bookmark metadata from HTML'
    })
    logger.info('ServiceWorker', '🧩 [Offscreen] 文档已创建')
  } catch (err) {
    logger.warn(
      'ServiceWorker',
      '⚠️ [Offscreen] 创建文档失败:',
      err?.message || err
    )
  }
}

async function extractMetaInOffscreen(html = '') {
  /**
   * 使用离屏文档解析 HTML 元数据。
   * - 通过 runtime 消息与 offscreen 页面通信；
   * - 任何异常均回退到 `extractMetaFromHtml` 的轻量正则解析；
   * - 设计目标：避免在 Service Worker 中直接操作 DOM。
   */
  try {
    await createOffscreenDocument()
    return await new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ type: 'PARSE_HTML', html }, response => {
          resolve(response || {})
        })
      } catch {
        resolve({})
      }
    })
  } catch (err) {
    logger.warn('ServiceWorker', '⚠️ [Offscreen] 解析失败，回退正则解析', err)
    return extractMetaFromHtml(html)
  }
}

function extractMetaFromHtml(html = '') {
  // 轻量级正则解析：在 Offscreen 不可用或失败时作为降级方案
  const pick = re => {
    const m = html.match(re)
    return m ? m[1].trim() : undefined
  }
  const title = pick(/<title[^>]*>([^<]*)<\/title>/i)
  const description = pick(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogTitle = pick(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogDescription = pick(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogImage = pick(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  const ogSiteName = pick(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )
  return { title, description, ogTitle, ogDescription, ogImage, ogSiteName }
}

async function fetchPageAndExtractOnce(url) {
  const domain = getDomainFromUrl(url)
  await waitForDomainSlot(domain)
  const robotsOk = await robotsAllowed(url)
  const started = Date.now()
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'AcuityBookmarks-Extension/1.0' }
    })
    const { status } = resp
    const finalUrl = resp.url || url
    let text = ''
    const ct = resp.headers.get('content-type') || ''
    if (/text\/html|application\/xhtml\+xml/i.test(ct)) {
      text = await resp.text()
    }
    // 优先使用 Offscreen 解析，失败则回退到轻量正则解析
    const meta = await extractMetaInOffscreen(text).catch(() =>
      extractMetaFromHtml(text)
    )
    const statusGroup =
      status >= 500
        ? '5xx'
        : status >= 400
          ? '4xx'
          : status >= 300
            ? '3xx'
            : status >= 200
              ? '2xx'
              : 'error'

    return {
      finalUrl,
      httpStatus: status,
      statusGroup,
      robotsAllowed: robotsOk,
      meta,
      crawlDuration: Date.now() - started
    }
  } catch {
    return {
      finalUrl: url,
      httpStatus: 0,
      statusGroup: 'error',
      robotsAllowed: robotsOk,
      meta: {},
      errorClass: 'network',
      crawlDuration: Date.now() - started
    }
  }
}

async function enqueueHealthScanForBookmark(bookmark) {
  if (!bookmark || !bookmark.url) return
  const domain = getDomainFromUrl(bookmark.url)
  const result = await fetchPageAndExtractOnce(bookmark.url)
  const record = {
    bookmarkId: bookmark.id,
    url: bookmark.url,
    finalUrl: result.finalUrl,
    domain,
    pageTitle: result.meta?.title || bookmark.title,
    description: result.meta?.description,
    ogTitle: result.meta?.ogTitle,
    ogDescription: result.meta?.ogDescription,
    ogImage: result.meta?.ogImage,
    ogSiteName: result.meta?.ogSiteName,
    source: result.source || 'crawler',
    status: result.statusGroup === '2xx' ? 'success' : 'failed',
    httpStatus: result.httpStatus,
    statusGroup: result.statusGroup,
    robotsAllowed: result.robotsAllowed,
    crawlSuccess: result.statusGroup === '2xx',
    crawlCount: 1,
    lastCrawled: Date.now(),
    crawlDuration: result.crawlDuration,
    updatedAt: Date.now(),
    version: CURRENT_DATA_VERSION
  }
  try {
    await bookmarkManager.dbManager.upsertCrawlMetadata(record)
  } catch (e) {
    logger.warn('ServiceWorker', '写入健康扫描结果失败', e)
  }
}

async function runHealthScanAllBookmarks() {
  try {
    const last = await bookmarkManager.getSetting('health.lastScanAt')
    const autoSetting = await bookmarkManager.getSetting(
      'health.autoScanEnabled'
    )
    // 仅首次自动扫描：如果已经记录过扫描时间或明确关闭自动扫描，则跳过
    if (
      (last && typeof last.value === 'number') ||
      (autoSetting && autoSetting.value === false)
    ) {
      logger.info(
        'ServiceWorker',
        '🩺 [健康扫描] 已执行过或已禁用，跳过本次自动扫描'
      )
      return { scanned: 0, skipped: true }
    }
    const all = await bookmarkManager.getAllBookmarks()
    const urlBookmarks = all.filter(b => !b.isFolder && b.url)
    // 计算重复
    const map = new Map()
    for (const b of urlBookmarks) {
      const k = normalizeUrl(b.url)
      map.set(k, (map.get(k) || []).concat([b.id]))
    }
    // 顺序扫描（节流由域名限速控制）
    for (const b of urlBookmarks) {
      await enqueueHealthScanForBookmark(b)
    }
    await bookmarkManager.saveSetting(
      'health.lastScanAt',
      Date.now(),
      'number',
      '最后一次健康扫描时间'
    )
    return {
      scanned: urlBookmarks.length,
      duplicates: Array.from(map.values()).filter(v => v.length > 1).length
    }
  } catch (e) {
    logger.warn('ServiceWorker', '健康扫描任务失败', e)
    return { scanned: 0, error: String(e?.message || e) }
  }
}

/**
 * 通知前端页面书签更新
 */
function notifyFrontendBookmarkUpdate(eventType, id, data) {
  try {
    // 广播消息给所有页面
    chrome.runtime
      .sendMessage({
        type: 'BOOKMARK_UPDATED',
        eventType,
        id,
        data,
        timestamp: Date.now()
      })
      .catch(error => {
        // 忽略没有监听器的错误，这是正常的
        if (!error.message.includes('receiving end does not exist')) {
          logger.warn('ServiceWorker', '⚠️ [书签同步] 通知前端失败:', error)
        }
      })

    logger.info('ServiceWorker', `📡 [书签同步] 已广播 ${eventType} 事件通知`)
  } catch (error) {
    logger.warn('ServiceWorker', '⚠️ [书签同步] 广播通知失败:', error)
  }
}

// ==================== 快捷键命令处理 ====================

// 监听快捷键命令
chrome.commands.onCommand.addListener(command => {
  logger.info('ServiceWorker', `🎯 [Service Worker] 快捷键命令: ${command}`)

  switch (command) {
    case 'open-popup':
      // 通过快捷键打开扩展弹出页
      try {
        chrome.action.openPopup()
      } catch (err) {
        logger.error('ServiceWorker', '❌ 打开弹出页失败', err)
      }
      break
    case 'open-side-panel':
      // 切换侧边栏（使用统一逻辑，减少环境差异导致的失败）
      openSidePanel()
      break

    case 'open-management':
      // 打开管理页面
      openManagementPage()
      break

    case 'open-settings':
      // 打开设置页面
      openSettingsPage()
      break

    default:
      logger.warn(
        'ServiceWorker',
        `⚠️ [Service Worker] 未知快捷键命令: ${command}`
      )
  }
})

// 侧边栏状态管理
const sidePanelState = {
  isEnabled: true,
  windowId: null
}

// 🎯 核心切换逻辑 - popup和快捷键共享
async function toggleSidePanelCore(source = 'unknown') {
  try {
    logger.info('ServiceWorker', `🚀 [${source}] 执行侧边栏切换逻辑...`)

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (!currentTab?.windowId) {
      throw new Error('无法获取当前窗口信息')
    }

    // 检查当前侧边栏状态
    const currentOptions = await chrome.sidePanel.getOptions({
      tabId: currentTab.id
    })
    const isCurrentlyEnabled = currentOptions.enabled

    logger.info('ServiceWorker', `📊 [${source}] 当前侧边栏状态:`, {
      enabled: isCurrentlyEnabled
    })

    if (isCurrentlyEnabled) {
      // 🎯 当前启用 → 禁用侧边栏
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        enabled: false
      })

      sidePanelState.isEnabled = false
      sidePanelState.windowId = null

      logger.info('ServiceWorker', `✅ [${source}] 侧边栏已关闭`)

      // 显示关闭提示
      chrome.notifications.create('sidePanelClosed', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'AcuityBookmarks',
        message: '📋 侧边栏已关闭'
      })

      return { action: 'closed', enabled: false }
    } else {
      // 🎯 当前禁用 → 启用并打开侧边栏
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        path: 'side-panel.html',
        enabled: true
      })

      // 确保action点击不会干扰
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

      // 直接打开侧边栏
      await chrome.sidePanel.open({ windowId: currentTab.windowId })

      sidePanelState.isEnabled = true
      sidePanelState.windowId = currentTab.windowId

      return { action: 'opened', enabled: true }
    }
  } catch (error) {
    logger.error(
      'ServiceWorker',
      `❌ [${source}] 切换侧边栏失败:`,
      error.message
    )

    chrome.notifications.create('sidePanelError', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: 'AcuityBookmarks',
      message: `❌ 侧边栏打开失败: ${error.message}`
    })

    return { action: 'failed', enabled: false }
  }
}

// 快捷键处理函数
async function openSidePanel() {
  try {
    if (!chrome?.sidePanel) {
      logger.warn('ServiceWorker', '⚠️ 侧边栏API不可用，显示提示')
      chrome.notifications.create('sidePanelUnsupported', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'AcuityBookmarks',
        message: '当前浏览器不支持侧边栏，请更新到较新版本的 Chrome'
      })
      return
    }

    // 优先使用统一切换逻辑，避免对 getOptions 的依赖
    await toggleSidePanelUnified('快捷键')
  } catch (error) {
    logger.warn('ServiceWorker', '⚠️ 统一切换逻辑失败，尝试回退核心逻辑', error)
    try {
      await toggleSidePanelCore('快捷键-回退')
    } catch (err) {
      logger.error(
        'ServiceWorker',
        '❌ 侧边栏切换失败（统一与回退均失败）',
        err
      )
      chrome.notifications.create('sidePanelErrorGesture', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'AcuityBookmarks',
        message: '切换侧边栏失败。请点击扩展图标或在非 chrome:// 页面重试'
      })
    }
  }
}

async function openManagementPage() {
  try {
    logger.info('ServiceWorker', '🚀 [快捷键] 打开管理页面...')
    const managementUrl = chrome.runtime.getURL('management.html')
    await chrome.tabs.create({ url: managementUrl })
    logger.info('ServiceWorker', '✅ [快捷键] 管理页面已打开')
  } catch (error) {
    logger.error('ServiceWorker', '❌ [快捷键] 打开管理页面失败:', error)
  }
}

async function openSettingsPage() {
  try {
    logger.info('ServiceWorker', '🚀 打开设置页面...')
    const settingsUrl = chrome.runtime.getURL('settings.html')
    await chrome.tabs.create({ url: settingsUrl })
    logger.info('ServiceWorker', '✅ 设置页面已打开')
  } catch (error) {
    logger.error('ServiceWorker', '❌ 打开设置页面失败:', error)
  }
}

// ==================== 上下文菜单管理 ====================
/**
 * createContextMenus
 * 创建右键菜单项：
 * - 切换侧边栏
 * - 管理书签
 * - 设置
 * - 解析当前页元数据
 *
 * 所有项均在 `page/selection/link/image` 场景可见（解析菜单仅在 page 场景）。
 */

// 创建上下文菜单项
function createContextMenus() {
  try {
    logger.info('ServiceWorker', '🎯 [Service Worker] 创建上下文菜单...')

    // 清除现有菜单项（如果有的话）
    chrome.contextMenus.removeAll()

    // 创建主菜单项 - 切换侧边栏
    chrome.contextMenus.create({
      id: 'toggle-sidepanel',
      title: '📋 切换书签侧边栏',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 创建分隔符
    chrome.contextMenus.create({
      id: 'separator-1',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 创建其他书签功能菜单
    chrome.contextMenus.create({
      id: 'open-management',
      title: '🔧 管理书签',
      contexts: ['page', 'selection', 'link', 'image']
    })

    chrome.contextMenus.create({
      id: 'open-settings',
      title: '⚙️ 设置',
      contexts: ['page', 'selection', 'link', 'image']
    })

    // 解析当前页元数据
    chrome.contextMenus.create({
      id: 'extract-page-meta',
      title: '🧩 解析当前页元数据',
      contexts: ['page']
    })

    // 已移除 AI 整理菜单项

    logger.info('ServiceWorker', '✅ [Service Worker] 上下文菜单创建完成')
  } catch (error) {
    logger.error(
      'ServiceWorker',
      '❌ [Service Worker] 创建上下文菜单失败:',
      error
    )
  }
}

// 🎯 侧边栏状态跟踪（因为Chrome没有提供直接的"是否打开"API）
const sidePanelOpenState = {
  isOpen: false,
  windowId: null,
  tabId: null
}

// 🎯 监听侧边栏打开事件（Chrome 114+）
if (chrome.sidePanel && chrome.sidePanel.onOpened) {
  chrome.sidePanel.onOpened.addListener(info => {
    sidePanelOpenState.isOpen = true
    sidePanelOpenState.windowId = info.windowId
    sidePanelOpenState.tabId = info.tabId || null
  })
}

// 🎯 监听标签页变化，重置状态（间接跟踪侧边栏关闭）
chrome.tabs.onActivated.addListener(() => {
  // 标签页切换时，重置状态以防止状态不同步
  logger.info('ServiceWorker', '📋 [事件] 标签页切换，重置侧边栏状态跟踪')
  sidePanelOpenState.isOpen = false
  sidePanelOpenState.windowId = null
  sidePanelOpenState.tabId = null
})

// 🎯 监听窗口变化，重置状态
chrome.windows.onFocusChanged.addListener(() => {
  // 窗口切换时，重置状态
  logger.info('ServiceWorker', '📋 [事件] 窗口切换，重置侧边栏状态跟踪')
  sidePanelOpenState.isOpen = false
  sidePanelOpenState.windowId = null
  sidePanelOpenState.tabId = null
})

// 🎯 统一的侧边栏切换函数（根据官方文档重新设计）
async function toggleSidePanelUnified(source = '未知来源') {
  try {
    logger.info('ServiceWorker', `🚀 [${source}] 执行侧边栏切换逻辑...`)

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (!currentTab?.windowId) {
      throw new Error('无法获取当前窗口信息')
    }

    // 🎯 根据官方文档：不依赖enabled状态，采用"总是尝试打开"策略
    // 因为Chrome没有直接的"是否打开"API，我们采用简化策略

    logger.info(
      'ServiceWorker',
      `📊 [${source}] 当前跟踪状态:`,
      sidePanelOpenState
    )

    if (
      sidePanelOpenState.isOpen &&
      sidePanelOpenState.windowId === currentTab.windowId
    ) {
      // 🎯 认为已打开 → 尝试关闭（通过禁用）
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        enabled: false
      })

      // 更新跟踪状态
      sidePanelOpenState.isOpen = false
      sidePanelOpenState.windowId = null
      sidePanelOpenState.tabId = null

      logger.info('ServiceWorker', `✅ [${source}] 侧边栏已关闭`)

      chrome.notifications.create('sidePanelClosed', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: 'AcuityBookmarks',
        message: '📋 侧边栏已关闭'
      })

      return { action: 'closed', enabled: false }
    } else {
      // 🎯 认为未打开 → 启用并打开
      await chrome.sidePanel.setOptions({
        tabId: currentTab.id,
        path: 'side-panel.html',
        enabled: true
      })

      // 设置面板行为
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

      try {
        // 🎯 尝试打开侧边栏（需要用户手势）
        await chrome.sidePanel.open({ windowId: currentTab.windowId })

        // 手动更新状态（因为onOpened可能不总是触发）
        sidePanelOpenState.isOpen = true
        sidePanelOpenState.windowId = currentTab.windowId
        sidePanelOpenState.tabId = currentTab.id
        return { action: 'opened', enabled: true }
      } catch (openError) {
        logger.warn(
          'ServiceWorker',
          `⚠️ [${source}] 直接打开失败:`,
          openError.message
        )

        // 如果是用户手势问题，回退到新标签页
        if (openError.message.includes('user gesture')) {
          throw new Error('用户手势限制')
        }
        throw openError
      }
    }
  } catch (error) {
    logger.error(
      'ServiceWorker',
      `❌ [${source}] 侧边栏操作失败:`,
      error.message
    )

    chrome.notifications.create('sidePanelError', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: 'AcuityBookmarks',
      message: `❌ 切换侧边栏失败: ${error.message}`
    })

    return { action: 'failed', enabled: false }
  }
}

// 处理上下文菜单点击事件
chrome.contextMenus.onClicked.addListener(async info => {
  try {
    logger.info(
      'ServiceWorker',
      `🎯 [Service Worker] 上下文菜单点击:`,
      info.menuItemId
    )

    switch (info.menuItemId) {
      case 'toggle-sidepanel':
        // 🎯 右键菜单侧边栏切换 - 智能处理用户手势限制
        logger.info('ServiceWorker', '📋 [右键菜单] 尝试切换侧边栏...')
        try {
          const [currentTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })

          if (currentTab?.windowId) {
            // 尝试直接打开侧边栏
            await chrome.sidePanel.setOptions({
              tabId: currentTab.id,
              path: 'side-panel.html',
              enabled: true
            })

            await chrome.sidePanel.setPanelBehavior({
              openPanelOnActionClick: false
            })
            await chrome.sidePanel.open({ windowId: currentTab.windowId })
          } else {
            throw new Error('无法获取当前窗口信息')
          }
        } catch (error) {
          logger.warn(
            'ServiceWorker',
            '⚠️ [右键菜单] 侧边栏直接打开失败:',
            error.message
          )

          // 智能提示：告诉用户其他打开方式
          if (
            error.message.includes('user gesture') ||
            error.message.includes('gesture')
          ) {
            chrome.notifications.create('contextMenuGestureInfo', {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('images/icon128.png'),
              title: 'AcuityBookmarks',
              message: '💡 请点击扩展图标或按Alt+D打开侧边栏'
            })
          } else {
            chrome.notifications.create('contextMenuError', {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('images/icon128.png'),
              title: 'AcuityBookmarks',
              message: `❌ 打开侧边栏失败: ${error.message}`
            })
          }
        }
        break

      case 'open-management':
        // 打开管理页面
        await openManagementPage()
        break

      case 'open-settings':
        await openSettingsPage()
        break

      case 'extract-page-meta': {
        try {
          const [currentTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })

          if (!currentTab?.id) throw new Error('无法获取当前标签页')

          const [res] = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            // eslint-disable-next-line no-undef
            func: () => document.documentElement.outerHTML
          })

          const html = res?.result || ''
          const meta = await extractMetaInOffscreen(html)

          const title = meta?.title || '(未提取到标题)'
          const description = meta?.description || '(未提取到描述)'

          chrome.notifications.create('extractPageMeta', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('images/icon128.png'),
            title: `解析结果: ${title}`,
            message: description.slice(0, 180)
          })
        } catch (err) {
          logger.warn('ServiceWorker', '⚠️ [右键菜单] 解析元数据失败:', err)
          chrome.notifications.create('extractPageMetaError', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('images/icon128.png'),
            title: 'AcuityBookmarks',
            message: `❌ 解析失败: ${err?.message || err}`
          })
        }
        break
      }

      // AI 整理菜单项已移除

      default:
        logger.warn(
          'ServiceWorker',
          `⚠️ [Service Worker] 未知菜单项: ${info.menuItemId}`
        )
    }
  } catch (error) {
    logger.error(
      'ServiceWorker',
      '❌ [Service Worker] 处理上下文菜单点击失败:',
      error
    )

    // 显示错误通知
    chrome.notifications.create('contextMenuError', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: 'AcuityBookmarks',
      message: `操作失败: ${error.message}`
    })
  }
})

// ==================== 侧边栏配置 ====================

// 确保侧边栏在扩展安装后可用
/**
 * onInstalled
 * 扩展安装或更新时：
 * - 初始化侧边栏配置；
 * - 创建上下文菜单；
 * - 注册周期同步与存储配额检查，并执行一次延迟的初始检查。
 */
chrome.runtime.onInstalled.addListener(() => {
  // 设置侧边栏基本配置
  chrome.sidePanel
    .setOptions({
      path: 'side-panel.html',
      enabled: true
    })
    .catch(err => {
      logger.warn(
        'ServiceWorker',
        '⚠️ [Service Worker] 侧边栏初始配置失败:',
        err
      )
    })

  // 禁止点击扩展图标自动打开侧边栏，确保显示popup
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(err => {
      logger.warn(
        'ServiceWorker',
        '⚠️ [Service Worker] 设置侧边栏点击行为失败:',
        err
      )
    })

  // 创建上下文菜单
  createContextMenus()

  // 注册周期同步与存储配额检查，并进行一次初始检查
  try {
    bookmarkManager.startPeriodicSync()
  } catch (e) {
    logger.warn('ServiceWorker', '⚠️ [书签管理服务] 安装时注册周期同步失败:', e)
  }

  try {
    chrome.alarms.create('StorageQuotaCheck', { periodInMinutes: 60 })
  } catch (e) {
    logger.warn(
      'ServiceWorker',
      '⚠️ [存储配额] 安装时注册 StorageQuotaCheck 失败:',
      e
    )
  }

  // 安装完成后做一次同步与配额检查（延迟以避免阻塞安装流程）
  setTimeout(() => {
    bookmarkManager
      .checkAndSync()
      .catch(err =>
        logger.warn('ServiceWorker', '⚠️ [书签管理服务] 首次同步失败:', err)
      )
    storageQuotaMonitor
      .checkQuota()
      .catch(err =>
        logger.warn('ServiceWorker', '⚠️ [存储配额] 首次检查失败:', err)
      )
  }, 2000)

  // 默认启用后端爬虫（延迟写入以确保DB初始化）
  setTimeout(() => {
    bookmarkManager
      .saveSetting('useBackendCrawler', true, 'boolean', '优先使用后端爬虫')
      .catch(err =>
        logger.warn(
          'ServiceWorker',
          '⚠️ 写入默认设置 useBackendCrawler 失败:',
          err
        )
      )
  }, 500)

  // 安装完成后触发一次健康扫描（延迟启动避免阻塞安装流程）
  setTimeout(() => {
    runHealthScanAllBookmarks()
      .then(res => {
        if (res && res.skipped) {
          logger.info(
            'ServiceWorker',
            '🩺 [健康扫描] 检测到历史记录，自动扫描已跳过'
          )
        } else {
          logger.info(
            'ServiceWorker',
            `🩺 [健康扫描] 首次扫描完成: ${res.scanned}，重复: ${res.duplicates}`
          )
        }
      })
      .catch(err =>
        logger.warn('ServiceWorker', '⚠️ [健康扫描] 首次扫描失败:', err)
      )
  }, 1500)

  // 注册自动嵌入 alarms（每2小时尝试一次，内部会判断是否需要执行）
  try {
    chrome.alarms.create('AcuityBookmarksAutoEmbedding', {
      periodInMinutes: 120
    })
  } catch (e) {
    logger.warn(
      'ServiceWorker',
      '⚠️ [嵌入自动] 创建 alarms 失败，将依赖启动时触发',
      e
    )
  }

  // 安装后延迟尝试一次自动嵌入（不阻塞安装流程）
  setTimeout(() => {
    maybeRunAutoEmbeddingJob().catch(() => {})
  }, 3000)
})

// 在浏览器启动时也确保图标点击不会打开侧边栏
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(err => {
      logger.warn(
        'ServiceWorker',
        '⚠️ [Service Worker] 启动时设置侧边栏点击行为失败:',
        err
      )
    })

  // 启动后尝试一次自动嵌入（内部有24h节流与配额）
  setTimeout(() => {
    maybeRunAutoEmbeddingJob().catch(() => {})
  }, 5000)

  // 启动时确保周期同步与配额检查注册，并进行一次检查
  try {
    bookmarkManager.startPeriodicSync()
  } catch (e) {
    logger.warn('ServiceWorker', '⚠️ [书签管理服务] 启动时注册周期同步失败:', e)
  }

  try {
    chrome.alarms.create('StorageQuotaCheck', { periodInMinutes: 60 })
  } catch (e) {
    logger.warn(
      'ServiceWorker',
      '⚠️ [存储配额] 启动时注册 StorageQuotaCheck 失败:',
      e
    )
  }

  setTimeout(() => {
    bookmarkManager
      .checkAndSync()
      .catch(err =>
        logger.warn('ServiceWorker', '⚠️ [书签管理服务] 启动时同步失败:', err)
      )
    storageQuotaMonitor
      .checkQuota()
      .catch(err =>
        logger.warn('ServiceWorker', '⚠️ [存储配额] 启动时检查失败:', err)
      )
  }, 4000)
})

// ==================== 初始化 ====================

// 立即初始化
bookmarkManager.initialize().catch(error => {
  logger.error('ServiceWorker', '❌ [Service Worker] 初始化失败:', error)
})

// 运行时再次兜底：确保点击扩展图标打开的是popup而非侧边栏
try {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(err =>
      logger.warn(
        'ServiceWorker',
        '⚠️ [Service Worker] 运行时设置侧边栏点击行为失败:',
        err
      )
    )
} catch (err) {
  logger.warn(
    'ServiceWorker',
    '⚠️ [Service Worker] 设置侧边栏点击行为异常:',
    err
  )
}

// 监听 alarms 定时任务
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm?.name === 'AcuityBookmarksPeriodicSync') {
    try {
      await bookmarkManager.checkAndSync()
    } catch (error) {
      logger.warn('ServiceWorker', '⚠️ [书签管理服务] alarms 同步失败:', error)
    }
    return
  }

  if (alarm?.name === 'StorageQuotaCheck') {
    try {
      await storageQuotaMonitor.checkQuota()
    } catch (error) {
      logger.warn('ServiceWorker', '⚠️ [存储配额] 定时检查失败:', error)
    }
    return
  }

  if (alarm?.name === 'AcuityBookmarksAutoEmbedding') {
    try {
      await maybeRunAutoEmbeddingJob()
    } catch (error) {
      logger.warn('ServiceWorker', '⚠️ [嵌入自动] alarms 任务失败:', error)
    }
  }
})

logger.info(
  'ServiceWorker',
  '✅ [Service Worker] AcuityBookmarks Service Worker 已启动'
)

// ==================== Omnibox 严格模式控制 ====================
// 当开启严格模式时：
// - 仅显示扩展提供的建议，不进行与其他来源（如 Chrome 书签 API 兜底）的合并
// - 关闭本地即时关键词回退合并（只在必要时显示单一来源结果）
// - 减少“AI检索中…”占位项，避免用户认为是“其他数据”
const OMNIBOX_STRICT_MODE = true

// ==================== Omnibox 自然语言搜索 ====================
// 说明：在地址栏中输入关键字（manifest中为 "ab"），随后输入自然语言查询
// 示例："我上周收藏的一篇关于恐龙的文章 是什么来着"

function escapeForOmnibox(text = '') {
  try {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  } catch {
    return text || ''
  }
}

async function vectorizeQueryDirect(text = '', topK = 6) {
  const returnMetadata = 'indexed'
  const returnValues = false
  for (const base of AI_BASE_CANDIDATES) {
    try {
      const resp = await fetchJsonWithTimeout(
        `${base}/api/vectorize/query`,
        {
          method: 'POST',
          body: JSON.stringify({ text, topK, returnMetadata, returnValues })
        },
        12000
      )
      if (resp && resp.success && Array.isArray(resp.matches)) {
        const mapped = resp.matches.map(m => {
          const meta = m?.metadata || {}
          return {
            id: String(m?.id || meta.bookmarkId || ''),
            title: meta.title || '',
            url: meta.url || '',
            domain: meta.domain || '',
            pathString: meta.pathString || '',
            score: Number(m?.score ?? m?.similarity ?? 0)
          }
        })
        try {
          logger.info(
            'ServiceWorker',
            `🔎 [Omnibox] Cloud Vectorize 返回 ${mapped.length} 条`
          )
        } catch {
          // no-op
        }
        return mapped
      }
    } catch {
      // 尝试下一个 base
    }
  }
  throw new Error('Vectorize query failed')
}

// 将文本中与查询匹配的片段用 <match> 包裹以实现高亮
// 将文本中与查询匹配的片段返回原文（不插入标签），样式由 descriptionStyles 控制
function highlightForOmnibox(text = '', query = '') {
  try {
    const raw = String(text || '')
    const tokens = String(query || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (tokens.length === 0) return escapeForOmnibox(raw)

    // 组合正则，大小写不敏感，匹配任意一个词
    const escReg = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(tokens.map(escReg).join('|'), 'gi')

    let out = ''
    let last = 0
    let m
    while ((m = re.exec(raw)) !== null) {
      // 非匹配片段正常转义
      out += escapeForOmnibox(raw.slice(last, m.index))
      // 匹配片段包裹 <match>
      out += `<match>${escapeForOmnibox(m[0])}</match>`
      last = re.lastIndex
    }
    // 收尾非匹配片段
    out += escapeForOmnibox(raw.slice(last))
    return out
  } catch {
    return escapeForOmnibox(text || '')
  }
}

// 将URL格式化为 Omnibox 样式标签：域名 <url>，其余 <dim>
function formatUrlForOmnibox(rawUrl = '') {
  try {
    const u = new URL(rawUrl)
    const host = escapeForOmnibox(u.hostname)
    const path = escapeForOmnibox((u.pathname || '/') + (u.search || ''))
    const hasPath = path && path !== '/' && path.trim() !== ''
    // 去掉协议与www的视觉噪音，更接近“站点感”
    return `<url>${host}</url>${hasPath ? `<dim>${path}</dim>` : ''}`
  } catch {
    // 解析失败时，整段作为 <url> 显示
    return `<url>${escapeForOmnibox(rawUrl || '')}</url>`
  }
}

function toOmniboxSuggestions(matches = [], tag = '', query = '') {
  logger.info(`🔍 [Omnibox] 生成建议（${tag}）:`, matches)
  const suggestions = []
  for (const m of Array.isArray(matches) ? matches : []) {
    const rawUrl = m.url || ''
    const rawId = m.id || ''
    const payload = rawUrl
      ? rawUrl
      : rawId
        ? `ab://open?id=${encodeURIComponent(rawId)}`
        : m.title
          ? `ab://search?q=${encodeURIComponent(m.title)}`
          : 'ab://search'

    // 标题使用 <match> 高亮；分隔符弱化；URL使用 <url>/<dim>
    const titleText = highlightForOmnibox(
      m.title || m.metaTitle || m.url || '',
      query
    )
    const sep = '<dim> - </dim>'
    const urlDesc = formatUrlForOmnibox(rawUrl)
    const desc = `${titleText}${sep}${urlDesc}`

    // 使用XML标签样式，不再提供 descriptionStyles，确保标签生效
    suggestions.push({ content: payload, description: desc })
  }
  return suggestions
}

function dedupeSuggestions(suggestions = []) {
  const seen = new Set()
  const out = []
  for (const s of suggestions) {
    const key = s?.content || ''
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

// 将建议简化为易读日志格式
function formatSuggestionsForLog(items = []) {
  try {
    const arr = Array.isArray(items) ? items : []
    return arr.map(s => ({
      content: s?.content || '',
      description: s?.description || ''
    }))
  } catch {
    return []
  }
}

// 解析 omnibox content（自定义协议）
function parseOmniboxContent(text = '') {
  const t = (text || '').trim()
  try {
    const u = new URL(t)
    if (u.protocol === 'ab:') {
      const url = u.searchParams.get('u') || ''
      const id = u.searchParams.get('id') || ''
      const q = u.searchParams.get('q') || ''
      const view = u.searchParams.get('view') || ''
      return { url, id, q, view }
    }
  } catch {
    // no-op
  }
  // 兼容直接传入URL
  return { url: t, id: '', q: '', view: '' }
}

// 将 suggest 包装为安全调用，并记录日志便于诊断
function safeSuggest(suggest, items = [], phase = '') {
  try {
    const arr = Array.isArray(items) ? items : []
    suggest(arr)
    try {
      logger.info(
        'ServiceWorker',
        `🟢 [Omnibox] suggest(${arr.length}) 成功${phase ? `（${phase}）` : ''}`
      )
    } catch {
      // no-op
    }
  } catch (err) {
    try {
      logger.warn(
        'ServiceWorker',
        `🔴 [Omnibox] suggest 调用失败${phase ? `（${phase}）` : ''}:`,
        err?.message || err
      )
    } catch {
      // no-op
    }
  }
}

async function keywordFallbackSearch(text = '', topK = 6) {
  try {
    const q = (text || '').trim()
    const limit = Math.max(1, topK)

    // 若数据库尚未初始化或服务未就绪，直接使用 Chrome 书签 API 兜底，确保本地命中即时返回
    const notReady =
      !bookmarkManager?.isReady || !bookmarkManager?.dbManager?.isInitialized
    if (!OMNIBOX_STRICT_MODE && notReady && chrome?.bookmarks?.search) {
      const nodes = await new Promise(resolve => {
        try {
          chrome.bookmarks.search({ query: q }, res =>
            resolve(Array.isArray(res) ? res : [])
          )
        } catch {
          resolve([])
        }
      })
      const mapped = nodes
        .filter(n => Boolean(n.url))
        .slice(0, limit)
        .map(n => ({
          id: String(n.id || ''),
          title: n.title || n.url || '',
          url: n.url || '',
          domain: getDomainFromUrl(n.url || ''),
          score: 0
        }))
      try {
        logger.info(
          'ServiceWorker',
          `🔤 [Omnibox] ChromeAPI兜底返回 ${mapped.length} 条`
        )
      } catch {
        // no-op
      }
      return mapped
    }

    // 正常走 IndexedDB 加权关键词检索
    const results = await bookmarkManager.searchBookmarks(q, { limit })
    const out = (Array.isArray(results) ? results : [])
      .slice(0, limit)
      .map(r => {
        const b = r && typeof r === 'object' && r.bookmark ? r.bookmark : r
        const id = String(b?.id || r?.id || '')
        const url = b?.url || r?.url || ''
        const title = b?.title || r?.title || url || ''
        const domain =
          b?.domain || r?.domain || (url ? getDomainFromUrl(url) : '')
        const pathString =
          b?.pathString ||
          r?.pathString ||
          (Array.isArray(b?.path)
            ? b.path.join(' / ')
            : Array.isArray(r?.path)
              ? r.path.join(' / ')
              : '')
        const score = Number(r?.score ?? r?.relevanceScore ?? 0)
        return { id, title, url, domain, pathString, score }
      })
    try {
      logger.info(
        'ServiceWorker',
        `🔤 [Omnibox] IndexedDB本地检索返回 ${out.length} 条`
      )
    } catch {
      // no-op
    }
    return out
  } catch (e) {
    try {
      logger.warn(
        'ServiceWorker',
        '⚠️ [Omnibox] 本地关键词检索异常:',
        e?.message || e
      )
    } catch {
      // no-op
    }
    return []
  }
}

function openResultUrl(url = '', disposition = 'currentTab') {
  if (!url) return
  const active = disposition === 'newForegroundTab'
  if (disposition === 'currentTab') {
    chrome.tabs
      .update({ url })
      .catch(() => chrome.tabs.create({ url, active: true }))
    return
  }
  chrome.tabs.create({ url, active }).catch(() => {})
}

try {
  if (chrome.omnibox && chrome.omnibox.setDefaultSuggestion) {
    chrome.omnibox.setDefaultSuggestion({
      description: 'AcuityBookmarks：搜索你的书签'
    })

    // 为 Omnibox 输入添加防抖，避免每次按键都触发云端/本地嵌入计算
    let __omniboxDebounceTimer = null
    let __omniboxSeq = 0
    const __omniboxDebounceMs = 350
    // 记录最后一次成功展示的建议，用于异常或网络波动时兜底
    let __lastOmniboxSuggestions = []

    chrome.omnibox.onInputChanged.addListener((text, suggest) => {
      try {
        const q = (text || '').trim()
        if (__omniboxDebounceTimer) {
          clearTimeout(__omniboxDebounceTimer)
        }
        if (!q) {
          safeSuggest(suggest, [], 'empty-query')
          try {
            logger.info('ServiceWorker', '📝 [Omnibox] 输入与结果（空输入）', {
              input: q,
              results: []
            })
          } catch {
            // no-op
          }
          return
        }

        // 立即推送占位建议，确保 UI 有显示（严格模式下减少占位提示）
        const __placeholder = OMNIBOX_STRICT_MODE
          ? []
          : [{ content: q || 'query', description: '搜索中...' }]
        if (!OMNIBOX_STRICT_MODE) {
          safeSuggest(suggest, __placeholder, 'placeholder-immediate')
          __lastOmniboxSuggestions = __placeholder
          try {
            logger.info('ServiceWorker', '⌛ [Omnibox] 输入与占位', {
              input: q,
              results: formatSuggestionsForLog([
                { content: q || 'query', description: '搜索中...' }
              ])
            })
          } catch {
            // no-op
          }
        }

        // 立即尝试本地检索并推送结果（不等待防抖），以验证UI是否展示扩展建议
        if (!OMNIBOX_STRICT_MODE) {
          ;(async () => {
            try {
              const localNow = await keywordFallbackSearch(q, 6)
              const localNowSuggestions = toOmniboxSuggestions(
                localNow,
                '本地',
                q
              )
              safeSuggest(suggest, localNowSuggestions, 'local-immediate')
              if (
                Array.isArray(localNowSuggestions) &&
                localNowSuggestions.length > 0
              ) {
                __lastOmniboxSuggestions = localNowSuggestions
              }
              try {
                logger.info(
                  'ServiceWorker',
                  '📄 [Omnibox] 输入与本地结果（即时）',
                  {
                    input: q,
                    results: formatSuggestionsForLog(localNowSuggestions)
                  }
                )
              } catch {
                // no-op
              }
            } catch (err) {
              try {
                logger.warn(
                  'ServiceWorker',
                  '⚠️ [Omnibox] 即时本地检索失败:',
                  err?.message || err
                )
              } catch {
                // no-op
              }
            }
          })()
        }

        const mySeq = ++__omniboxSeq
        // 缩短防抖时间：先本地极速返回，再异步合并AI结果
        const debounceMs = Math.min(__omniboxDebounceMs, 200)
        __omniboxDebounceTimer = setTimeout(async () => {
          try {
            if (!OMNIBOX_STRICT_MODE) {
              // 非严格模式：先本地极速返回，再合并 AI 结果
              const local = await keywordFallbackSearch(q, 6)
              const localSuggestions = toOmniboxSuggestions(local, '本地', q)
              try {
                logger.info('ServiceWorker', '📄 [Omnibox] 输入与本地结果', {
                  input: q,
                  results: formatSuggestionsForLog(localSuggestions)
                })
              } catch {
                logger.warn('ServiceWorker', '⚠️ [Omnibox] 本地检索失败')
              }
              safeSuggest(
                suggest,
                [
                  ...localSuggestions,
                  { content: q || 'query', description: 'AI检索中…' }
                ],
                'local+placeholder'
              )
              if (
                Array.isArray(localSuggestions) &&
                localSuggestions.length > 0
              ) {
                __lastOmniboxSuggestions = localSuggestions
              }

              let cloud = []
              try {
                cloud = await vectorizeQueryDirect(q, 6)
              } catch {
                cloud = []
              }
              if (mySeq !== __omniboxSeq) return
              const cloudSuggestions = toOmniboxSuggestions(cloud, 'AI', q)
              const merged = dedupeSuggestions([
                ...localSuggestions,
                ...cloudSuggestions
              ])
              try {
                logger.info('ServiceWorker', '📄 [Omnibox] 输入与合并结果', {
                  input: q,
                  results: formatSuggestionsForLog(merged)
                })
              } catch {
                cloud = []
              }
              safeSuggest(suggest, merged, 'merged')
              if (Array.isArray(merged) && merged.length > 0) {
                __lastOmniboxSuggestions = merged
              }
            } else {
              // 严格模式：只显示扩展数据
              // 优先本地关键词检索（IndexedDB），若为空再尝试云端向量检索；不做合并
              let local = []
              try {
                local = await keywordFallbackSearch(q, 6)
              } catch {
                local = []
              }
              if (mySeq !== __omniboxSeq) return
              if (Array.isArray(local) && local.length > 0) {
                const localSuggestions = toOmniboxSuggestions(local, '本地', q)
                try {
                  logger.info(
                    'ServiceWorker',
                    '📄 [Omnibox] 输入与本地结果（严格）',
                    {
                      input: q,
                      results: formatSuggestionsForLog(localSuggestions)
                    }
                  )
                } catch {
                  local = []
                }
                safeSuggest(suggest, localSuggestions, 'strict-local')
                __lastOmniboxSuggestions = localSuggestions
              } else {
                let cloud = []
                try {
                  cloud = await vectorizeQueryDirect(q, 6)
                } catch {
                  cloud = []
                }
                if (mySeq !== __omniboxSeq) return
                const cloudSuggestions = toOmniboxSuggestions(cloud, 'AI', q)
                try {
                  logger.info(
                    'ServiceWorker',
                    '📄 [Omnibox] 输入与云端结果（严格）',
                    {
                      input: q,
                      results: formatSuggestionsForLog(cloudSuggestions)
                    }
                  )
                } catch {
                  cloud = []
                }
                safeSuggest(suggest, cloudSuggestions, 'strict-cloud')
                if (
                  Array.isArray(cloudSuggestions) &&
                  cloudSuggestions.length > 0
                ) {
                  __lastOmniboxSuggestions = cloudSuggestions
                } else {
                  // 无数据时保持空建议，避免混入任何非扩展来源数据
                  safeSuggest(suggest, [], 'strict-empty')
                }
              }
            }
          } catch {
            if (mySeq !== __omniboxSeq) return
            // 兜底：错误时优先使用上一轮成功建议，否则提供提示占位
            const fallback =
              __lastOmniboxSuggestions && __lastOmniboxSuggestions.length > 0
                ? __lastOmniboxSuggestions
                : [
                    {
                      content: q || 'query',
                      description: '检索异常，稍后重试…'
                    }
                  ]
            safeSuggest(suggest, fallback, 'error-fallback')
          }
        }, debounceMs)
      } catch {
        // 外层异常同样走兜底逻辑
        const q2 = (text || '').trim()
        const fallback =
          __lastOmniboxSuggestions && __lastOmniboxSuggestions.length > 0
            ? __lastOmniboxSuggestions
            : q2
              ? [{ content: q2 || 'query', description: '检索异常，稍后重试…' }]
              : []
        safeSuggest(suggest, fallback, 'outer-error-fallback')
      }
    })

    chrome.omnibox.onInputEntered.addListener(async text => {
      // 先解析自定义协议；若含URL或ID则直接打开
      const parsed = parseOmniboxContent(text)
      if (parsed.url) return openResultUrl(parsed.url, 'currentTab')
      if (parsed.id) {
        if (parsed.view === 'manage') {
          try {
            const managementUrl = `${chrome.runtime.getURL(
              'management.html'
            )}?id=${encodeURIComponent(parsed.id)}`
            await chrome.tabs.create({ url: managementUrl })
            return
          } catch {
            // 回退到直接打开书签
          }
        } else {
          try {
            const nodes = await chrome.bookmarks.get(parsed.id)
            const n = Array.isArray(nodes) ? nodes[0] : null
            const url = n?.url || ''
            if (url) return openResultUrl(url, 'currentTab')
          } catch {
            // 回退到直接打开书签}
          }
        }
        // 兼容用户直接输入URL
        const isUrl = /^https?:\/\//i.test(text)
        if (isUrl) return openResultUrl(text, 'currentTab')
        // 回退：使用关键词或AITop1打开
        const q = parsed.q || text
        const localTop = await keywordFallbackSearch(q, 1)
        const localUrl = localTop?.[0]?.url || ''
        if (localUrl) return openResultUrl(localUrl, 'currentTab')
        try {
          const cloudTop = await vectorizeQueryDirect(q, 1)
          const url = cloudTop?.[0]?.url || ''
          if (url) openResultUrl(url, 'currentTab')
        } catch {
          // 最终无结果
        }
      }
    })
  }
} catch (err) {
  logger.warn('ServiceWorker', '⚠️ [Omnibox] 初始化失败:', err?.message || err)
}
