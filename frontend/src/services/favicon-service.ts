/**
 * Favicon服务 - 智能域名级缓存系统
 * 解决4个核心问题：
 * 1. 数据分离：独立的域名->favicon映射
 * 2. 智能时机：按需加载 + 智能预加载
 * 3. 高效复用：域名级缓存，避免重复请求
 * 4. 缓存管理：完整的过期和更新机制
 */
import { logger } from '../utils/logger'

export interface FaviconCacheItem {
  url: string // Google Favicon API URL
  timestamp: number // 缓存时间戳
  size: number // 图标尺寸
  lastVerified: number // 最后验证时间
  accessCount: number // 访问次数（用于智能预加载）
}

export interface FaviconCacheData {
  [domain: string]: FaviconCacheItem
}

export enum FaviconLoadPriority {
  IMMEDIATE = 1, // 立即加载（当前可见的）
  HIGH = 2, // 高优先级（展开的文件夹）
  NORMAL = 3, // 普通优先级（搜索结果）
  LOW = 4 // 低优先级（后台预加载热门域名）
}

export class FaviconService {
  private static instance: FaviconService | null = null

  // 内存缓存
  private memoryCache = new Map<string, FaviconCacheItem>()

  // 请求去重：防止同时请求相同域名
  private pendingRequests = new Map<string, Promise<string>>()

  // 配置常量
  private readonly CACHE_FRESH_PERIOD = 7 * 24 * 60 * 60 * 1000 // 7天新鲜期
  private readonly CACHE_VERIFY_PERIOD = 30 * 24 * 60 * 60 * 1000 // 30天验证期
  private readonly STORAGE_KEY = 'acuity_favicon_cache_v2'
  private readonly BATCH_SIZE = 3 // 批量请求大小

  private isInitialized = false

  static getInstance(): FaviconService {
    if (!this.instance) {
      this.instance = new FaviconService()
    }
    return this.instance
  }

  /**
   * 初始化服务，从持久化存储加载缓存
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 检查是否在Chrome扩展环境中
      if (typeof chrome === 'undefined' || !chrome.storage) {
        logger.warn('FaviconService', '不在Chrome扩展环境中，跳过存储加载')
        this.isInitialized = true
        return
      }

      const result = await chrome.storage.local.get(this.STORAGE_KEY)
      if (result[this.STORAGE_KEY]) {
        const cached = JSON.parse(result[this.STORAGE_KEY]) as FaviconCacheData
        const now = Date.now()

        // 加载未过期的缓存
        let loadedCount = 0
        for (const [domain, item] of Object.entries(cached)) {
          if (now - item.timestamp < this.CACHE_VERIFY_PERIOD) {
            this.memoryCache.set(domain, item)
            loadedCount++
          }
        }

        logger.info('FaviconService', `加载缓存: ${loadedCount} 个域名`)
      }
    } catch (error) {
      logger.warn('FaviconService', '初始化失败，将使用内存缓存', error)
    }

    this.isInitialized = true
  }

  /**
   * 获取域名的Favicon URL（核心方法）
   */
  async getFaviconForUrl(
    url: string,
    size: number = 16,
    priority: FaviconLoadPriority = FaviconLoadPriority.NORMAL
  ): Promise<string> {
    await this.initialize()

    try {
      const domain = this.extractDomain(url)
      if (!domain) return ''

      const cacheKey = `${domain}_${size}`

      // 1. 检查内存缓存
      if (this.memoryCache.has(cacheKey)) {
        const cached = this.memoryCache.get(cacheKey)!

        // 更新访问统计
        cached.accessCount++

        // 检查是否在新鲜期内
        if (Date.now() - cached.timestamp < this.CACHE_FRESH_PERIOD) {
          return cached.url
        }

        // 在验证期内，后台验证但立即返回缓存值
        if (Date.now() - cached.timestamp < this.CACHE_VERIFY_PERIOD) {
          // 高优先级时才后台验证，避免过多后台请求
          if (priority <= FaviconLoadPriority.HIGH) {
            this.verifyFaviconInBackground(domain, size, cached)
          }
          return cached.url
        }
      }

      // 2. 检查是否正在请求中（请求去重）
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey)!
      }

      // 3. 发起新请求
      const requestPromise = this.fetchFaviconFromGoogle(domain, size)
      this.pendingRequests.set(cacheKey, requestPromise)

      try {
        const result = await requestPromise
        return result
      } finally {
        this.pendingRequests.delete(cacheKey)
      }
    } catch (error) {
      logger.warn('FaviconService', `获取favicon失败 ${url}`, error)
      return ''
    }
  }

  /**
   * 批量预加载favicon（智能预加载）
   */
  async preloadFavicons(
    urls: string[],
    priority: FaviconLoadPriority = FaviconLoadPriority.LOW
  ): Promise<void> {
    await this.initialize()

    // 收集需要加载的域名（去重且跳过已缓存的）
    const domainsToLoad = new Set<string>()
    urls.forEach(url => {
      const domain = this.extractDomain(url)
      if (domain && !this.isCached(domain)) {
        domainsToLoad.add(domain)
      }
    })

    if (domainsToLoad.size === 0) {
      logger.info('FaviconService', '所有favicon都已缓存，跳过预加载')
      return
    }

    logger.info(
      'FaviconService',
      `开始预加载 ${domainsToLoad.size} 个域名的favicon，优先级: ${FaviconLoadPriority[priority]}`
    )

    // 分批并发加载，避免网络拥塞
    const domains = Array.from(domainsToLoad)
    const batchSize =
      priority === FaviconLoadPriority.IMMEDIATE
        ? this.BATCH_SIZE * 2
        : this.BATCH_SIZE

    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(domain =>
          this.getFaviconForUrl(`https://${domain}`, 16, priority)
        )
      )

      // 低优先级时添加延迟，避免影响用户操作
      if (
        priority === FaviconLoadPriority.LOW &&
        i + batchSize < domains.length
      ) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    logger.info('FaviconService', 'favicon预加载完成')
  }

  /**
   * 从Google API获取favicon - ✅ 优化版 (使用更稳定的服务)
   */
  private async fetchFaviconFromGoogle(
    domain: string,
    size: number
  ): Promise<string> {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`

    // 缓存到内存和持久化存储
    const cacheKey = `${domain}_${size}`
    const cacheItem: FaviconCacheItem = {
      url,
      timestamp: Date.now(),
      size,
      lastVerified: Date.now(),
      accessCount: 1
    }

    this.memoryCache.set(cacheKey, cacheItem)

    // 异步保存到持久化存储（不阻塞）
    this.saveToPersistentStorage()

    return url
  }

  /**
   * 后台验证favicon是否变更
   */
  private async verifyFaviconInBackground(
    domain: string,
    size: number,
    cached: FaviconCacheItem
  ): Promise<void> {
    try {
      // 简单的验证：重新生成URL，如果不同则更新
      const newUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`

      if (newUrl !== cached.url) {
        logger.info('FaviconService', `检测到favicon变更: ${domain}`)
        cached.url = newUrl
        cached.lastVerified = Date.now()
        this.saveToPersistentStorage()
      } else {
        cached.lastVerified = Date.now()
      }
    } catch (error) {
      logger.warn('FaviconService', `后台验证favicon失败 ${domain}`, error)
    }
  }

  /**
   * 检查域名是否已缓存且在新鲜期内
   */
  private isCached(domain: string, size: number = 16): boolean {
    const cacheKey = `${domain}_${size}`
    const cached = this.memoryCache.get(cacheKey)

    if (!cached) return false

    return Date.now() - cached.timestamp < this.CACHE_FRESH_PERIOD
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  /**
   * 保存到持久化存储
   */
  private async saveToPersistentStorage(): Promise<void> {
    try {
      // 检查是否在Chrome扩展环境中
      if (typeof chrome === 'undefined' || !chrome.storage) {
        logger.debug('FaviconService', '不在Chrome扩展环境中，跳过存储保存')
        return
      }

      const cacheData: FaviconCacheData = {}
      this.memoryCache.forEach((value, key) => {
        // 只保存域名部分作为key，去掉size后缀
        const domain = key.split('_')[0]
        if (!cacheData[domain] || value.size === 16) {
          // 优先保存16px的图标
          cacheData[domain] = value
        }
      })

      await chrome.storage.local.set({
        [this.STORAGE_KEY]: JSON.stringify(cacheData)
      })
    } catch (error) {
      logger.warn('FaviconService', '保存favicon缓存失败', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const stats = {
      totalDomains: this.memoryCache.size,
      pendingRequests: this.pendingRequests.size,
      freshCache: 0,
      staleCache: 0
    }

    const now = Date.now()
    this.memoryCache.forEach(item => {
      if (now - item.timestamp < this.CACHE_FRESH_PERIOD) {
        stats.freshCache++
      } else {
        stats.staleCache++
      }
    })

    return stats
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now()
    let cleanedCount = 0

    const toDelete: string[] = []
    this.memoryCache.forEach((item, key) => {
      if (now - item.timestamp > this.CACHE_VERIFY_PERIOD) {
        toDelete.push(key)
        cleanedCount++
      }
    })

    toDelete.forEach(key => this.memoryCache.delete(key))

    if (cleanedCount > 0) {
      logger.info(
        'FaviconService',
        `清理过期favicon缓存: ${cleanedCount} 个域名`
      )
      await this.saveToPersistentStorage()
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    this.memoryCache.clear()
    this.pendingRequests.clear()

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(this.STORAGE_KEY)
      }
    } catch (error) {
      logger.warn('FaviconService', '清理持久化缓存失败', error)
    }

    logger.info('FaviconService', '已清空所有favicon缓存')
  }
}

// 导出单例实例
export const faviconService = FaviconService.getInstance()
