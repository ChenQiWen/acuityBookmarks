/**
 * 清理功能相关类型定义
 * 完全独立的类型系统，不与现有类型混合
 */

export interface CleanupProblem {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  severity: 'high' | 'medium' | 'low'
  description: string
  details?: string
  canAutoFix: boolean
  bookmarkId: string // 关联的书签ID
  relatedNodeIds?: string[] // 对于重复问题，关联的其他节点ID
}

export interface CleanupTask {
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
  processed: number
  total: number
  foundIssues: number
  estimatedTime?: string
  error?: string
}

export interface CleanupSettings {
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
    keepNewest: 'newest' | 'oldest' | 'manual'
  }
  empty: {
    recursive: boolean
    preserveStructure: boolean
    minDepth: number
  }
  invalid: {
    checkProtocol: boolean
    checkDomain: boolean
    allowLocalhost: boolean
    customPatterns: string
  }
}

export interface CleanupState {
  // 筛选控制
  isFiltering: boolean
  activeFilters: ('404' | 'duplicate' | 'empty' | 'invalid')[]

  // 扫描状态
  isScanning: boolean
  isExecuting?: boolean // 正在执行清理
  justCompleted?: boolean // 刚完成检测（用于UI反馈）
  tasks: CleanupTask[]

  // 筛选结果
  filterResults: Map<string, CleanupProblem[]> // nodeId -> problems

  // UI控制
  showLegend?: boolean // 显示图例
  legendVisibility: {
    all: boolean
    '404': boolean
    duplicate: boolean
    empty: boolean
    invalid: boolean
  }

  // 设置
  showSettings: boolean
  settingsTab: string
  activeSettingsTab?: string // 当前活动的设置标签
  settings: CleanupSettings
}

export interface CleanupScanResult {
  nodeId: string
  problems: CleanupProblem[]
  originalNode: any // BookmarkNode
}

// 设置项类型定义
export interface SettingItem {
  key: string
  label: string
  type: 'switch' | 'slider' | 'select' | 'radio' | 'textarea'
  default: any
  description: string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  dependsOn?: string
}

// 默认设置
export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  '404': {
    timeout: 15,
    skipHttps: true,
    followRedirects: true,
    userAgent: 'chrome',
    ignoreCors: true
  },
  duplicate: {
    compareUrl: true,
    compareTitle: false,
    titleSimilarity: 0.8,
    ignoreDomain: false,
    keepNewest: 'newest'
  },
  empty: {
    recursive: true,
    preserveStructure: true,
    minDepth: 2
  },
  invalid: {
    checkProtocol: true,
    checkDomain: true,
    allowLocalhost: false,
    customPatterns: ''
  }
}
