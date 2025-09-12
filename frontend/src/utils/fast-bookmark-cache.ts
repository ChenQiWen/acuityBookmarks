/**
 * 高性能书签缓存管理器
 * 专门用于缓存Chrome API数据，优先考虑读取速度
 */

export interface CachedBookmark {
  id: string
  parentId?: string
  title: string
  url?: string
  index: number
  dateAdded: number
  dateModified?: number
  children?: CachedBookmark[]
}

export interface CacheStats {
  itemCount: number
  memorySize: number // 内存占用（估算）
  storageSize: number // Chrome Storage占用
  hitRate: number // 缓存命中率
  lastUpdated: number
  compressionRatio: number
}

export interface CacheOptions {
  enableCompression?: boolean
  maxMemorySize?: number // MB
  updateThreshold?: number // 更新阈值（秒）
  enableMetrics?: boolean
}

/**
 * 快速书签缓存管理器
 * 二层架构：内存缓存 + Chrome Storage
 */
export class FastBookmarkCache {
  private memoryCache: Map<string, CachedBookmark> = new Map()
  private treeCache: CachedBookmark[] | null = null
  private lastUpdate: number = 0
  private options: Required<CacheOptions>
  
  // 性能统计
  private stats = {
    reads: 0,
    memoryHits: 0,
    storageHits: 0,
    misses: 0,
    compressionRatio: 0
  }
  
  constructor(options: CacheOptions = {}) {
    this.options = {
      enableCompression: true,
      maxMemorySize: 50, // 50MB
      updateThreshold: 300, // 5分钟
      enableMetrics: true,
      ...options
    }
  }
  
  /**
   * 初始化缓存 - 从Chrome Storage加载到内存
   */
  async initialize(): Promise<void> {
    try {
      const startTime = performance.now()
      
      // 尝试从Chrome Storage加载缓存
      const cached = await this.loadFromChromeStorage()
      
      if (cached && this.isCacheValid(cached)) {
        this.buildMemoryCache(cached.bookmarks)
        this.treeCache = cached.bookmarks
        this.lastUpdate = cached.timestamp
        
        const duration = performance.now() - startTime
        console.log(`📚 缓存初始化成功: ${cached.bookmarks.length} 个书签，耗时 ${duration.toFixed(2)}ms`)
        return
      }
      
      // 缓存无效或不存在，从Chrome API加载
      console.log('🔄 缓存无效，从Chrome API重新加载...')
      await this.refreshFromChromeAPI()
      
    } catch (error) {
      console.error('❌ 缓存初始化失败:', error)
      // 降级到直接API访问
      await this.refreshFromChromeAPI()
    }
  }
  
  /**
   * 获取完整书签树 - 毫秒级响应
   */
  async getBookmarkTree(): Promise<CachedBookmark[]> {
    this.stats.reads++
    
    // 优先从内存缓存返回
    if (this.treeCache) {
      this.stats.memoryHits++
      return this.deepClone(this.treeCache)
    }
    
    // 内存缓存miss，尝试从Chrome Storage加载
    const cached = await this.loadFromChromeStorage()
    if (cached && this.isCacheValid(cached)) {
      this.stats.storageHits++
      this.treeCache = cached.bookmarks
      this.buildMemoryCache(cached.bookmarks)
      return this.deepClone(this.treeCache)
    }
    
    // 都没有，从Chrome API加载
    this.stats.misses++
    await this.refreshFromChromeAPI()
    return this.deepClone(this.treeCache!)
  }
  
  /**
   * 根据ID快速获取书签 - 微秒级响应
   */
  getBookmarkById(id: string): CachedBookmark | null {
    this.stats.reads++
    
    if (this.memoryCache.has(id)) {
      this.stats.memoryHits++
      return this.deepClone(this.memoryCache.get(id)!)
    }
    
    this.stats.misses++
    return null
  }
  
  /**
   * 批量获取书签
   */
  getBookmarksByIds(ids: string[]): (CachedBookmark | null)[] {
    return ids.map(id => this.getBookmarkById(id))
  }
  
  /**
   * 搜索书签（内存搜索，毫秒级）
   */
  searchBookmarks(query: string, limit: number = 100): CachedBookmark[] {
    if (!query.trim()) return []
    
    const keywords = query.toLowerCase().split(/\s+/)
    const results: { bookmark: CachedBookmark; score: number }[] = []
    
    this.memoryCache.forEach(bookmark => {
      const score = this.calculateSearchScore(bookmark, keywords)
      if (score > 0) {
        results.push({ bookmark, score })
      }
    })
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => this.deepClone(item.bookmark))
  }
  
  /**
   * 更新缓存（同时更新内存和存储）
   */
  async updateCache(bookmarks: CachedBookmark[]): Promise<void> {
    const startTime = performance.now()
    
    // 更新内存缓存
    this.treeCache = bookmarks
    this.buildMemoryCache(bookmarks)
    this.lastUpdate = Date.now()
    
    // 异步更新Chrome Storage
    this.saveToChromeStorage(bookmarks).catch(error => {
      console.error('Chrome Storage更新失败:', error)
    })
    
    const duration = performance.now() - startTime
    console.log(`💾 缓存更新完成: ${bookmarks.length} 个书签，耗时 ${duration.toFixed(2)}ms`)
  }
  
  /**
   * 强制从Chrome API刷新
   */
  async refreshFromChromeAPI(): Promise<void> {
    try {
      const startTime = performance.now()
      
      // 调用Chrome Bookmarks API
      const bookmarkTree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve, reject) => {
        chrome.bookmarks.getTree((tree) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(tree)
          }
        })
      })
      
      // 转换为缓存格式
      const cached = this.convertToCache(bookmarkTree)
      
      // 更新缓存
      await this.updateCache(cached)
      
      const duration = performance.now() - startTime
      console.log(`🔄 从Chrome API刷新完成，耗时 ${duration.toFixed(2)}ms`)
      
    } catch (error) {
      console.error('❌ Chrome API刷新失败:', error)
      throw error
    }
  }
  
  /**
   * 检查是否需要更新缓存
   */
  shouldRefreshCache(): boolean {
    if (!this.treeCache) return true
    
    const age = (Date.now() - this.lastUpdate) / 1000
    return age > this.options.updateThreshold
  }
  
  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const hitRate = this.stats.reads > 0 
      ? (this.stats.memoryHits + this.stats.storageHits) / this.stats.reads 
      : 0
    
    return {
      itemCount: this.memoryCache.size,
      memorySize: this.estimateMemorySize(),
      storageSize: 0, // 异步获取，这里简化
      hitRate,
      lastUpdated: this.lastUpdate,
      compressionRatio: this.stats.compressionRatio
    }
  }
  
  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    this.memoryCache.clear()
    this.treeCache = null
    this.lastUpdate = 0
    
    try {
      await chrome.storage.local.remove(['bookmarkCache'])
      console.log('🗑️ 缓存已清空')
    } catch (error) {
      console.error('清空Chrome Storage失败:', error)
    }
  }
  
  // === 私有方法 ===
  
  /**
   * 从Chrome Storage加载缓存
   */
  private async loadFromChromeStorage(): Promise<{ bookmarks: CachedBookmark[]; timestamp: number } | null> {
    try {
      const result = await chrome.storage.local.get(['bookmarkCache'])
      if (!result.bookmarkCache) return null
      
      let data = result.bookmarkCache
      
      // 如果启用了压缩，解压缩数据
      if (this.options.enableCompression && data.compressed) {
        data = await this.decompress(data.data)
      }
      
      return {
        bookmarks: data.bookmarks || [],
        timestamp: data.timestamp || 0
      }
      
    } catch (error) {
      console.error('从Chrome Storage加载失败:', error)
      return null
    }
  }
  
  /**
   * 保存到Chrome Storage
   */
  private async saveToChromeStorage(bookmarks: CachedBookmark[]): Promise<void> {
    try {
      let data = {
        bookmarks,
        timestamp: Date.now(),
        version: '1.0'
      }
      
      // 压缩数据
      if (this.options.enableCompression) {
        const compressed = await this.compress(data)
        data = {
          compressed: true,
          data: compressed,
          originalSize: JSON.stringify(data).length,
          compressedSize: compressed.length
        } as any
        
        this.stats.compressionRatio = (data as any).compressedSize / (data as any).originalSize
      }
      
      await chrome.storage.local.set({ bookmarkCache: data })
      
    } catch (error) {
      console.error('保存到Chrome Storage失败:', error)
      throw error
    }
  }
  
  /**
   * 构建内存索引
   */
  private buildMemoryCache(bookmarks: CachedBookmark[]): void {
    this.memoryCache.clear()
    
    const traverse = (items: CachedBookmark[]) => {
      items.forEach(item => {
        this.memoryCache.set(item.id, item)
        if (item.children) {
          traverse(item.children)
        }
      })
    }
    
    traverse(bookmarks)
  }
  
  /**
   * 转换Chrome书签为缓存格式
   */
  private convertToCache(nodes: chrome.bookmarks.BookmarkTreeNode[]): CachedBookmark[] {
    const convert = (node: chrome.bookmarks.BookmarkTreeNode): CachedBookmark => {
      const cached: CachedBookmark = {
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        url: node.url,
        index: node.index || 0,
        dateAdded: node.dateAdded || Date.now(),
        dateModified: (node as any).dateModified || Date.now()
      }
      
      if (node.children) {
        cached.children = node.children.map(convert)
      }
      
      return cached
    }
    
    return nodes.map(convert)
  }
  
  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cached: { timestamp: number }): boolean {
    const age = (Date.now() - cached.timestamp) / 1000
    return age < this.options.updateThreshold
  }
  
  /**
   * 计算搜索得分
   */
  private calculateSearchScore(bookmark: CachedBookmark, keywords: string[]): number {
    let score = 0
    const title = bookmark.title.toLowerCase()
    const url = bookmark.url?.toLowerCase() || ''
    
    keywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10
      if (url.includes(keyword)) score += 5
      if (title.startsWith(keyword)) score += 5
    })
    
    return score
  }
  
  /**
   * 估算内存使用
   */
  private estimateMemorySize(): number {
    // 简单估算：每个书签约500字节
    return (this.memoryCache.size * 500) / (1024 * 1024) // MB
  }
  
  /**
   * 深度克隆对象
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj))
  }
  
  /**
   * 简单的JSON压缩（移除不必要的空白和重复字段）
   */
  private async compress(data: any): Promise<string> {
    // 简化JSON结构，移除冗余字段
    const compressed = JSON.stringify(data, (key, value) => {
      // 移除undefined值
      if (value === undefined) return null
      
      // 压缩长URL
      if (key === 'url' && typeof value === 'string' && value.length > 200) {
        return value.substring(0, 200) + '...[truncated]'
      }
      
      return value
    })
    
    return compressed
  }
  
  /**
   * 解压缩数据
   */
  private async decompress(compressed: string): Promise<any> {
    return JSON.parse(compressed)
  }
}

// 单例导出
export const fastBookmarkCache = new FastBookmarkCache({
  enableCompression: true,
  maxMemorySize: 50,
  updateThreshold: 300,
  enableMetrics: true
})
