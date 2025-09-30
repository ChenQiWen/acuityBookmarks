/**
 * Favicon 管理器
 * 高性能图标缓存系统，支持持久化和预加载
 */

interface FaviconCacheItem {
    url: string
    timestamp: number
    size: number
}
import { logger } from './logger'

export class FaviconManager {
    private static instance: FaviconManager | null = null
    private memoryCache = new Map<string, string>()
    private persistentCache = new Map<string, FaviconCacheItem>()
    private loadingPromises = new Map<string, Promise<string>>()
    private isInitialized = false

    private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7天
    private readonly STORAGE_KEY = 'acuity_favicon_cache'

    static getInstance(): FaviconManager {
        if (!this.instance) {
            this.instance = new FaviconManager()
        }
        return this.instance
    }

    /**
     * 初始化缓存（从Chrome Storage加载）
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return

        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY)
            if (result[this.STORAGE_KEY]) {
                const cached = JSON.parse(result[this.STORAGE_KEY])
                const now = Date.now()

                // 加载未过期的缓存
                for (const [key, item] of Object.entries(cached as Record<string, FaviconCacheItem>)) {
                    if (now - item.timestamp < this.CACHE_EXPIRY) {
                        this.persistentCache.set(key, item)
                        this.memoryCache.set(key, item.url)
                    }
                }

                logger.info(`🎯 Favicon缓存已加载: ${this.persistentCache.size} 个域名`)
            }
        } catch (error) {
            logger.warn('加载favicon缓存失败:', error)
        }

        this.isInitialized = true
    }

    /**
     * 获取域名的 Favicon URL（高性能版本）
     */
    async getFaviconForUrl(url: string, size: number = 32): Promise<string> {
        try {
            // 确保已初始化
            await this.initialize()

            const domain = new URL(url).hostname
            const cacheKey = `${domain}_${size}`

            // 1. 检查内存缓存（最快）
            if (this.memoryCache.has(cacheKey)) {
                return this.memoryCache.get(cacheKey)!
            }

            // 2. 检查是否正在加载中
            if (this.loadingPromises.has(cacheKey)) {
                return await this.loadingPromises.get(cacheKey)!
            }

            // 3. 检查持久化缓存
            const cachedItem = this.persistentCache.get(cacheKey)
            if (cachedItem && Date.now() - cachedItem.timestamp < this.CACHE_EXPIRY) {
                this.memoryCache.set(cacheKey, cachedItem.url)
                return cachedItem.url
            }

            // 4. 网络获取（带去重）
            const loadingPromise = this.fetchFaviconFromNetwork(url, size, domain, cacheKey)
            this.loadingPromises.set(cacheKey, loadingPromise)

            try {
                const result = await loadingPromise
                return result
            } finally {
                this.loadingPromises.delete(cacheKey)
            }

        } catch (error) {
            logger.warn('获取favicon失败:', error)
            return '' // 返回空字符串，调用方使用默认图标
        }
    }

    /**
     * 从网络获取图标
     */
    private async fetchFaviconFromNetwork(url: string, size: number, _domain: string, cacheKey: string): Promise<string> {
        // 使用 Google Favicon 服务
        const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=${size}`

        // 缓存结果
        const cacheItem: FaviconCacheItem = {
            url: googleFaviconUrl,
            timestamp: Date.now(),
            size
        }

        this.memoryCache.set(cacheKey, googleFaviconUrl)
        this.persistentCache.set(cacheKey, cacheItem)

        // 异步保存到Chrome Storage（不阻塞），明确忽略返回 Promise
        void this.saveToPersistentStorage()

        return googleFaviconUrl
    }

    /**
     * 批量预加载图标
     */
    async preloadFavicons(urls: string[], size: number = 32): Promise<void> {
        await this.initialize()

        // 收集需要加载的域名
        const domainsToLoad = new Set<string>()
        urls.forEach(url => {
            try {
                const domain = new URL(url).hostname
                const cacheKey = `${domain}_${size}`
                if (!this.memoryCache.has(cacheKey) && !this.loadingPromises.has(cacheKey)) {
                    domainsToLoad.add(url)
                }
            } catch {
                // 忽略无效URL
            }
        })

        if (domainsToLoad.size === 0) {
            logger.info('🎯 所有图标都已缓存，跳过预加载')
            return
        }

            logger.info(`🚀 开始预加载 ${domainsToLoad.size} 个图标...`)

        // 分批并发加载（避免过载）
        const batchSize = 5
        const domains = Array.from(domainsToLoad)

        for (let i = 0; i < domains.length; i += batchSize) {
            const batch = domains.slice(i, i + batchSize)
            await Promise.allSettled(
                batch.map(url => this.getFaviconForUrl(url, size))
            )

            // 小延迟避免网络拥塞
            if (i + batchSize < domains.length) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

            logger.info('✅ 图标预加载完成')
    }

    /**
     * 保存到持久化存储
     */
    private async saveToPersistentStorage(): Promise<void> {
        try {
            const cacheData: Record<string, FaviconCacheItem> = {}
            this.persistentCache.forEach((value, key) => {
                cacheData[key] = value
            })

            await chrome.storage.local.set({
                [this.STORAGE_KEY]: JSON.stringify(cacheData)
            })
        } catch (error) {
            logger.warn('保存favicon缓存失败:', error)
        }
    }

    /**
     * 同步获取缓存的图标（仅用于已缓存的）
     */
    getCachedFaviconSync(url: string, size: number = 32): string | null {
        try {
            const domain = new URL(url).hostname
            const cacheKey = `${domain}_${size}`
            return this.memoryCache.get(cacheKey) || null
        } catch {
            return null
        }
    }

    /**
     * 检查是否已缓存
     */
    isCached(url: string, size: number = 32): boolean {
        try {
            const domain = new URL(url).hostname
            const cacheKey = `${domain}_${size}`
            return this.memoryCache.has(cacheKey)
        } catch {
            return false
        }
    }

    /**
     * 清理缓存
     */
    clearCache(): void {
        this.memoryCache.clear()
        this.persistentCache.clear()
        this.loadingPromises.clear()
        // 存储移除为 Promise，明确忽略返回值以避免未处理的 Promise
        void chrome.storage.local.remove(this.STORAGE_KEY)
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            memoryCache: this.memoryCache.size,
            persistentCache: this.persistentCache.size,
            loadingPromises: this.loadingPromises.size
        }
    }
}

// 导出单例实例
export const faviconManager = FaviconManager.getInstance()
