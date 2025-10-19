/**
 * 查询结果缓存
 *
 * 职责：
 * - 缓存搜索结果，减少重复计算
 * - 使用 LRU（最近最少使用）策略管理缓存容量
 * - 提供 TTL（生存时间）自动过期机制
 * - 统计缓存命中率
 *
 * 功能：
 * - 自动淘汰最久未使用的缓存
 * - 支持选择性失效和完全清空
 * - 提供缓存统计信息
 * - 支持缓存导入导出
 */

import { logger } from '@/infrastructure/logging/logger'
import type { EnhancedSearchResult } from './unified-search-types'

/**
 * 缓存条目接口
 */
interface CacheEntry {
  /** 缓存键 */
  key: string
  /** 缓存的搜索结果 */
  value: EnhancedSearchResult[]
  /** 创建时间戳 */
  timestamp: number
  /** 命中次数 */
  hits: number
  /** 最后访问时间 */
  lastAccess: number
}

/**
 * 查询缓存类
 */
export class QueryCache {
  /** 缓存存储（使用 Map 以保证插入顺序） */
  private cache: Map<string, CacheEntry>
  /** 最大缓存条目数 */
  private maxSize: number
  /** 缓存生存时间（毫秒） */
  private ttl: number
  /** 缓存命中次数 */
  private hits: number = 0
  /** 缓存未命中次数 */
  private misses: number = 0

  /**
   * 构造函数
   *
   * @param options - 缓存配置选项
   * @param options.maxSize - 最大缓存条目数，默认 1000
   * @param options.ttl - 缓存生存时间（毫秒），默认 5 分钟
   */
  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize || 1000
    this.ttl = options.ttl || 5 * 60 * 1000 // 默认5分钟
    this.cache = new Map()
  }

  /**
   * 生成缓存键
   *
   * 根据查询字符串和选项生成唯一的缓存键
   *
   * @param query - 搜索查询字符串
   * @param options - 搜索选项
   * @returns 缓存键
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
   * 获取缓存的搜索结果
   *
   * 检查缓存是否存在且未过期，更新访问统计
   *
   * @param query - 搜索查询字符串
   * @param options - 搜索选项
   * @returns 缓存的搜索结果，未命中或已过期时返回 null
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
   *
   * 如果缓存已满，使用 LRU 策略淘汰最久未使用的条目
   *
   * @param query - 搜索查询字符串
   * @param results - 搜索结果数组
   * @param options - 搜索选项
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
   *
   * 移除最久未访问的缓存条目
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
   * 使匹配的缓存失效
   *
   * @param pattern - 可选的正则表达式模式，匹配缓存键。不提供时清空所有缓存
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
   * 清空所有缓存
   *
   * 重置缓存内容和统计信息
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    logger.info('QueryCache', '缓存已清空')
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 包含缓存大小、命中率、热门条目等统计数据
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
   *
   * 批量加载常用查询到缓存中，提升首次搜索性能
   *
   * @param queries - 查询和结果数组
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
   *
   * 用于持久化或迁移缓存
   *
   * @returns 缓存条目数组
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
   *
   * 从持久化存储或其他来源导入缓存，只导入未过期的数据
   *
   * @param data - 要导入的缓存条目数组
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
