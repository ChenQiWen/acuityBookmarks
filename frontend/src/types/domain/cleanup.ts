/**
 * 清理相关类型定义
 * 从 core 层重新导出，保持类型统一入口
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

// 健康标签类型
export type HealthTag = '404' | 'duplicate' | 'empty' | 'invalid'

// 清理问题类型特定设置
export interface ProblemTypeSettings {
  '404': {
    timeout: number
    skipHttps: boolean
    followRedirects: boolean
    userAgent: string
    ignoreCors: boolean
  }
  duplicate: {
    compareUrl: boolean
    compareTitle: boolean
    titleSimilarity: number
    ignoreDomain: boolean
    keepNewest: 'oldest' | 'newest'
  }
  empty: {
    recursive: boolean
    ignoreBookmarksBar: boolean
    preserveStructure?: boolean
    minDepth?: number
  }
  invalid: {
    customPatterns?: string
    checkProtocol?: boolean
    checkDomain?: boolean
    allowLocalhost?: boolean
  }
}

// 图例可见性设置
export interface LegendVisibility {
  all: boolean
  '404': boolean
  duplicate: boolean
  empty: boolean
  invalid: boolean
  healthScore?: boolean
}

// 清理状态（UI 层）
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

// 导出 ProblemTypeSettings 作为 CleanupSettings（扫描器使用）
export type CleanupSettings = ProblemTypeSettings

// 保留 CoreCleanupSettings 的导出（仅用于 cleanup-problem.ts 内部）
export type { CoreCleanupSettings }
