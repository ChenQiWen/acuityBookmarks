/**
 * Embedding 调试工具
 *
 * 将 embeddingService 的关键方法挂载到 window，
 * 方便在 Chrome 扩展 DevTools Console 里直接调试。
 *
 * 使用方式（在扩展页面的 Console 里）：
 *
 * // 1. 检查 Provider 是否可用
 * await __AB_EMBEDDING__.checkProvider()
 *
 * // 2. 查看向量库统计
 * await __AB_EMBEDDING__.stats()
 *
 * // 3. 手动触发书签同步（生成 embedding）
 * await __AB_EMBEDDING__.sync()
 *
 * // 4. 测试语义搜索
 * await __AB_EMBEDDING__.search('音乐相关')
 *
 * // 5. 测试单条 embedding 生成
 * await __AB_EMBEDDING__.embed('JavaScript 教程')
 */

import { embeddingService } from '@/infrastructure/embedding/embedding-service'
import { localVectorStore } from '@/infrastructure/embedding/local-vector-store'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingDebug'

export interface EmbeddingDebugBridge {
  /** 检查 Provider 可用性 */
  checkProvider(): Promise<{
    available: boolean
    providerName: string | null
    dimensions: number | null
  }>
  /** 查看向量库统计 */
  stats(): Promise<{ count: number; providerName: string | null }>
  /** 手动触发全量同步 */
  sync(): Promise<void>
  /** 测试语义搜索 */
  search(query: string, topK?: number): Promise<Array<{ title: string; url: string; score: number }>>
  /** 测试单条 embedding 生成（验证模型是否正常工作） */
  embed(text: string): Promise<number[]>
  /** 清空向量库（用于重置测试） */
  clearVectors(): Promise<void>
}

async function checkProvider() {
  const provider = await embeddingService.getProvider()
  if (!provider) {
    console.warn('[EmbeddingDebug] ❌ 没有可用的 Embedding Provider')
    return { available: false, providerName: null, dimensions: null }
  }
  console.info(`[EmbeddingDebug] ✅ Provider 可用: ${provider.name}, 维度: ${provider.dimensions}`)
  return { available: true, providerName: provider.name, dimensions: provider.dimensions }
}

async function stats() {
  const result = await embeddingService.getStats()
  console.info(`[EmbeddingDebug] 向量库: ${result.count} 条, Provider: ${result.providerName ?? '未初始化'}`)
  return result
}

async function sync() {
  console.info('[EmbeddingDebug] 开始同步书签 embedding...')
  const bookmarks = await indexedDBManager.getAllBookmarks()
  const urlBookmarks = bookmarks.filter(b => b.url && !b.isFolder)
  console.info(`[EmbeddingDebug] 共 ${urlBookmarks.length} 条书签需要处理`)

  await embeddingService.syncBookmarks(bookmarks, progress => {
    const pct = Math.round((progress.processed / progress.total) * 100)
    console.info(`[EmbeddingDebug] 进度: ${progress.processed}/${progress.total} (${pct}%) 失败: ${progress.failed}`)
  })
  console.info('[EmbeddingDebug] ✅ 同步完成')
}

async function search(query: string, topK = 10) {
  console.info(`[EmbeddingDebug] 搜索: "${query}"`)
  const results = await embeddingService.search(query, topK)
  if (results.length === 0) {
    console.warn('[EmbeddingDebug] 无结果（向量库可能为空，请先运行 sync()）')
    return []
  }
  const formatted = results.map(r => ({ title: r.title, url: r.url, score: Number(r.score.toFixed(4)) }))
  console.table(formatted)
  return formatted
}

async function embed(text: string) {
  const provider = await embeddingService.getProvider()
  if (!provider) {
    console.error('[EmbeddingDebug] Provider 不可用')
    return []
  }
  console.info(`[EmbeddingDebug] 生成 embedding: "${text}"`)
  const vector = await provider.embed(text)
  console.info(`[EmbeddingDebug] ✅ 向量维度: ${vector.length}, 前5个值: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
  return vector
}

async function clearVectors() {
  const allIds = await localVectorStore.getAllIds()
  await localVectorStore.deleteBatch(Array.from(allIds))
  console.info(`[EmbeddingDebug] 已清空 ${allIds.size} 条向量记录`)
}

/**
 * 启用 Embedding 调试桥
 * 将调试方法挂载到 window.__AB_EMBEDDING__
 */
export function enableEmbeddingDebugBridge(): () => void {
  const bridge: EmbeddingDebugBridge = {
    checkProvider,
    stats,
    sync,
    search,
    embed,
    clearVectors
  }

  ;(window as Window & { __AB_EMBEDDING__?: EmbeddingDebugBridge }).__AB_EMBEDDING__ = bridge
  logger.info(LOG_TAG, '🔧 Embedding 调试桥已启用，在 Console 中使用 __AB_EMBEDDING__')
  console.info(
    '%c[EmbeddingDebug] 调试命令：\n' +
    '  await __AB_EMBEDDING__.checkProvider()  // 检查 Provider\n' +
    '  await __AB_EMBEDDING__.stats()          // 向量库统计\n' +
    '  await __AB_EMBEDDING__.sync()           // 触发同步\n' +
    '  await __AB_EMBEDDING__.search("音乐")   // 测试搜索\n' +
    '  await __AB_EMBEDDING__.embed("文本")    // 测试 embedding',
    'color: #83d5c5; font-weight: bold'
  )

  return () => {
    delete (window as Window & { __AB_EMBEDDING__?: EmbeddingDebugBridge }).__AB_EMBEDDING__
  }
}
