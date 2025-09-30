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
(() => {
  const levelToStyle = {
    info: 'background: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 3px;',
    warn: 'background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px;',
    error: 'background: #ffebee; color: #b71c1c; padding: 2px 6px; border-radius: 3px;',
    debug: 'background: #f3e5f5; color: #4a148c; padding: 2px 6px; border-radius: 3px;'
  };

  // 保留原始 console 引用，避免递归
  const original = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console),
    debug: (console.debug || console.log).bind(console)
  };

  function formatLabel(scope, level) {
    const style = levelToStyle[level] || levelToStyle.info;
    return [`%c${scope}`, style];
  }

  // 日志级别控制（统一放置于代理内部）
  const LOG_LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
  let LOG_LEVEL = 'warn';
  function shouldLog(level) {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[LOG_LEVEL];
  }
  function setLogLevel(level) {
    if (level in LOG_LEVEL_ORDER) LOG_LEVEL = level;
  }

  const logger = {
    info(scope, ...args) {
      if (!shouldLog('info')) return;
      const [label, style] = formatLabel(scope, 'info');
      original.info(label, style, ...args);
    },
    warn(scope, ...args) {
      if (!shouldLog('warn')) return;
      const [label, style] = formatLabel(scope, 'warn');
      original.warn(label, style, ...args);
    },
    error(scope, ...args) {
      if (!shouldLog('error')) return;
      const [label, style] = formatLabel(scope, 'error');
      original.error(label, style, ...args);
    },
    debug(scope, ...args) {
      if (!shouldLog('debug')) return;
      const [label, style] = formatLabel(scope, 'debug');
      original.info(label, style, ...args);
    }
  };

  // 统一代理：将 console 输出路由到带作用域的 logger
  console.log = (...args) => logger.info('ServiceWorker', ...args);
  console.info = (...args) => logger.info('ServiceWorker', ...args);
  console.warn = (...args) => logger.warn('ServiceWorker', ...args);
  console.error = (...args) => logger.error('ServiceWorker', ...args);
  console.debug = (...args) => logger.debug('ServiceWorker', ...args);

  // 暴露便于调试
  self.__SW_LOGGER__ = logger;
  self.__SW_SET_LOG_LEVEL__ = setLogLevel;
})();

// 在 Service Worker 全局作用域提供 logger 别名，便于直接使用
const logger = self.__SW_LOGGER__;

/**
 * 轻量标签生成（Service Worker内置，避免模块导入）
 * 基于标题、URL和常见关键字做快速标签推断
 */
async function simpleGenerateTags(title = '', url = '') {
  try {
    const text = `${title} ${url}`.toLowerCase();
    const candidates = new Set();

    // 提取基本关键词（支持 Unicode 字母/数字）
    const wordMatches = text.match(/\b[\p{L}\p{N}\-]{3,}\b/gu) || [];
    wordMatches.slice(0, 10).forEach(w => candidates.add(w));

    // 基础领域映射
    const mappings = {
      technology: ['github','stackoverflow','developer','api','documentation','code','programming','react','vue','angular','javascript','typescript','python','java','css','html'],
      news: ['news','article','blog','medium','zhihu','juejin','新闻','文章','博客'],
      tools: ['tool','utility','service','app','software','工具','应用','服务']
    };
    for (const [tag, list] of Object.entries(mappings)) {
      if (list.some(kw => text.includes(kw))) candidates.add(tag);
    }

    // 根据域名补充一个来源标签
    try {
      const hostname = new URL(url).hostname.replace(/^www\./,'');
      if (hostname) {
        const parts = hostname.split('.');
        const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (base) candidates.add(base);
      }
    } catch {}

    return Array.from(candidates).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}

// ==================== AI 标签生成（Cloudflare Workers AI） ====================
// 说明：为避免在Service Worker中使用前端TS模块，这里实现最小AI调用版本
// 接口兼容后端/Cloudflare的 /api/ai/complete 端点
const AI_BASE_CANDIDATES = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://acuitybookmarks.cqw547847.workers.dev'
];

async function fetchJsonWithTimeout(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      },
      signal: controller.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI API HTTP ${resp.status}: ${text || resp.statusText}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseAiText(answer) {
  if (typeof answer === 'string') return answer;
  if (typeof answer?.response === 'string') return answer.response;
  if (typeof answer?.output_text === 'string') return answer.output_text;
  if (Array.isArray(answer?.choices) && answer.choices.length > 0) {
    const choice = answer.choices[0];
    return choice?.message?.content || choice?.text || '';
  }
  try {
    return JSON.stringify(answer);
  } catch {
    return '';
  }
}

async function cloudflareGenerateTags(title = '', url = '') {
  const input = `${title} ${url}`.trim();
  if (!input) return [];

  // 提示词与前端保持一致的意图（简短、结构化JSON数组）
  const TAG_PROMPT = `You are a bookmark tagging assistant. Based on the bookmark's title and content, generate 2-3 relevant tags.
- Output ONLY a JSON array of short tag strings
- Tags must be concise, lowercase, hyphen-separated if needed
- No explanations or extra text`;

  const body = {
    prompt: `${TAG_PROMPT}\n\nInput: "${title}", content: "${url}"`,
    model: '@cf/meta/llama-3.1-8b-instruct',
    temperature: 0.2,
    max_tokens: 64,
    stream: false
  };

  // 依次尝试本地开发与线上Worker
  for (const base of AI_BASE_CANDIDATES) {
    try {
      const answer = await fetchJsonWithTimeout(`${base}/api/ai/complete`, {
        method: 'POST',
        body: JSON.stringify(body)
      }, 12000);
      const text = parseAiText(answer).trim();
      if (!text) continue;
      let tags = [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          tags = parsed.filter(t => typeof t === 'string' && t.length > 0);
        }
      } catch {
        tags = text.split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
      return tags.slice(0, 3);
    } catch (e) {
      // 继续尝试下一个base
      logger.warn('ServiceWorker', '⚠️ [AI] 调用失败，尝试下一个提供者:', base, e?.message || e);
    }
  }

  // 所有AI提供者不可用，回退
  return [];
}

async function generateTagsSmart(title = '', url = '') {
  // 先尝试AI生成，失败则回退到本地简单生成
  try {
    const aiTags = await cloudflareGenerateTags(title, url);
    if (aiTags && aiTags.length > 0) return aiTags;
  } catch (err) {
    logger.warn('ServiceWorker', '⚠️ [AI] 云端生成失败，回退本地:', err?.message || err);
  }
  return await simpleGenerateTags(title, url);
}

// ==================== AI 嵌入生成（Cloudflare Workers AI） ====================
async function cloudflareGenerateEmbedding(text = '') {
  const body = {
    text,
    model: '@cf/baai/bge-m3'
  };

  for (const base of AI_BASE_CANDIDATES) {
    try {
      const answer = await fetchJsonWithTimeout(`${base}/api/ai/embedding`, {
        method: 'POST',
        body: JSON.stringify(body)
      }, 15000);
      // 兼容多种返回格式
      if (Array.isArray(answer)) return answer;
      if (Array.isArray(answer?.data)) return answer.data;
      if (Array.isArray(answer?.vector)) return answer.vector;
      if (Array.isArray(answer?.response)) return answer.response;
      // Cloudflare有时返回 { embeddings: [ ... ] }
      if (Array.isArray(answer?.embeddings)) return answer.embeddings;
    } catch (e) {
      logger.warn('ServiceWorker', '⚠️ [AI] 嵌入生成失败，尝试下一个提供者:', base, e?.message || e);
    }
  }
  return [];
}

// 注意：Service Worker中无法直接import ES模块
// 需要将核心组件的类定义复制到这里，或者使用importScripts

// 由于Chrome扩展的限制，我们需要重新定义核心类
// 在真实项目中，可以考虑使用打包工具来处理这个问题

// 日志控制已集成到统一代理中，可通过 self.__SW_SET_LOG_LEVEL__('info'|'warn'|...) 动态调整

// ==================== 数据库配置 ====================

const DB_CONFIG = {
    NAME: 'AcuityBookmarksDB',
    VERSION: 3,
    STORES: {
        BOOKMARKS: 'bookmarks',
        GLOBAL_STATS: 'globalStats',
        SETTINGS: 'settings',
        SEARCH_HISTORY: 'searchHistory',
        FAVICON_CACHE: 'faviconCache',
        FAVICON_STATS: 'faviconStats',
        EMBEDDINGS: 'embeddings',
        AI_JOBS: 'ai_jobs'
    }
}

const CURRENT_DATA_VERSION = '2.0.0'
const SYNC_INTERVAL = 60000 // 1分钟同步间隔

// ==================== IndexedDB管理器 ====================

class ServiceWorkerIndexedDBManager {
    constructor() {
        this.db = null
        this.isInitialized = false
        this.initPromise = null
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
                const error = request.error
                logger.error('ServiceWorker', '❌ [Service Worker] IndexedDB初始化失败:', error)
                this.initPromise = null
                reject(new Error(`IndexedDB初始化失败: ${error?.message || 'Unknown error'}`))
            }

            request.onsuccess = () => {
                this.db = request.result
                this.isInitialized = true
                this.initPromise = null

                logger.info('ServiceWorker', '✅ [Service Worker] IndexedDB初始化成功', {
                    version: this.db.version,
                    stores: Array.from(this.db.objectStoreNames)
                })

                resolve()
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result
                const oldVersion = event.oldVersion
                const newVersion = event.newVersion

                logger.info('ServiceWorker', '🔧 [Service Worker] 数据库升级', {
                    from: oldVersion,
                    to: newVersion
                })

                try {
                    this._createStores(db)
                    logger.info('ServiceWorker', '✅ [Service Worker] 表结构创建完成')
                } catch (error) {
                    logger.error('ServiceWorker', '❌ [Service Worker] 表结构创建失败:', error)
                    throw error
                }
            }

            request.onblocked = () => {
                logger.warn('ServiceWorker', '⚠️ [Service Worker] 升级被阻塞，其他标签页可能正在使用数据库')
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
            bookmarkStore.createIndex('pathIds', 'pathIds', { unique: false, multiEntry: true })
            bookmarkStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true })
            bookmarkStore.createIndex('tags', 'tags', { unique: false, multiEntry: true })
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
            const historyStore = db.createObjectStore(DB_CONFIG.STORES.SEARCH_HISTORY, {
                keyPath: 'id',
                autoIncrement: true
            })
            historyStore.createIndex('query', 'query', { unique: false })
            historyStore.createIndex('timestamp', 'timestamp', { unique: false })
            historyStore.createIndex('source', 'source', { unique: false })
            logger.info('ServiceWorker', '✅ [Service Worker] 搜索历史表创建完成')
        }

        // 创建图标缓存表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_CACHE)) {
            logger.info('ServiceWorker', '📊 [Service Worker] 创建图标缓存表...')
            const faviconStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_CACHE, {
                keyPath: 'domain'
            })
            faviconStore.createIndex('timestamp', 'timestamp', { unique: false })
            faviconStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
            faviconStore.createIndex('accessCount', 'accessCount', { unique: false })
            faviconStore.createIndex('bookmarkCount', 'bookmarkCount', { unique: false })
            faviconStore.createIndex('isPopular', 'isPopular', { unique: false })
            faviconStore.createIndex('quality', 'quality', { unique: false })
            faviconStore.createIndex('expiresAt', 'expiresAt', { unique: false })
            logger.info('ServiceWorker', '✅ [Service Worker] 图标缓存表创建完成')
        }

        // 创建图标统计表
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FAVICON_STATS)) {
            logger.info('ServiceWorker', '📊 [Service Worker] 创建图标统计表...')
            const faviconStatsStore = db.createObjectStore(DB_CONFIG.STORES.FAVICON_STATS, {
                keyPath: 'key'
            })
            faviconStatsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
            logger.info('ServiceWorker', '✅ [Service Worker] 图标统计表创建完成')
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

    _ensureDB() {
        if (!this.db) {
            throw new Error('IndexedDB未初始化，请先调用initialize()')
        }
        return this.db
    }

    // 批量插入书签
    async insertBookmarks(bookmarks) {
        const db = this._ensureDB()
        const batchSize = 1000

        logger.info('ServiceWorker', `📥 [Service Worker] 开始批量插入 ${bookmarks.length} 条书签...`)
        const startTime = performance.now()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)

            let processed = 0

            transaction.oncomplete = () => {
                const duration = performance.now() - startTime
                logger.info('ServiceWorker', `✅ [Service Worker] 批量插入完成: ${processed}/${bookmarks.length} 条书签, 耗时: ${duration.toFixed(2)}ms`)
                resolve()
            }

            transaction.onerror = () => {
                logger.error('ServiceWorker', '❌ [Service Worker] 批量插入失败:', transaction.error)
                reject(transaction.error)
            }

            // 修复：直接在单个事务中处理所有数据，避免异步分批导致事务结束
            try {
                for (let i = 0; i < bookmarks.length; i++) {
                    const bookmark = bookmarks[i]
                    const request = store.put(bookmark)

                    request.onsuccess = () => {
                        processed++

                        if (processed % 500 === 0) {
                            logger.info('ServiceWorker', `📊 [Service Worker] 插入进度: ${processed}/${bookmarks.length}`)
                        }
                    }

                    request.onerror = () => {
                        logger.error('ServiceWorker', `❌ [Service Worker] 插入书签失败: ${bookmark.id}`, request.error)
                    }
                }

                logger.info('ServiceWorker', `🚀 [Service Worker] 已提交 ${bookmarks.length} 条书签到事务队列`)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [Service Worker] 批量插入过程中发生错误:', error)
                transaction.abort()
            }
        })
    }

    // 获取所有书签
    async getAllBookmarks() {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
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
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
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
                    updated.tags = Array.from(new Set(updated.tags.map(t => String(t).trim()).filter(Boolean)))
                }

                const putReq = store.put(updated)
                putReq.onsuccess = () => resolve(true)
                putReq.onerror = () => reject(putReq.error)
            }
            getReq.onerror = () => reject(getReq.error)
        })
    }

    // 根据父ID获取子书签
    async getChildrenByParentId(parentId) {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
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
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

        if (searchTerms.length === 0) {
            return []
        }

        const { limit = 100, minScore = 0 } = options

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.BOOKMARKS)
            const results = []

            const request = store.openCursor()

            request.onsuccess = () => {
                const cursor = request.result

                if (cursor && results.length < limit) {
                    const bookmark = cursor.value
                    const searchResult = this._calculateSearchScore(bookmark, searchTerms, options)

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

    _calculateSearchScore(bookmark, searchTerms, options) {
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

            // 关键词匹配
            if (bookmark.keywords && bookmark.keywords.some(keyword => keyword.includes(term))) {
                score += 15
                matchedFields.push('keywords')
                if (!highlights.keywords) highlights.keywords = []
                highlights.keywords.push(term)
            }

            // 标签匹配
            if (bookmark.tags && bookmark.tags.some(tag => tag.toLowerCase().includes(term))) {
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.BOOKMARKS], 'readwrite')
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.GLOBAL_STATS], 'readwrite')
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.GLOBAL_STATS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.GLOBAL_STATS)
            const request = store.get('basic')

            request.onsuccess = () => {
                const result = request.result
                if (result) {
                    const { key, ...stats } = result
                    resolve(stats)
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
    async addSearchHistory(query, results, executionTime = 0, source = 'management') {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readwrite')
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
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readonly')
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
            const transaction = db.transaction([DB_CONFIG.STORES.SEARCH_HISTORY], 'readwrite')
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readwrite')
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
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readonly')
            const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS)
            const request = store.get(key)

            request.onsuccess = () => {
                const result = request.result
                resolve(result ? result.value : null)
            }

            request.onerror = () => {
                reject(request.error)
            }
        })
    }

    // 删除设置
    async deleteSetting(key) {
        const db = this._ensureDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([DB_CONFIG.STORES.SETTINGS], 'readwrite')
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

            const missingStores = expectedStores.filter(store => !existingStores.includes(store))
            const extraStores = existingStores.filter(store => !expectedStores.includes(store))

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

        const getStoreCount = (storeName) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly')
                const store = transaction.objectStore(storeName)
                const request = store.count()

                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
        }

        try {
            const [bookmarkCount, faviconCount, searchHistoryCount, settingsCount] = await Promise.all([
                getStoreCount(DB_CONFIG.STORES.BOOKMARKS),
                getStoreCount(DB_CONFIG.STORES.FAVICON_CACHE),
                getStoreCount(DB_CONFIG.STORES.SEARCH_HISTORY),
                getStoreCount(DB_CONFIG.STORES.SETTINGS)
            ])

            const totalSize = bookmarkCount * 1000 + faviconCount * 2000 + searchHistoryCount * 100 + settingsCount * 50

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

class ServiceWorkerBookmarkPreprocessor {
    constructor() {
        this.urlRegex = /^https?:\/\//
        this.domainRegex = /^https?:\/\/([^\/]+)/
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
            logger.info('ServiceWorker', `📊 [预处理器] 扁平化完成: ${flatBookmarks.length} 个节点`)

            // 3. 增强处理
            const enhancedBookmarks = this._enhanceBookmarks(flatBookmarks)

            // 4. 生成统计信息
            const stats = this._generateStats(enhancedBookmarks)

            const endTime = performance.now()
            const processingTime = endTime - startTime

            logger.info('ServiceWorker', `✅ [预处理器] 处理完成: ${enhancedBookmarks.length} 条记录, 耗时: ${processingTime.toFixed(2)}ms`)

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
            throw new Error(`获取书签树失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    _flattenBookmarks(tree, parentPath = [], parentIds = []) {
        const flattened = []

        for (const node of tree) {
            if (node.id === '0') {
                if (node.children) {
                    flattened.push(...this._flattenBookmarks(node.children, [], []))
                }
                continue
            }

            flattened.push({
                ...node,
                _parentPath: parentPath,
                _parentIds: parentIds
            })

            if (node.children && node.children.length > 0) {
                const childPath = [...parentPath, node.title]
                const childIds = [...parentIds, node.id]
                flattened.push(...this._flattenBookmarks(node.children, childPath, childIds))
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

        for (let i = 0; i < flatBookmarks.length; i++) {
            const node = flatBookmarks[i]

            if (i % 100 === 0) {
                logger.info('ServiceWorker', `📊 [预处理器] 增强进度: ${i}/${flatBookmarks.length}`)
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

        let domain, urlLower
        if (node.url) {
            urlLower = node.url.toLowerCase()
            const domainMatch = node.url.match(this.domainRegex)
            if (domainMatch) {
                domain = domainMatch[1].toLowerCase()
            }
        }

        const keywords = this._generateKeywords(node.title, node.url, domain)
        const { bookmarksCount, folderCount, childrenCount } = this._calculateCounts(children, childrenMap)
        const category = this._analyzeCategory(node.title, node.url, domain)

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

            titleLower: node.title.toLowerCase(),
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

            createdYear: node.dateAdded ? new Date(node.dateAdded).getFullYear() : new Date().getFullYear(),
            createdMonth: node.dateAdded ? new Date(node.dateAdded).getMonth() + 1 : new Date().getMonth() + 1,
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

    _calculateCounts(children, childrenMap) {
        let bookmarksCount = 0
        let folderCount = 0
        const childrenCount = children.length

        for (const child of children) {
            if (child.url) {
                bookmarksCount++
            } else {
                folderCount++
                const grandChildren = childrenMap.get(child.id) || []
                const subCounts = this._calculateCounts(grandChildren, childrenMap)
                bookmarksCount += subCounts.bookmarksCount
                folderCount += subCounts.folderCount
            }
        }

        return { bookmarksCount, folderCount, childrenCount }
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

    _analyzeCategory(title, url, domain) {
        const titleLower = title.toLowerCase()
        const urlLower = url?.toLowerCase() || ''

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'github', 'stackoverflow', 'developer', 'api', 'documentation', 'code', 'programming',
            'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java', 'css', 'html'
        ])) {
            return 'technology'
        }

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'news', 'article', 'blog', 'medium', 'zhihu', 'juejin', '新闻', '文章', '博客'
        ])) {
            return 'news'
        }

        if (this._matchesKeywords(titleLower + ' ' + urlLower, [
            'tool', 'utility', 'service', 'app', 'software', '工具', '应用', '服务'
        ])) {
            return 'tools'
        }

        return undefined
    }

    _matchesKeywords(text, keywords) {
        return keywords.some(keyword => text.includes(keyword))
    }

    _categorizeDomain(domain) {
        if (['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com', 'weibo.com'].includes(domain)) {
            return 'social'
        }
        if (['github.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com'].includes(domain)) {
            return 'tech'
        }
        if (['bbc.com', 'cnn.com', 'nytimes.com', 'reuters.com', 'xinhuanet.com'].includes(domain)) {
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
                domainCounts.set(bookmark.domain, (domainCounts.get(bookmark.domain) || 0) + 1)
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
                categoryDistribution.set(bookmark.category, (categoryDistribution.get(bookmark.category) || 0) + 1)
            }
        })

        const urlCounts = new Map()
        urlBookmarks.forEach(bookmark => {
            if (bookmark.url) {
                urlCounts.set(bookmark.url, (urlCounts.get(bookmark.url) || 0) + 1)
            }
        })
        const duplicateUrls = Array.from(urlCounts.values()).filter(count => count > 1).length

        const emptyFolders = folderBookmarks.filter(folder => folder.childrenCount === 0).length
        const maxDepth = Math.max(...bookmarks.map(b => b.depth), 0)

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
                estimatedBytes: JSON.stringify(bookmarks).length
            },
            lastUpdated: Date.now(),
            version: CURRENT_DATA_VERSION
        }
    }

    _generateDataHash(data) {
        try {
            const simplified = this._simplifyDataForHash(data)
            const jsonString = JSON.stringify(simplified)

            if (!jsonString || jsonString === 'undefined' || jsonString === 'null' || jsonString === '[]') {
                return `empty_${Date.now()}`
            }

            return this._simpleHash(jsonString)
        } catch (error) {
            logger.error('ServiceWorker', '❌ [预处理器] 生成数据哈希失败:', error)
            return `error_${Date.now()}`
        }
    }

    _simplifyDataForHash(data) {
        if (!data) return null

        if (Array.isArray(data)) {
            return data.map(item => this._simplifyDataForHash(item))
        }

        if (typeof data === 'object') {
            const simplified = {}
            for (const [key, value] of Object.entries(data)) {
                if (['id', 'title', 'url', 'parentId', 'dateAdded'].includes(key)) {
                    simplified[key] = value
                }
            }
            return simplified
        }

        return data
    }

    _simpleHash(str) {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(36)
    }
}

// ==================== 书签管理服务 ====================

class BookmarkManagerService {
    constructor() {
        this.dbManager = new ServiceWorkerIndexedDBManager()
        this.preprocessor = new ServiceWorkerBookmarkPreprocessor()
        this.isReady = false
        this.lastSyncTime = 0
        this.lastDataHash = null
    }

    async initialize() {
        logger.info('ServiceWorker', '🚀 [书签管理服务] 初始化开始...')

        try {
            // 1. 初始化数据库
            await this.dbManager.initialize()

            // 2. 检查是否需要首次数据加载
            const stats = await this.dbManager.getGlobalStats()
            if (!stats) {
                logger.info('ServiceWorker', '📊 [书签管理服务] 首次使用，加载书签数据...')
                await this.loadBookmarkData()
            } else {
                logger.info('ServiceWorker', '📊 [书签管理服务] 数据已存在，检查是否需要同步...')
                await this.checkAndSync()
            }

            this.isReady = true
            logger.info('ServiceWorker', '✅ [书签管理服务] 初始化完成')

            // 3. 启动定期同步
            this.startPeriodicSync()

        } catch (error) {
            logger.error('ServiceWorker', '❌ [书签管理服务] 初始化失败:', error)
            throw error
        }
    }

    async loadBookmarkData() {
        logger.info('ServiceWorker', '🔄 [书签管理服务] 重新加载书签数据...')

        try {
            // 1. 预处理书签数据
            const result = await this.preprocessor.processBookmarks()

            // 2. 清空现有数据
            await this.dbManager.clearAllBookmarks()

            // 3. 批量插入新数据
            await this.dbManager.insertBookmarks(result.bookmarks)

            // 4. 更新统计信息
            await this.dbManager.updateGlobalStats(result.stats)

            // 5. 更新状态
            this.lastDataHash = result.metadata.originalDataHash
            this.lastSyncTime = Date.now()

            logger.info('ServiceWorker', '✅ [书签管理服务] 书签数据加载完成')

        } catch (error) {
            logger.error('ServiceWorker', '❌ [书签管理服务] 加载书签数据失败:', error)
            throw error
        }
    }

    async checkAndSync() {
        try {
            // 简化的同步检查：直接重新加载
            // 在生产环境中，这里可以实现更精细的增量同步
            const chromeTree = await this.preprocessor._getChromeBookmarks()
            const currentHash = this.preprocessor._generateDataHash(chromeTree)

            if (currentHash !== this.lastDataHash) {
                logger.info('ServiceWorker', '🔄 [书签管理服务] 检测到Chrome书签变化，开始同步...')
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
            chrome.alarms.create('AcuityBookmarksPeriodicSync', { periodInMinutes: periodMinutes })
            logger.info('ServiceWorker', `🔄 [书签管理服务] 定期同步已启动（chrome.alarms），间隔: ${periodMinutes} 分钟`)
        } catch (error) {
            logger.warn('ServiceWorker', '⚠️ [书签管理服务] 创建 alarms 失败，回退至 setInterval:', error)
            setInterval(async () => {
                try {
                    await this.checkAndSync()
                } catch (err) {
                    logger.warn('ServiceWorker', '⚠️ [书签管理服务] 定期同步失败:', err)
                }
            }, SYNC_INTERVAL)
        }
    }

    // 健康检查
    async healthCheck() {
        try {
            await this.dbManager._ensureDB()
            const stats = await this.dbManager.getGlobalStats()

            return {
                success: true,
                ready: this.isReady && !!stats,
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
        return this.dbManager.addSearchHistory(query, results, executionTime, source)
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
        return this.checkAndSync()
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
                case 'HEALTH_CHECK':
                    return await bookmarkManager.healthCheck()

                case 'GET_ALL_BOOKMARKS':
                    const bookmarks = await bookmarkManager.getAllBookmarks()
                    return { success: true, data: bookmarks }

                case 'GET_BOOKMARK_BY_ID':
                    const bookmark = await bookmarkManager.getBookmarkById(data.id)
                    return { success: true, data: bookmark }

                case 'GET_CHILDREN_BY_PARENT_ID':
                    const children = await bookmarkManager.getChildrenByParentId(data.parentId)
                    return { success: true, data: children }

                case 'SEARCH_BOOKMARKS':
                    const results = await bookmarkManager.searchBookmarks(data.query, data.options)
                    return { success: true, data: results }

                case 'GET_GLOBAL_STATS':
                    const stats = await bookmarkManager.getGlobalStats()
                    return { success: true, data: stats }

                case 'GET_BOOKMARK_STATS':
                    // 别名：与GET_GLOBAL_STATS相同，返回书签统计数据
                    const bookmarkStats = await bookmarkManager.getGlobalStats()
                    return { success: true, data: bookmarkStats }

                case 'SYNC_BOOKMARKS':
                    const changed = await bookmarkManager.syncBookmarks()
                    return { success: true, data: { changed } }

                case 'FORCE_RELOAD_DATA':
                    await bookmarkManager.forceReload()
                    return { success: true }

                case 'GET_DATABASE_HEALTH':
                    const health = await bookmarkManager.getDatabaseHealth()
                    return { success: true, data: health }

                case 'TOGGLE_SIDEPANEL':
                    // 🎯 已移除：Popup现在直接调用Chrome API以保持用户手势
                    logger.warn('ServiceWorker', '⚠️ TOGGLE_SIDEPANEL消息已弃用，Popup应直接调用Chrome API')
                    return { success: false, error: 'TOGGLE_SIDEPANEL已弃用' }

                case 'GET_DATABASE_STATS':
                    const dbStats = await bookmarkManager.getDatabaseStats()
                    return { success: true, data: dbStats }

                case 'GET_SEARCH_HISTORY':
                    const history = await bookmarkManager.getSearchHistory(data.limit)
                    return { success: true, data: history }

                case 'ADD_SEARCH_HISTORY':
                    await bookmarkManager.addSearchHistory(data.query, data.resultCount, data.executionTime, data.source)
                    return { success: true }

                case 'CLEAR_SEARCH_HISTORY':
                    await bookmarkManager.clearSearchHistory()
                    return { success: true }

                case 'GET_SETTING':
                    const setting = await bookmarkManager.getSetting(data.key)
                    return { success: true, data: setting }

                case 'SAVE_SETTING':
                    await bookmarkManager.saveSetting(data.key, data.value, undefined, data.description)
                    return { success: true }

                case 'DELETE_SETTING':
                    await bookmarkManager.deleteSetting(data.key)
                    return { success: true }

                case 'OPEN_MANAGEMENT_PAGE':
                    // 打开管理页面
                    const managementUrl = chrome.runtime.getURL('management.html')
                    await chrome.tabs.create({ url: managementUrl })
                    return { success: true }

                case 'SHOW_MANAGEMENT_PAGE_AND_ORGANIZE':
                    // 打开管理页面并启动AI整理
                    const aiManagementUrl = chrome.runtime.getURL('management.html')
                    await chrome.tabs.create({ url: aiManagementUrl })
                    // TODO: 在管理页面打开后，可以发送消息启动AI整理功能
                    return { success: true }

                case 'PREPARE_MANAGEMENT_DATA':
                    // 准备管理页面数据（确保IndexedDB已初始化）
                    const healthStatus = await bookmarkManager.healthCheck()
                    return healthStatus

                case 'BATCH_GENERATE_TAGS':
                    // 批量为所有书签生成标签；data.force 为 true 时覆盖已有标签
                    const res = await batchGenerateTagsForAllBookmarks({ force: Boolean(data?.force) })
                    return res

                case 'GENERATE_EMBEDDINGS':
                    // 批量为所有书签生成嵌入；data.force 为 true 时覆盖已有嵌入
                    const er = await batchGenerateEmbeddingsForAllBookmarks({ force: Boolean(data?.force) })
                    return er

                case 'SEARCH_SEMANTIC':
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

                case 'VECTORIZE_SYNC':
                    // 将本地IndexedDB中的嵌入向量批量同步到 Cloudflare Vectorize
                    try {
                        const allEmbeds = await bookmarkManager.dbManager.getAllEmbeddings()
                        const vectors = allEmbeds.map(rec => ({
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
                        })).filter(v => Array.isArray(v.values) && v.values.length > 0)

                        if (!vectors.length) return { success: true, data: { upserted: 0, batches: 0 } }

                        const batchSize = Number(data?.batchSize || 300)
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
                                    const resp = await fetchJsonWithTimeout(`${base}/api/vectorize/upsert`, {
                                        method: 'POST',
                                        body: JSON.stringify({ vectors: chunk })
                                    }, Number(data?.timeout || 20000))
                                    if (resp && resp.success) {
                                        const affected = Array.isArray(resp?.mutation?.ids) ? resp.mutation.ids.length : (Array.isArray(resp?.mutation) ? resp.mutation.length : chunk.length)
                                        upserted += affected
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
                        return { success: true, data: { upserted, batches: chunks.length } }
                    } catch (e) {
                        return { success: false, error: e?.message || String(e) }
                    }

                case 'VECTORIZE_QUERY':
                    // 代理 Cloudflare Vectorize 查询，返回匹配结果基本信息
                    try {
                        const query = String(data?.query || '')
                        const topK = Number(data?.topK || 10)
                        const returnMetadata = data?.returnMetadata || 'indexed'
                        const returnValues = Boolean(data?.returnValues)

                        for (const base of AI_BASE_CANDIDATES) {
                            try {
                                const resp = await fetchJsonWithTimeout(`${base}/api/vectorize/query`, {
                                    method: 'POST',
                                    body: JSON.stringify({ text: query, topK, returnMetadata, returnValues })
                                }, Number(data?.timeout || 15000))
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
                            } catch (err) {
                                // 继续尝试下一个base
                            }
                        }
                        throw new Error('Vectorize query failed')
                    } catch (e) {
                        return { success: false, error: e?.message || String(e) }
                    }

                default:
                    throw new Error(`未知消息类型: ${type}`)
            }
        } catch (error) {
            logger.error('ServiceWorker', `❌ [Service Worker] 处理消息失败 ${type}:`, error)
            return { success: false, error: error.message }
        }
    }

    // 异步处理消息
    handleMessage().then(response => {
        logger.info('ServiceWorker', `📤 [Service Worker] 响应消息 ${type}:`, response)
        sendResponse(response)
    }).catch(error => {
        logger.error('ServiceWorker', `❌ [Service Worker] 消息处理异常 ${type}:`, error)
        sendResponse({ success: false, error: error.message })
    })

    // 返回true表示异步响应
    return true
})

// ==================== Service Worker生命周期 ====================

// Service Worker安装事件
self.addEventListener('install', (event) => {
    logger.info('ServiceWorker', '🚀 [Service Worker] 安装中...')
    self.skipWaiting()
})

// Service Worker激活事件
self.addEventListener('activate', (event) => {
    logger.info('ServiceWorker', '🚀 [Service Worker] 激活中...')
    event.waitUntil(
        Promise.all([
            clients.claim(),
            setupBookmarkEventListeners()
        ])
    )
})

// ==================== 实时书签同步 ====================

/**
 * 设置书签事件监听器 - Phase 1实现
 */
async function setupBookmarkEventListeners() {
    try {
        logger.info('ServiceWorker', '🔄 [Service Worker] 设置书签实时同步监听器...')

        // 监听书签创建
        chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
            logger.info('ServiceWorker', '📝 [书签同步] 书签已创建:', bookmark.title)
            try {
                await handleBookmarkChange('created', id, bookmark)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 处理创建事件失败:', error)
            }
        })

        // 监听书签删除  
        chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
            logger.info('ServiceWorker', '🗑️ [书签同步] 书签已删除:', id)
            try {
                await handleBookmarkChange('removed', id, removeInfo)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 处理删除事件失败:', error)
            }
        })

        // 监听书签修改
        chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
            logger.info('ServiceWorker', '✏️ [书签同步] 书签已修改:', changeInfo.title)
            try {
                await handleBookmarkChange('changed', id, changeInfo)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 处理修改事件失败:', error)
            }
        })

        // 监听书签移动
        chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
            logger.info('ServiceWorker', '📁 [书签同步] 书签已移动:', id)
            try {
                await handleBookmarkChange('moved', id, moveInfo)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 处理移动事件失败:', error)
            }
        })

        // 监听子项重排序
        chrome.bookmarks.onChildrenReordered.addListener(async (id, reorderInfo) => {
            logger.info('ServiceWorker', '🔢 [书签同步] 子项已重排序:', id)
            try {
                await handleBookmarkChange('reordered', id, reorderInfo)
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 处理重排序事件失败:', error)
            }
        })

        // 监听导入开始/结束
        chrome.bookmarks.onImportBegan.addListener(() => {
            logger.info('ServiceWorker', '📥 [书签同步] 书签导入开始...')
            bookmarkImportInProgress = true
        })

        chrome.bookmarks.onImportEnded.addListener(async () => {
            logger.info('ServiceWorker', '✅ [书签同步] 书签导入完成，重新同步数据...')
            bookmarkImportInProgress = false
            try {
                // 导入完成后，重新处理所有书签数据
                await invalidateBookmarkCache()
            } catch (error) {
                logger.error('ServiceWorker', '❌ [书签同步] 导入后同步失败:', error)
            }
        })

        logger.info('ServiceWorker', '✅ [Service Worker] 书签实时同步监听器设置完成')
    } catch (error) {
        logger.error('ServiceWorker', '❌ [Service Worker] 设置书签监听器失败:', error)
    }
}

// 书签导入状态标记
let bookmarkImportInProgress = false

/**
 * 处理书签变更事件
 */
async function handleBookmarkChange(eventType, id, data) {
    // 如果正在导入，跳过单个事件处理，等导入完成统一处理
    if (bookmarkImportInProgress) {
        logger.info('ServiceWorker', `⏸️ [书签同步] 导入进行中，跳过 ${eventType} 事件: ${id}`)
        return
    }

    try {
        logger.info('ServiceWorker', `📢 [书签同步] 处理 ${eventType} 事件:`, { id, data })

        // 对于书签创建和标题或URL变更，触发AI标签生成
        if (
            (eventType === 'created' && data.url) ||
            (eventType === 'changed' && (data.title || data.url))
        ) {
            try {
                const bookmarkId = id;
                // 延迟一小段时间，确保书签节点已完全可用
                await new Promise(resolve => setTimeout(resolve, 100));
                
                    const bookmarkNodes = await chrome.bookmarks.get(bookmarkId);
                    if (bookmarkNodes && bookmarkNodes.length > 0) {
                        const bookmark = bookmarkNodes[0];
                    const generatedTags = await generateTagsSmart(bookmark.title, bookmark.url);

                        if (generatedTags && generatedTags.length > 0) {
                            // 从数据库获取现有书签
                            const existingBookmark = await bookmarkManager.dbManager.getBookmarkById(bookmarkId);
                            if (existingBookmark) {
                                // 合并新旧标签，去重
                                const existingTags = existingBookmark.tags || [];
                                const newTags = [...new Set([...existingTags, ...generatedTags])];
                                
                                // 更新书签
                                await bookmarkManager.dbManager.updateBookmark(bookmarkId, { tags: newTags });
                                log.debug(`Bookmark ${bookmarkId} updated with AI tags:`, newTags);
                            }
                        }
                    }
            } catch (error) {
                log.error(`Error generating AI tags for bookmark ${id}:`, error);
            }
        }

        // Phase 1: 简单的缓存失效策略
        await invalidateBookmarkCache()

        // 通知前端页面数据已更新
        notifyFrontendBookmarkUpdate(eventType, id, data)

        // TODO: Phase 2 可以添加更智能的增量更新逻辑

    } catch (error) {
        logger.error('ServiceWorker', `❌ [书签同步] 处理 ${eventType} 事件失败:`, error)
    }
}

/**
 * 批量为所有书签生成标签并写入IndexedDB
 * - 默认仅为无标签的书签生成；传入 force=true 则覆盖更新
 * - 顺序处理以降低AI请求压力
 */
async function batchGenerateTagsForAllBookmarks({ force = false } = {}) {
    try {
        logger.info('ServiceWorker', '🚀 [批量标签] 开始为所有书签生成标签...', { force })
        const all = await bookmarkManager.dbManager.getAllBookmarks()
        let processed = 0, updated = 0

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
                logger.warn('ServiceWorker', '⚠️ [批量标签] 单项生成失败:', b?.id, err?.message || err)
            }

            processed++
            // 适度让出事件循环，避免阻塞
            if (processed % 25 === 0) await new Promise(r => setTimeout(r, 10))
        }

        // 刷新缓存并通知前端
        await invalidateBookmarkCache()
        notifyFrontendBookmarkUpdate('batch-tags-generated', 'all', { force })

        logger.info('ServiceWorker', `✅ [批量标签] 完成。处理: ${processed}, 更新: ${updated}`)
        return { success: true, processed, updated }
    } catch (error) {
        logger.error('ServiceWorker', '❌ [批量标签] 执行失败:', error)
        return { success: false, error: error?.message || String(error) }
    }
}

// 批量生成并存储所有书签的嵌入向量
async function batchGenerateEmbeddingsForAllBookmarks({ force = false } = {}) {
    try {
        await dbManager.initialize()
        const bookmarks = await dbManager.getAllBookmarks()
        const targets = bookmarks.filter(b => !b.isFolder && (force || !b.__hasEmbedding))

        let processed = 0
        const start = Date.now()

        for (const bk of targets) {
            const text = `${bk.title} ${bk.url || ''}`.trim()
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
                updatedAt: Date.now()
            }
            await dbManager.saveEmbedding(record)
            processed++
            // 标记存在嵌入以便下次跳过（仅内存属性，不写入）
            bk.__hasEmbedding = true
        }

        const duration = Date.now() - start
        return { success: true, processed, total: targets.length, duration }
    } catch (error) {
        logger.error('ServiceWorker', '❌ [AI] 批量生成嵌入失败:', error)
        return { success: false, error: error.message }
    }
}

/**
 * 失效书签缓存
 */
async function invalidateBookmarkCache() {
    try {
        logger.info('ServiceWorker', '🔄 [书签同步] 开始刷新书签数据...')

        // 重新处理书签数据
        const preprocessor = new ServiceWorkerBookmarkPreprocessor()
        await preprocessor.processBookmarks()

        logger.info('ServiceWorker', '✅ [书签同步] 书签数据刷新完成')
    } catch (error) {
        logger.error('ServiceWorker', '❌ [书签同步] 刷新书签数据失败:', error)
        throw error
    }
}

/**
 * 通知前端页面书签更新
 */
function notifyFrontendBookmarkUpdate(eventType, id, data) {
    try {
        // 广播消息给所有页面
        chrome.runtime.sendMessage({
            type: 'BOOKMARK_UPDATED',
            eventType,
            id,
            data,
            timestamp: Date.now()
        }).catch(error => {
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
chrome.commands.onCommand.addListener((command) => {
    logger.info('ServiceWorker', `🎯 [Service Worker] 快捷键命令: ${command}`)

    switch (command) {
        case 'open-side-panel':
            // 打开侧边栏
            openSidePanel()
            break

        case 'open-management':
            // 打开管理页面
            openManagementPage()
            break

        case 'search-bookmarks':
            // 打开搜索页面
            openSearchPage()
            break

        case 'smart-bookmark':
            // 打开管理页面并启动AI整理
            openManagementPageWithAI()
            break

        default:
            logger.warn('ServiceWorker', `⚠️ [Service Worker] 未知快捷键命令: ${command}`)
    }
})

// 侧边栏状态管理
let sidePanelState = {
    isEnabled: true,
    windowId: null
}

// 🎯 核心切换逻辑 - popup和快捷键共享
async function toggleSidePanelCore(source = 'unknown') {
    try {
        logger.info('ServiceWorker', `🚀 [${source}] 执行侧边栏切换逻辑...`)

        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (!currentTab?.windowId) {
            throw new Error('无法获取当前窗口信息')
        }

        // 检查当前侧边栏状态
        const currentOptions = await chrome.sidePanel.getOptions({ tabId: currentTab.id })
        const isCurrentlyEnabled = currentOptions.enabled

        logger.info('ServiceWorker', `📊 [${source}] 当前侧边栏状态:`, { enabled: isCurrentlyEnabled })

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
        logger.error('ServiceWorker', `❌ [${source}] 切换侧边栏失败:`, error.message)

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
    // 🎯 直接调用核心切换逻辑
    await toggleSidePanelCore('快捷键')
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

async function openSearchPage() {
    try {
        logger.info('ServiceWorker', '🚀 [快捷键] 打开搜索页面...')
        const searchUrl = chrome.runtime.getURL('search-popup.html')
        await chrome.tabs.create({ url: searchUrl })
        logger.info('ServiceWorker', '✅ [快捷键] 搜索页面已打开')
    } catch (error) {
        logger.error('ServiceWorker', '❌ [快捷键] 打开搜索页面失败:', error)
    }
}

async function openManagementPageWithAI() {
    try {
        logger.info('ServiceWorker', '🚀 [快捷键] 打开管理页面并启动AI整理...')
        const aiManagementUrl = chrome.runtime.getURL('management.html?mode=ai')
        await chrome.tabs.create({ url: aiManagementUrl })
        logger.info('ServiceWorker', '✅ [快捷键] AI管理页面已打开')
    } catch (error) {
        logger.error('ServiceWorker', '❌ [快捷键] 打开AI管理页面失败:', error)
    }
}

// ==================== 上下文菜单管理 ====================

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
            id: 'open-search',
            title: '🔍 搜索书签',
            contexts: ['page', 'selection', 'link', 'image']
        })

        chrome.contextMenus.create({
            id: 'ai-organize',
            title: '🤖 AI整理书签',
            contexts: ['page', 'selection', 'link', 'image']
        })

        logger.info('ServiceWorker', '✅ [Service Worker] 上下文菜单创建完成')

    } catch (error) {
        logger.error('ServiceWorker', '❌ [Service Worker] 创建上下文菜单失败:', error)
    }
}

// 🎯 侧边栏状态跟踪（因为Chrome没有提供直接的"是否打开"API）
let sidePanelOpenState = {
    isOpen: false,
    windowId: null,
    tabId: null
}

// 🎯 监听侧边栏打开事件（Chrome 114+）
if (chrome.sidePanel && chrome.sidePanel.onOpened) {
    chrome.sidePanel.onOpened.addListener((info) => {
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

        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (!currentTab?.windowId) {
            throw new Error('无法获取当前窗口信息')
        }

        // 🎯 根据官方文档：不依赖enabled状态，采用"总是尝试打开"策略
        // 因为Chrome没有直接的"是否打开"API，我们采用简化策略

        logger.info('ServiceWorker', `📊 [${source}] 当前跟踪状态:`, sidePanelOpenState)

        if (sidePanelOpenState.isOpen && sidePanelOpenState.windowId === currentTab.windowId) {
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
                logger.warn('ServiceWorker', `⚠️ [${source}] 直接打开失败:`, openError.message)

                // 如果是用户手势问题，回退到新标签页
                if (openError.message.includes('user gesture')) {
                    throw new Error('用户手势限制')
                }
                throw openError
            }
        }

    } catch (error) {
        logger.error('ServiceWorker', `❌ [${source}] 侧边栏操作失败:`, error.message)

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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        logger.info('ServiceWorker', `🎯 [Service Worker] 上下文菜单点击:`, info.menuItemId)

        switch (info.menuItemId) {
            case 'toggle-sidepanel':
                // 🎯 右键菜单侧边栏切换 - 智能处理用户手势限制
                logger.info('ServiceWorker', '📋 [右键菜单] 尝试切换侧边栏...')
                try {
                    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

                    if (currentTab?.windowId) {
                        // 尝试直接打开侧边栏
                        await chrome.sidePanel.setOptions({
                            tabId: currentTab.id,
                            path: 'side-panel.html',
                            enabled: true
                        })

                        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
                        await chrome.sidePanel.open({ windowId: currentTab.windowId })
                    } else {
                        throw new Error('无法获取当前窗口信息')
                    }
                } catch (error) {
                    logger.warn('ServiceWorker', '⚠️ [右键菜单] 侧边栏直接打开失败:', error.message)

                    // 智能提示：告诉用户其他打开方式
                    if (error.message.includes('user gesture') || error.message.includes('gesture')) {
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

            case 'open-search':
                // 打开搜索页面
                await openSearchPage()
                break

            case 'ai-organize':
                // 打开AI整理页面
                await openManagementPageWithAI()
                break

            default:
                logger.warn('ServiceWorker', `⚠️ [Service Worker] 未知菜单项: ${info.menuItemId}`)
        }

    } catch (error) {
        logger.error('ServiceWorker', '❌ [Service Worker] 处理上下文菜单点击失败:', error)

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
chrome.runtime.onInstalled.addListener(() => {
    // 设置侧边栏基本配置
    chrome.sidePanel.setOptions({
        path: 'side-panel.html',
        enabled: true
    }).catch(err => {
        logger.warn('ServiceWorker', '⚠️ [Service Worker] 侧边栏初始配置失败:', err)
    })

    // 创建上下文菜单
    createContextMenus()
})

// ==================== 初始化 ====================

// 立即初始化
bookmarkManager.initialize().catch(error => {
    logger.error('ServiceWorker', '❌ [Service Worker] 初始化失败:', error)
})

// 监听 alarms 定时任务
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm?.name === 'AcuityBookmarksPeriodicSync') {
        try {
            await bookmarkManager.checkAndSync()
        } catch (error) {
            logger.warn('ServiceWorker', '⚠️ [书签管理服务] alarms 同步失败:', error)
        }
    }
})

logger.info('ServiceWorker', '✅ [Service Worker] AcuityBookmarks Service Worker 已启动')
