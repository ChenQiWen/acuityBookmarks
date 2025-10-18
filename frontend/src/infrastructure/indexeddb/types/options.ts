/**
 * 搜索与批处理相关的类型定义
 *
 * 当前处于迁移阶段，因此直接在 infrastructure 层重新声明，保持与 legacy 版本同构，
 * 便于逐步替换实现细节。所有字段均配有中文注释，方便后续维护。
 */

import type { BookmarkRecord } from './records'

export interface BatchOptions<T = unknown> {
  /**
   * 单批写入时的最大条目数量，避免事务过大导致阻塞
   */
  batchSize?: number
  /**
   * 并发执行写入的上限，用于控制主线程压力
   */
  maxConcurrency?: number
  /**
   * 批处理进度回调：progress 表示已处理数量，total 是总条目数
   */
  progressCallback?: (progress: number, total: number) => void
  /**
   * 单条写入失败时的回调，item 为触发错误的原始记录
   */
  errorCallback?: (error: Error, item: T) => void
}

export interface SearchOptions {
  /**
   * 是否启用模糊匹配
   */
  fuzzy?: boolean
  /**
   * 是否返回高亮标记
   */
  highlight?: boolean
  /**
   * 最大返回数量
   */
  limit?: number
  /**
   * 是否包含文件夹
   */
  includeFolders?: boolean
  /**
   * 查询命中最少得分（0~1）
   */
  minScore?: number
}

export interface SearchResult {
  id: string
  score: number
  bookmark: BookmarkRecord
  highlights?: Array<{ field: keyof BookmarkRecord; matchedText: string }>
}
