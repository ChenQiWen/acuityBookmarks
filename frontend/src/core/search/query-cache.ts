/**
 * 查询结果缓存
 *
 * 功能：
 * - LRU (最近最少使用) 缓存策略
 * - TTL (生存时间) 自动过期
 * - 容量限制
 * - 命中率统计
 */

import { logger } from '@/infrastructure/logging/logger'
import type { EnhancedSearchResult } from './unified-search-types'

interface CacheEntry {
  key: string
  value: EnhancedSearchResult[]
  timestamp: number
  hits: number
  lastAccess: number
}

export class QueryCache {
  private cache: Map<string, CacheEntry>
  private maxSize: number
  private ttl: number
  private hits: number = 0
  private misses: number = 0

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize || 1000
    this.ttl = options.ttl || 5 * 60 * 1000 // 默认5分钟
    this.cache = new Map()
  }

  /**
   * 生成缓存键
   */
  private generateKey(
    query: string,
    options?: Record<string, unknown>
  ): string {
    const normalized = query.toLowerCase().trim()
    const optionsStr = options ? JSON.stringify(options) : ''
    return `${normalized}:${optionsStr}`
  }

  /**
   * 获取缓存结果
   */
  get(
    query: string,
    options?: Record<string, unknown>
  ): EnhancedSearchResult[] | null {
    const key = this.generateKey(query, options)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // 检查是否过期
    const now = Date.now()
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.misses++
      logger.info('QueryCache', `缓存过期: ${query}`)
      return null
    }

    // 更新访问信息
    entry.hits++
    entry.lastAccess = now
    this.hits++

    logger.info('QueryCache', `缓存命中: ${query}`)
    return entry.value
  }

  /**
   * 设置缓存结果
   */
  set(
    query: string,
    results: EnhancedSearchResult[],
    options?: Record<string, unknown>
  ): void {
    const key = this.generateKey(query, options)
    const now = Date.now()

    // 检查容量，执行 LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key,
      value: results,
      timestamp: now,
      hits: 0,
      lastAccess: now
    }

    this.cache.set(key, entry)
    logger.info('QueryCache', `缓存写入: ${query} (${results.length} 条结果)`)
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let oldestEntry: CacheEntry | null = null
    let oldestKey: string | null = null

    // 找到最久未访问的条目
    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccess < oldestEntry.lastAccess) {
        oldestEntry = entry
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      logger.info('QueryCache', `LRU 淘汰: ${oldestEntry?.key}`)
    }
  }

  /**
   * 失效匹配的缓存
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      logger.info('QueryCache', '清空所有缓存')
      return
    }

    const regex = new RegExp(pattern, 'i')
    let count = 0

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.key)) {
        this.cache.delete(key)
        count++
      }
    }

    logger.info('QueryCache', `失效 ${count} 条缓存 (模式: ${pattern})`)
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    logger.info('QueryCache', '缓存已清空')
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    hits: number
    misses: number
    entries: Array<{
      key: string
      hits: number
      age: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      hits: entry.hits,
      age: now - entry.timestamp
    }))

    const total = this.hits + this.misses
    const hitRate = total > 0 ? this.hits / total : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      hits: this.hits,
      misses: this.misses,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10)
    }
  }

  /**
   * 预热缓存
   */
  async warmup(
    queries: Array<{ query: string; results: EnhancedSearchResult[] }>
  ): Promise<void> {
    logger.info('QueryCache', `预热缓存: ${queries.length} 条查询`)

    for (const { query, results } of queries) {
      this.set(query, results)
    }
  }

  /**
   * 导出缓存数据
   */
  export(): Array<{
    key: string
    value: EnhancedSearchResult[]
    timestamp: number
  }> {
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      value: entry.value,
      timestamp: entry.timestamp
    }))
  }

  /**
   * 导入缓存数据
   */
  import(
    data: Array<{
      key: string
      value: EnhancedSearchResult[]
      timestamp: number
    }>
  ): void {
    const now = Date.now()
    let imported = 0

    for (const item of data) {
      // 只导入未过期的数据
      if (now - item.timestamp <= this.ttl) {
        this.cache.set(item.key, {
          ...item,
          hits: 0,
          lastAccess: now
        })
        imported++
      }
    }

    logger.info('QueryCache', `导入 ${imported} 条缓存`)
  }
}
