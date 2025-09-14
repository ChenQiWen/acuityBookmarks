/**
 * 全局书签缓存访问器
 * 统一的数据接口，所有页面都从这里获取预加载的书签数据
 */

export interface CachedBookmarkData {
    tree: chrome.bookmarks.BookmarkTreeNode[]
    timestamp: number
    version: string
}

export interface FaviconCacheData {
    [domain: string]: {
        url: string
        timestamp: number
        size?: number
    }
}

export interface BookmarkCacheStats {
    lastUpdate: number
    dataAge: number
    isFromCache: boolean
    cacheSize: number
    faviconCacheSize: number
    faviconCount: number
}

export class GlobalBookmarkCache {
    private static readonly CACHE_KEY = 'globalBookmarksCache'
    private static readonly LAST_UPDATE_KEY = 'lastBookmarkUpdate'
    private static readonly FAVICON_CACHE_KEY = 'globalFaviconCache'
    private static readonly MAX_AGE = 5 * 60 * 1000 // 5分钟
    private static readonly FAVICON_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7天

    // 内存缓存
    private static memoryCache: CachedBookmarkData | null = null
    private static lastMemoryUpdate = 0
    private static faviconMemoryCache: FaviconCacheData = {}
    // private static lastFaviconUpdate = 0 // 暂时不使用

    /**
     * 获取预加载的书签数据
     */
    static async getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
        try {
            // 优先从内存缓存获取
            if (this.memoryCache && this.isMemoryCacheValid()) {
                console.log('📊 从内存缓存获取书签数据')
                return this.memoryCache.tree
            }

            // 从Chrome Storage获取预加载数据
            const result = await chrome.storage.local.get([this.CACHE_KEY])
            const cached: CachedBookmarkData = result[this.CACHE_KEY]

            if (cached && cached.tree) {
                // 更新内存缓存
                this.memoryCache = cached
                this.lastMemoryUpdate = Date.now()

                console.log('📊 从全局缓存获取书签数据')
                return cached.tree
            } else {
                // 缓存不存在，请求Service Worker预加载
                console.log('📊 缓存不存在，请求预加载...')
                await this.requestPreload()

                // 等待一下再尝试获取
                await new Promise(resolve => setTimeout(resolve, 100))
                return this.getBookmarkTree()
            }
        } catch (error) {
            console.error('❌ 获取全局书签缓存失败:', error)

            // 降级到直接调用Chrome API
            return new Promise(resolve => {
                chrome.bookmarks.getTree(resolve)
            })
        }
    }

    /**
     * 获取扁平化的书签列表（用于搜索等）
     */
    static async getFlatBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
        const tree = await this.getBookmarkTree()
        const flatList: chrome.bookmarks.BookmarkTreeNode[] = []

        const flatten = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
            nodes.forEach(node => {
                if (node.url) {
                    flatList.push(node)
                }
                if (node.children) {
                    flatten(node.children)
                }
            })
        }

        flatten(tree)
        return flatList
    }

    /**
     * 获取缓存统计信息
     */
    static async getCacheStats(): Promise<BookmarkCacheStats> {
        try {
            const result = await chrome.storage.local.get([this.CACHE_KEY, this.LAST_UPDATE_KEY, this.FAVICON_CACHE_KEY])
            const cached = result[this.CACHE_KEY]
            const lastUpdate = result[this.LAST_UPDATE_KEY] || 0
            const faviconCache = result[this.FAVICON_CACHE_KEY] || {}

            return {
                lastUpdate,
                dataAge: Date.now() - lastUpdate,
                isFromCache: !!cached,
                cacheSize: cached ? JSON.stringify(cached).length : 0,
                faviconCacheSize: JSON.stringify(faviconCache).length,
                faviconCount: Object.keys(faviconCache).length
            }
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error)
            return {
                lastUpdate: 0,
                dataAge: 0,
                isFromCache: false,
                cacheSize: 0,
                faviconCacheSize: 0,
                faviconCount: 0
            }
        }
    }

    /**
     * 监听数据更新通知
     */
    static onDataUpdate(callback: () => void): () => void {
        const listener = (message: any) => {
            if (message.type === 'BOOKMARKS_DATA_READY') {
                console.log('📊 收到书签数据更新通知')
                // 清除内存缓存，强制重新获取
                this.memoryCache = null
                callback()
            }
        }

        chrome.runtime.onMessage.addListener(listener)

        // 返回清理函数
        return () => {
            chrome.runtime.onMessage.removeListener(listener)
        }
    }

    /**
     * 手动刷新缓存
     */
    static async refreshCache(): Promise<void> {
        this.memoryCache = null
        await this.requestPreload()
    }

    /**
     * 按需获取网站图标（基于域名缓存）
     */
    static async getFaviconForUrl(url: string, size: number = 16): Promise<string> {
        try {
            const domain = this.extractDomain(url)
            if (!domain) return ''

            // 1. 检查内存缓存
            if (this.faviconMemoryCache[domain]) {
                const cached = this.faviconMemoryCache[domain]
                // 检查是否过期
                if (Date.now() - cached.timestamp < this.FAVICON_MAX_AGE) {
                    console.log(`🎯 内存命中: ${domain}`)
                    return cached.url
                }
            }

            // 2. 检查Chrome Storage缓存
            const storedFavicons = await this.loadFaviconCache()
            if (storedFavicons[domain]) {
                const cached = storedFavicons[domain]
                // 检查是否过期
                if (Date.now() - cached.timestamp < this.FAVICON_MAX_AGE) {
                    // 更新内存缓存
                    this.faviconMemoryCache[domain] = cached
                    console.log(`📁 存储命中: ${domain}`)
                    return cached.url
                }
            }

            // 3. 缓存未命中，获取新图标
            const faviconUrl = await this.fetchFaviconFromNetwork(domain, size)
            if (faviconUrl) {
                // 保存到缓存
                await this.saveFaviconToCache(domain, faviconUrl)
                console.log(`🌐 网络获取: ${domain}`)
                return faviconUrl
            }

            return ''
        } catch (error) {
            console.error(`❌ 获取 ${url} 的图标失败:`, error)
            return ''
        }
    }

    /**
     * 批量预加载文件夹中书签的图标
     */
    static async preloadFaviconsForFolder(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): Promise<void> {
        const domains = new Set<string>()

        // 收集所有唯一域名
        const collectDomains = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
            nodes.forEach(node => {
                if (node.url) {
                    const domain = this.extractDomain(node.url)
                    if (domain) domains.add(domain)
                }
                if (node.children) {
                    collectDomains(node.children)
                }
            })
        }

        collectDomains(bookmarks)

        // 并发获取图标（限制并发数）
        const domainArray = Array.from(domains)
        const BATCH_SIZE = 5

        for (let i = 0; i < domainArray.length; i += BATCH_SIZE) {
            const batch = domainArray.slice(i, i + BATCH_SIZE)
            await Promise.allSettled(
                batch.map(domain => this.getFaviconForUrl(`https://${domain}`))
            )
        }

        console.log(`📊 预加载完成: ${domains.size} 个域名的图标`)
    }

    /**
     * 检查域名是否已缓存图标
     */
    static async hasFaviconForDomain(domain: string): Promise<boolean> {
        try {
            // 检查内存缓存
            if (this.faviconMemoryCache[domain]) {
                const cached = this.faviconMemoryCache[domain]
                return Date.now() - cached.timestamp < this.FAVICON_MAX_AGE
            }

            // 检查存储缓存
            const storedFavicons = await this.loadFaviconCache()
            if (storedFavicons[domain]) {
                const cached = storedFavicons[domain]
                return Date.now() - cached.timestamp < this.FAVICON_MAX_AGE
            }

            return false
        } catch (error) {
            console.error(`❌ 检查 ${domain} 图标缓存失败:`, error)
            return false
        }
    }

    // 私有方法
    private static isMemoryCacheValid(): boolean {
        if (!this.memoryCache || !this.lastMemoryUpdate) return false

        const age = Date.now() - this.lastMemoryUpdate
        return age < this.MAX_AGE
    }

    private static async requestPreload(): Promise<void> {
        try {
            // 向Service Worker请求预加载数据
            await chrome.runtime.sendMessage({ type: 'REQUEST_BOOKMARK_PRELOAD' })
        } catch (error) {
            console.warn('⚠️ 请求预加载失败:', error)
        }
    }

    // 图标相关私有方法
    private static extractDomain(url: string): string {
        try {
            const urlObj = new URL(url)
            return urlObj.hostname
        } catch {
            return ''
        }
    }

    private static async loadFaviconCache(): Promise<FaviconCacheData> {
        try {
            const result = await chrome.storage.local.get([this.FAVICON_CACHE_KEY])
            return result[this.FAVICON_CACHE_KEY] || {}
        } catch (error) {
            console.error('❌ 加载图标缓存失败:', error)
            return {}
        }
    }

    private static async saveFaviconToCache(domain: string, faviconUrl: string): Promise<void> {
        try {
            const currentCache = await this.loadFaviconCache()
            const updatedCache = {
                ...currentCache,
                [domain]: {
                    url: faviconUrl,
                    timestamp: Date.now()
                }
            }

            // 保存到存储
            await chrome.storage.local.set({
                [this.FAVICON_CACHE_KEY]: updatedCache
            })

            // 更新内存缓存
            this.faviconMemoryCache[domain] = {
                url: faviconUrl,
                timestamp: Date.now()
            }

            // this.lastFaviconUpdate = Date.now() // 暂时不使用
        } catch (error) {
            console.error(`❌ 保存 ${domain} 图标缓存失败:`, error)
        }
    }

    private static async fetchFaviconFromNetwork(domain: string, size: number = 16): Promise<string> {
        const faviconSources = [
            // Google Favicon 服务（最可靠）
            `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
            // 直接域名favicon
            `https://${domain}/favicon.ico`,
            // 常见的favicon路径
            `https://${domain}/favicon.png`,
            `https://${domain}/apple-touch-icon.png`
        ]

        for (const faviconUrl of faviconSources) {
            try {
                // 测试图标URL是否可访问
                const response = await fetch(faviconUrl, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'force-cache'
                })

                // 对于no-cors请求，即使成功也可能返回opaque response
                // 所以我们假设第一个URL（Google服务）是可用的
                if (faviconUrl.includes('google.com/s2/favicons')) {
                    return faviconUrl
                }

                // 对于其他URL，检查响应状态
                if (response.ok) {
                    return faviconUrl
                }
            } catch {
                // 继续尝试下一个URL
                continue
            }
        }

        // 如果所有尝试都失败，返回Google默认服务
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
    }
}

// 导出单例
export const globalBookmarkCache = GlobalBookmarkCache
