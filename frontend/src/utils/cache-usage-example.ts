/**
 * FastBookmarkCache 使用示例
 */
import { fastBookmarkCache } from './fast-bookmark-cache'

// 在应用启动时初始化
export async function initializeApp() {
  console.log('🚀 应用启动...')
  
  // 初始化缓存（会自动从Chrome Storage加载或从API刷新）
  await fastBookmarkCache.initialize()
  
  console.log('✅ 缓存初始化完成')
}

// 获取书签数据 - 毫秒级响应
export async function getBookmarks() {
  const startTime = performance.now()
  
  // 第一次调用：可能从Chrome Storage加载（~5ms）
  // 后续调用：直接从内存返回（~0.1ms）
  const bookmarks = await fastBookmarkCache.getBookmarkTree()
  
  const duration = performance.now() - startTime
  console.log(`📚 获取 ${bookmarks.length} 个书签，耗时: ${duration.toFixed(2)}ms`)
  
  return bookmarks
}

// 根据ID快速查找 - 微秒级响应
export function findBookmarkById(id: string) {
  const startTime = performance.now()
  
  const bookmark = fastBookmarkCache.getBookmarkById(id)
  
  const duration = performance.now() - startTime
  console.log(`🔍 查找书签 ${id}，耗时: ${duration.toFixed(3)}ms`)
  
  return bookmark
}

// 快速搜索 - 毫秒级响应
export function searchBookmarks(query: string) {
  const startTime = performance.now()
  
  const results = fastBookmarkCache.searchBookmarks(query, 50)
  
  const duration = performance.now() - startTime
  console.log(`🔍 搜索 "${query}"，找到 ${results.length} 个结果，耗时: ${duration.toFixed(2)}ms`)
  
  return results
}

// 检查缓存性能
export function showCacheStats() {
  const stats = fastBookmarkCache.getStats()
  
  console.table({
    '书签数量': stats.itemCount,
    '内存占用': `${stats.memorySize.toFixed(2)}MB`,
    '缓存命中率': `${(stats.hitRate * 100).toFixed(2)}%`,
    '压缩比例': `${(stats.compressionRatio * 100).toFixed(2)}%`,
    '最后更新': new Date(stats.lastUpdated).toLocaleString()
  })
}

// 在数据更新后刷新缓存
export async function handleBookmarkChange() {
  console.log('📝 检测到书签变化，刷新缓存...')
  
  await fastBookmarkCache.refreshFromChromeAPI()
  
  console.log('✅ 缓存刷新完成')
}

// 性能测试
export async function performanceTest() {
  console.log('🧪 开始性能测试...')
  
  // 测试读取性能
  const iterations = 1000
  const startTime = performance.now()
  
  for (let i = 0; i < iterations; i++) {
    await fastBookmarkCache.getBookmarkTree()
  }
  
  const duration = performance.now() - startTime
  const avgTime = duration / iterations
  
  console.log(`📊 性能测试结果:`)
  console.log(`  - 总耗时: ${duration.toFixed(2)}ms`)
  console.log(`  - 平均每次: ${avgTime.toFixed(3)}ms`)
  console.log(`  - 吞吐量: ${(1000 / avgTime).toFixed(0)} 次/秒`)
  
  // 显示缓存统计
  showCacheStats()
}
