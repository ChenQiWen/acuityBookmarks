/**
 * 爬虫服务相关类型定义
 *
 * 包含网页爬取和元数据提取的所有类型
 */

import type { Timestamp } from '../core/common'

/**
 * 爬取结果接口
 *
 * 单个 URL 的爬取结果
 */
export interface CrawlResult {
  /** 原始 URL */
  originalUrl: string

  /** 最终 URL（重定向后） */
  finalUrl: string

  /** HTTP 状态码 */
  status: number

  /** 是否成功 */
  success: boolean

  /** 页面元数据 */
  metadata?: PageMetadata

  /** 错误信息 */
  error?: string

  /** 响应时间（毫秒） */
  responseTime: number

  /** 爬取时间 */
  crawledAt: Timestamp
}

/**
 * 页面元数据接口
 *
 * 从网页提取的元数据
 */
export interface PageMetadata {
  /** 页面标题 */
  title: string

  /** 页面描述 */
  description?: string

  /** 关键词 */
  keywords?: string[]

  /** Open Graph 标题 */
  ogTitle?: string

  /** Open Graph 描述 */
  ogDescription?: string

  /** Open Graph 图片 */
  ogImage?: string

  /** Open Graph 类型 */
  ogType?: string

  /** Open Graph URL */
  ogUrl?: string

  /** Favicon URL */
  faviconUrl?: string

  /** 页面语言 */
  language?: string

  /** 作者 */
  author?: string

  /** 发布时间 */
  publishedTime?: Timestamp

  /** 修改时间 */
  modifiedTime?: Timestamp

  /** 标签 */
  tags?: string[]

  /** 分类 */
  category?: string

  /** 其他元数据 */
  [key: string]: unknown
}

/**
 * 爬取选项接口
 *
 * 爬取操作的配置选项
 */
export interface CrawlOptions {
  /** 超时时间（毫秒） */
  timeout?: number

  /** 是否跟随重定向 */
  followRedirect?: boolean

  /** 最大重定向次数 */
  maxRedirects?: number

  /** 用户代理 */
  userAgent?: string

  /** 自定义请求头 */
  headers?: Record<string, string>

  /** 是否提取完整内容 */
  extractFullContent?: boolean

  /** 是否提取图片 */
  extractImages?: boolean

  /** 是否提取链接 */
  extractLinks?: boolean
}

/**
 * 爬取任务接口
 *
 * 爬取任务的定义
 */
export interface CrawlTask {
  /** 任务ID */
  id: string

  /** 书签ID */
  bookmarkId: string

  /** 目标 URL */
  url: string

  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'

  /** 创建时间 */
  createdAt: Timestamp

  /** 开始时间 */
  startedAt?: Timestamp

  /** 完成时间 */
  completedAt?: Timestamp

  /** 重试次数 */
  retries: number

  /** 最大重试次数 */
  maxRetries: number

  /** 优先级 */
  priority: number

  /** 爬取选项 */
  options?: CrawlOptions

  /** 错误信息 */
  error?: string
}

/**
 * 批量爬取选项接口
 *
 * 批量爬取书签的配置
 */
export interface CrawlByIdsOptions {
  /** 书签ID列表 */
  bookmarkIds: string[]

  /** 爬取选项 */
  crawlOptions?: CrawlOptions

  /** 批次大小 */
  batchSize?: number

  /** 并发数 */
  concurrency?: number

  /** 进度回调 */
  onProgress?: (progress: { completed: number; total: number }) => void

  /** 错误回调 */
  onError?: (bookmarkId: string, error: Error) => void
}

/**
 * 队列统计信息接口
 *
 * 爬取队列的统计数据
 */
export interface QueueStatistics {
  /** 队列中的任务总数 */
  total: number

  /** 等待中的任务数 */
  pending: number

  /** 正在执行的任务数 */
  running: number

  /** 已完成的任务数 */
  completed: number

  /** 失败的任务数 */
  failed: number

  /** 平均等待时间（毫秒） */
  averageWaitTime: number

  /** 平均执行时间（毫秒） */
  averageExecutionTime: number
}
