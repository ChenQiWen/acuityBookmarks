/**
 * Favicon 管理器
 * 轻量级的网站图标获取工具，替代重型的 super-global-cache
 */

export class FaviconManager {
    private static instance: FaviconManager | null = null
    private cache = new Map<string, string>()

    static getInstance(): FaviconManager {
        if (!this.instance) {
            this.instance = new FaviconManager()
        }
        return this.instance
    }

    /**
     * 获取域名的 Favicon URL
     */
    async getFaviconForUrl(url: string, size: number = 32): Promise<string> {
        try {
            const domain = new URL(url).hostname
            const cacheKey = `${domain}_${size}`

            // 检查缓存
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey)!
            }

            // 使用 Google Favicon 服务
            const googleFaviconUrl = `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=${size}`

            // 缓存结果
            this.cache.set(cacheKey, googleFaviconUrl)

            return googleFaviconUrl

        } catch (error) {
            console.warn('获取favicon失败:', error)
            return '' // 返回空字符串，调用方使用默认图标
        }
    }

    /**
     * 清理缓存
     */
    clearCache(): void {
        this.cache.clear()
    }
}

// 导出单例实例
export const faviconManager = FaviconManager.getInstance()
