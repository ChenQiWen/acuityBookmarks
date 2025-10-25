/**
 * 书签清理领域的公共类型。
 */
import type { BookmarkNode } from './bookmark'

/** 单条清理异常记录。 */
export interface CleanupProblem {
  /** 异常类别 */
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  /** 严重程度 */
  severity: 'high' | 'medium' | 'low'
  /** 简要描述 */
  description: string
  /** 详细说明 */
  details?: string
  /** 是否支持自动修复 */
  canAutoFix: boolean
  /** 关联的书签 ID */
  bookmarkId: string
  /** 关联节点 ID 列表 */
  relatedNodeIds?: string[]
}

/** 清理任务的进度描述。 */
export interface CleanupTask {
  /** 任务类型 */
  type: '404' | 'duplicate' | 'empty' | 'invalid'
  /** 当前状态 */
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
  /** 已处理节点数量 */
  processed: number
  /** 总节点数量 */
  total: number
  /** 已发现问题数 */
  foundIssues: number
  /** 预估剩余时间 */
  estimatedTime?: string
  /** 错误信息 */
  error?: string
}

/**
 * 清理功能的配置项。
 *
 * 一键清理已废弃，这些配置仅用于健康扫描参数调整。
 */
export interface CleanupSettings {
  '404': {
    /** 请求超时时间（毫秒） */
    timeout: number
    /** 是否跳过 HTTPS */
    skipHttps: boolean
    /** 是否跟随重定向 */
    followRedirects: boolean
    /** 检测使用的 UA */
    userAgent: string
    /** 是否忽略 CORS 错误 */
    ignoreCors: boolean
  }
  duplicate: {
    /** 是否比较 URL */
    compareUrl: boolean
    /** 是否比较标题 */
    compareTitle: boolean
    /** 标题相似度阈值 */
    titleSimilarity: number
    /** 是否忽略域名 */
    ignoreDomain: boolean
    /** 保留策略 */
    keepNewest: 'newest' | 'oldest' | 'manual'
  }
  empty: {
    /** 是否递归检查空目录 */
    recursive: boolean
    /** 是否保留结构 */
    preserveStructure: boolean
    /** 最小深度 */
    minDepth: number
  }
  invalid: {
    /** 是否校验协议 */
    checkProtocol: boolean
    /** 是否校验域名 */
    checkDomain: boolean
    /** 是否允许 localhost */
    allowLocalhost: boolean
    /** 自定义正则模式 */
    customPatterns: string
  }
}

/** 清理 Store 的整体状态。 */
export interface CleanupState {
  /** 是否处于过滤模式 */
  isFiltering: boolean
  /** 当前激活的过滤器标签 */
  activeFilters: Array<'404' | 'duplicate' | 'empty' | 'invalid'>
  /** 是否正在扫描健康度 */
  isScanning: boolean
  /** 历史任务列表（保留兼容字段） */
  tasks: CleanupTask[]
  /** 节点 ID → 问题列表 */
  filterResults: Map<string, CleanupProblem[]>
  /** 图例展示控制 */
  legendVisibility: {
    all: boolean
    '404': boolean
    duplicate: boolean
    empty: boolean
    invalid: boolean
  }
  /** 是否展示设置面板 */
  showSettings: boolean
  /** 当前设置页签 */
  settingsTab: string
  /** 子页签（暂无使用，仅兼容） */
  activeSettingsTab?: string
  /** 扫描配置 */
  settings: CleanupSettings
}

/** 单个节点的清理扫描结果。 */
export interface CleanupScanResult {
  /** 节点 ID */
  nodeId: string
  /** 检测出的异常列表 */
  problems: CleanupProblem[]
  /** 原始书签节点 */
  originalNode: BookmarkNode
}
