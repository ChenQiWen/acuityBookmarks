/**
 * 清理领域类型定义
 *
 * 包含书签清理功能相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'
import type { BookmarkNode } from './bookmark'

/**
 * 清理问题类型枚举
 *
 * 定义所有可能的书签问题类型
 */
export enum CleanupProblemType {
  /** 空标题 */
  EMPTY_TITLE = 'EMPTY_TITLE',
  /** 重复书签 */
  DUPLICATE_BOOKMARK = 'DUPLICATE_BOOKMARK',
  /** 重复文件夹 */
  DUPLICATE_FOLDER = 'DUPLICATE_FOLDER',
  /** 空文件夹 */
  EMPTY_FOLDER = 'EMPTY_FOLDER',
  /** 无效URL */
  INVALID_URL = 'INVALID_URL',
  /** 失效链接 */
  BROKEN_LINK = 'BROKEN_LINK',
  /** 孤立书签 */
  ORPHANED_BOOKMARK = 'ORPHANED_BOOKMARK',
  /** 层级过深 */
  TOO_DEEP = 'TOO_DEEP'
}

/**
 * 清理问题严重程度
 *
 * 定义问题的严重程度等级
 */
export enum CleanupSeverity {
  /** 低 - 建议清理 */
  LOW = 'LOW',
  /** 中 - 推荐清理 */
  MEDIUM = 'MEDIUM',
  /** 高 - 强烈建议清理 */
  HIGH = 'HIGH',
  /** 严重 - 必须清理 */
  CRITICAL = 'CRITICAL'
}

/**
 * 清理操作类型
 *
 * 定义可以执行的清理操作
 */
export enum CleanupActionType {
  /** 删除 */
  DELETE = 'DELETE',
  /** 合并 */
  MERGE = 'MERGE',
  /** 移动 */
  MOVE = 'MOVE',
  /** 重命名 */
  RENAME = 'RENAME',
  /** 修复 */
  FIX = 'FIX',
  /** 忽略 */
  IGNORE = 'IGNORE'
}

/**
 * 清理问题接口
 *
 * 表示一个检测到的书签问题
 *
 * @example
 * ```typescript
 * const problem: CleanupProblem = {
 *   id: 'problem-1',
 *   type: CleanupProblemType.DUPLICATE_BOOKMARK,
 *   severity: CleanupSeverity.MEDIUM,
 *   bookmarkId: '123',
 *   title: '重复的书签',
 *   description: '此书签与其他书签重复'
 * }
 * ```
 */
export interface CleanupProblem {
  /** 问题唯一ID */
  id: ID

  /** 问题类型 */
  type: CleanupProblemType

  /** 严重程度 */
  severity: CleanupSeverity

  /** 关联的书签ID */
  bookmarkId: ID

  /** 关联的书签节点 */
  bookmark?: BookmarkNode

  /** 问题标题 */
  title: string

  /** 问题描述 */
  description: string

  /** 建议的操作 */
  suggestedAction?: CleanupActionType

  /** 相关的书签ID列表（如重复项） */
  relatedBookmarkIds?: ID[]

  /** 问题详情 */
  details?: Record<string, unknown>

  /** 发现时间 */
  detectedAt: Timestamp

  /** 是否已选中处理 */
  selected?: boolean

  /** 是否已标记忽略 */
  ignored?: boolean
}

/**
 * 清理设置接口
 *
 * 配置清理扫描和操作的设置
 */
export interface CleanupSettings {
  /** 是否检查空标题 */
  checkEmptyTitles: boolean

  /** 是否检查重复书签 */
  checkDuplicateBookmarks: boolean

  /** 是否检查重复文件夹 */
  checkDuplicateFolders: boolean

  /** 是否检查空文件夹 */
  checkEmptyFolders: boolean

  /** 是否检查无效URL */
  checkInvalidUrls: boolean

  /** 是否检查失效链接 */
  checkBrokenLinks: boolean

  /** 是否检查孤立书签 */
  checkOrphanedBookmarks: boolean

  /** 最大层级深度 */
  maxDepth?: number

  /** 是否检查层级过深 */
  checkTooDeep: boolean

  /** 自动忽略的类型 */
  autoIgnoreTypes?: CleanupProblemType[]

  /** 批量操作时的确认 */
  requireConfirmation: boolean

  /** 是否在删除前创建备份 */
  createBackup: boolean
}

/**
 * 清理状态接口
 *
 * 清理过程的状态管理
 */
export interface CleanupState {
  /** 是否正在扫描 */
  isScanning: boolean

  /** 是否正在处理 */
  isProcessing: boolean

  /** 扫描进度 (0-100) */
  scanProgress: number

  /** 处理进度 (0-100) */
  processProgress: number

  /** 已扫描的书签数 */
  scannedCount: number

  /** 总书签数 */
  totalCount: number

  /** 发现的问题列表 */
  problems: CleanupProblem[]

  /** 已选中的问题ID列表 */
  selectedProblemIds: ID[]

  /** 按类型分组的问题统计 */
  problemsByType: Map<CleanupProblemType, number>

  /** 按严重程度分组的问题统计 */
  problemsBySeverity: Map<CleanupSeverity, number>

  /** 最后扫描时间 */
  lastScanTime: Timestamp | null

  /** 最后处理时间 */
  lastProcessTime: Timestamp | null

  /** 错误信息 */
  error: string | null
}

/**
 * 清理操作接口
 *
 * 表示一个待执行的清理操作
 */
export interface CleanupAction {
  /** 操作ID */
  id: ID

  /** 操作类型 */
  type: CleanupActionType

  /** 问题ID */
  problemId: ID

  /** 目标书签ID */
  targetBookmarkId: ID

  /** 操作参数 */
  params?: {
    /** 新标题（重命名时） */
    newTitle?: string
    /** 目标文件夹ID（移动时） */
    targetFolderId?: ID
    /** 合并到的书签ID（合并时） */
    mergeToId?: ID
    /** 修复内容（修复时） */
    fixContent?: Record<string, unknown>
  }

  /** 操作描述 */
  description: string

  /** 是否需要确认 */
  requiresConfirmation?: boolean
}

/**
 * 清理结果接口
 *
 * 清理操作执行后的结果
 */
export interface CleanupResult {
  /** 成功处理的数量 */
  successCount: number

  /** 失败的数量 */
  failureCount: number

  /** 跳过的数量 */
  skippedCount: number

  /** 总处理数量 */
  totalCount: number

  /** 成功的操作详情 */
  successDetails: Array<{
    /** 问题ID */
    problemId: ID
    /** 操作类型 */
    action: CleanupActionType
    /** 书签ID */
    bookmarkId: ID
    /** 操作消息 */
    message?: string
  }>

  /** 失败的操作详情 */
  failureDetails: Array<{
    /** 问题ID */
    problemId: ID
    /** 操作类型 */
    action: CleanupActionType
    /** 书签ID */
    bookmarkId: ID
    /** 错误消息 */
    error: string
  }>

  /** 处理耗时（毫秒） */
  duration: number

  /** 处理时间 */
  timestamp: Timestamp

  /** 是否创建了备份 */
  backupCreated?: boolean

  /** 备份ID */
  backupId?: ID
}

/**
 * 清理统计信息接口
 *
 * 清理功能的统计数据
 */
export interface CleanupStats {
  /** 总扫描次数 */
  totalScans: number

  /** 总发现问题数 */
  totalProblemsFound: number

  /** 总处理问题数 */
  totalProblemsFixed: number

  /** 按类型统计的问题数 */
  problemsByType: Record<CleanupProblemType, number>

  /** 按严重程度统计的问题数 */
  problemsBySeverity: Record<CleanupSeverity, number>

  /** 最后扫描时间 */
  lastScanTime: Timestamp | null

  /** 平均扫描耗时（毫秒） */
  averageScanTime?: number

  /** 平均处理耗时（毫秒） */
  averageProcessTime?: number

  /** 成功率 (0-1) */
  successRate?: number
}

/**
 * 清理扫描结果接口
 *
 * 扫描完成后的结果
 */
export interface CleanupScanResult {
  /** 发现的问题列表 */
  problems: CleanupProblem[]

  /** 扫描的书签数 */
  scannedCount: number

  /** 扫描耗时（毫秒） */
  duration: number

  /** 扫描时间 */
  timestamp: Timestamp

  /** 是否完整扫描 */
  isComplete: boolean

  /** 扫描设置 */
  settings: CleanupSettings
}

/**
 * 清理标签接口
 *
 * 用于标记和组织问题的标签
 */
export interface CleanupTag {
  /** 标签ID */
  id: ID

  /** 标签名称 */
  name: string

  /** 标签颜色 */
  color: string

  /** 标签描述 */
  description?: string

  /** 关联的问题数 */
  problemCount?: number
}

/**
 * 清理备份接口
 *
 * 清理前的备份信息
 */
export interface CleanupBackup {
  /** 备份ID */
  id: ID

  /** 备份名称 */
  name: string

  /** 备份时间 */
  timestamp: Timestamp

  /** 备份的书签数量 */
  bookmarkCount: number

  /** 备份大小（字节） */
  size: number

  /** 备份描述 */
  description?: string

  /** 备份数据 */
  data?: BookmarkNode[]

  /** 是否可恢复 */
  restorable: boolean
}

/**
 * 清理过滤选项接口
 *
 * 过滤和筛选问题的选项
 */
export interface CleanupFilterOptions {
  /** 按类型过滤 */
  types?: CleanupProblemType[]

  /** 按严重程度过滤 */
  severities?: CleanupSeverity[]

  /** 按标签过滤 */
  tags?: ID[]

  /** 是否显示已忽略的问题 */
  showIgnored?: boolean

  /** 搜索关键词 */
  searchQuery?: string

  /** 排序字段 */
  sortBy?: 'severity' | 'type' | 'title' | 'detectedAt'

  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 清理批量操作接口
 *
 * 批量处理多个问题
 */
export interface CleanupBatchOperation {
  /** 问题ID列表 */
  problemIds: ID[]

  /** 批量操作类型 */
  action: CleanupActionType

  /** 操作参数 */
  params?: Record<string, unknown>

  /** 是否需要确认 */
  requiresConfirmation?: boolean

  /** 操作描述 */
  description?: string
}
