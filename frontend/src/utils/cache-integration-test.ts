/**
 * 高性能缓存集成测试工具
 * 用于验证FastBookmarkCache与管理系统的集成效果
 */

import { fastBookmarkCache } from './fast-bookmark-cache'
// import { logger } from './logger' // 暂时注释掉，在控制台测试中使用console.log

/**
 * 缓存性能测试
 */
export class CacheIntegrationTest {
  
  /**
   * 初始化测试
   */
  async initializeTest() {
    console.log('🧪 开始缓存集成测试...')
    
    try {
      // 初始化缓存
      await fastBookmarkCache.initialize()
      
      console.log('✅ 缓存初始化成功')
      return true
    } catch (error) {
      console.error('❌ 缓存初始化失败:', error)
      return false
    }
  }
  
  /**
   * 读取性能测试
   */
  async testReadPerformance() {
    console.log('📊 读取性能测试...')
    
    const iterations = 100
    const results = []
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      await fastBookmarkCache.getBookmarkTree()
      const duration = performance.now() - startTime
      results.push(duration)
    }
    
    const avgTime = results.reduce((a, b) => a + b) / results.length
    const minTime = Math.min(...results)
    const maxTime = Math.max(...results)
    
    console.table({
      '平均耗时': `${avgTime.toFixed(3)}ms`,
      '最快耗时': `${minTime.toFixed(3)}ms`,
      '最慢耗时': `${maxTime.toFixed(3)}ms`,
      '吞吐量': `${Math.round(1000 / avgTime)} 次/秒`
    })
    
    return {
      avgTime,
      minTime,
      maxTime,
      throughput: Math.round(1000 / avgTime)
    }
  }
  
  /**
   * 搜索性能测试
   */
  async testSearchPerformance() {
    console.log('🔍 搜索性能测试...')
    
    const queries = ['google', 'github', 'bookmark', 'test', '书签']
    const results: { [key: string]: any } = {}
    
    for (const query of queries) {
      const startTime = performance.now()
      const searchResults = fastBookmarkCache.searchBookmarks(query, 50)
      const duration = performance.now() - startTime
      
      results[query] = {
        耗时: `${duration.toFixed(3)}ms`,
        结果数: searchResults.length
      }
    }
    
    console.table(results)
    return results
  }
  
  /**
   * 内存使用测试
   */
  async testMemoryUsage() {
    console.log('💾 内存使用测试...')
    
    const stats = fastBookmarkCache.getStats()
    
    console.table({
      '书签数量': stats.itemCount,
      '内存占用': `${stats.memorySize.toFixed(2)}MB`,
      '缓存命中率': `${(stats.hitRate * 100).toFixed(1)}%`,
      '压缩比例': `${(stats.compressionRatio * 100).toFixed(1)}%`,
      '最后更新': new Date(stats.lastUpdated).toLocaleString()
    })
    
    return stats
  }
  
  /**
   * 与Chrome API性能对比测试
   */
  async compareWithChromeAPI() {
    console.log('⚖️  缓存 vs Chrome API 性能对比...')
    
    // 测试缓存性能
    const cacheStartTime = performance.now()
    await fastBookmarkCache.getBookmarkTree()
    const cacheDuration = performance.now() - cacheStartTime
    
    // 测试Chrome API性能
    const apiStartTime = performance.now()
    await new Promise<void>((resolve) => {
      chrome.bookmarks.getTree(() => {
        const apiDuration = performance.now() - apiStartTime
        
        const speedupRatio = apiDuration / cacheDuration
        
        console.table({
          '缓存耗时': `${cacheDuration.toFixed(3)}ms`,
          'API耗时': `${apiDuration.toFixed(3)}ms`,
          '性能提升': `${speedupRatio.toFixed(1)}x`
        })
        
        resolve()
      })
    })
  }
  
  /**
   * 完整测试套件
   */
  async runFullTest() {
    console.log('🚀 开始完整缓存集成测试...')
    console.log('=' .repeat(50))
    
    // 初始化
    const initOk = await this.initializeTest()
    if (!initOk) {
      console.error('❌ 初始化失败，终止测试')
      return false
    }
    
    console.log('')
    
    // 性能测试
    await this.testReadPerformance()
    console.log('')
    
    await this.testSearchPerformance()
    console.log('')
    
    await this.testMemoryUsage()
    console.log('')
    
    await this.compareWithChromeAPI()
    
    console.log('=' .repeat(50))
    console.log('✅ 缓存集成测试完成！')
    
    return true
  }
}

// 导出单例
export const cacheIntegrationTest = new CacheIntegrationTest()

// 全局调试工具
if (typeof window !== 'undefined') {
  (window as any).__AB_CACHE_TEST__ = cacheIntegrationTest
}
