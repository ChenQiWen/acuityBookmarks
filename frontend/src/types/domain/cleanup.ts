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

/** 清理功能的配置项。 */
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
  /** 当前激活的过滤器 */
  activeFilters: Array<'404' | 'duplicate' | 'empty' | 'invalid'>
  /** 是否正在扫描 */
  isScanning: boolean
  /** 是否正在执行修复 */
  isExecuting?: boolean
  /** 是否刚刚完成 */
  justCompleted?: boolean
  /** 当前任务列表 */
  tasks: CleanupTask[]
  /** 节点 ID -> 异常列表 */
  filterResults: Map<string, CleanupProblem[]>
  /** 是否显示图例 */
  showLegend?: boolean
  /** 图例可见状态 */
  legendVisibility: {
    /** 全部 */
    all: boolean
    /** 404 */
    '404': boolean
    /** 重复 */
    duplicate: boolean
    /** 空目录 */
    empty: boolean
    /** 无效链接 */
    invalid: boolean
  }
  /** 是否展示设置面板 */
  showSettings: boolean
  /** 当前设置页签 */
  settingsTab: string
  /** 子页签 */
  activeSettingsTab?: string
  /** 当前配置 */
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
