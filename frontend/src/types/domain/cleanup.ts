/**
 * 清理相关类型定义
 *
 * 从 core 层重新导出核心类型，并扩展 UI 层所需的状态管理类型
 */

import type {
  CleanupProblem as CoreCleanupProblem,
  CleanupTask as CoreCleanupTask,
  CleanupSettings as CoreCleanupSettings,
  ScanProgress as CoreScanProgress
} from '@/core/bookmark/domain/cleanup-problem'

export type {
  CleanupProblem,
  CleanupTask,
  ScanProgress,
  ScanResult,
  CleanupResult
} from '@/core/bookmark/domain/cleanup-problem'

export {
  SEVERITY_WEIGHTS,
  getSeverityWeight,
  calculateProblemWeight
} from '@/core/bookmark/domain/cleanup-problem'

/**
 * 健康标签类型
 *
 * 只保留真正需要的两个核心指标
 */
export type HealthTag = 'duplicate' | 'invalid' | 'internal'

/**
 * 清理问题类型特定设置
 */
export interface ProblemTypeSettings {
  /** 重复书签设置 */
  duplicate: {
    compareUrl: boolean
    compareTitle: boolean
    titleSimilarity: number
    ignoreDomain: boolean
    keepNewest: 'oldest' | 'newest'
  }
  /** 失效书签设置（包含404和无效URL） */
  invalid: {
    // 404检测设置
    timeout: number
    skipHttps: boolean
    followRedirects: boolean
    userAgent: string
    ignoreCors: boolean
    // URL格式校验设置
    customPatterns?: string
    checkProtocol?: boolean
    checkDomain?: boolean
    allowLocalhost?: boolean
  }
}

/**
 * 图例可见性设置
 */
export interface LegendVisibility {
  all: boolean
  duplicate: boolean
  invalid: boolean
  healthScore?: boolean
}

/**
 * 清理状态（UI 层）
 */
export interface CleanupState {
  isFiltering: boolean
  activeFilters: HealthTag[]
  isScanning: boolean
  tasks: CoreCleanupTask[]
  filterResults: Map<string, CoreCleanupProblem[]>
  legendVisibility: LegendVisibility
  showSettings: boolean
  settingsTab: 'general' | 'advanced'
  settings: ProblemTypeSettings
  scanProgress?: CoreScanProgress | null
  problems?: CoreCleanupProblem[]
}

/**
 * 导出 ProblemTypeSettings 作为 CleanupSettings（扫描器使用）
 */
export type CleanupSettings = ProblemTypeSettings

/**
 * 保留 CoreCleanupSettings 的导出（仅用于 cleanup-problem.ts 内部）
 */
export type { CoreCleanupSettings }
