/**
 * 清理功能相关类型定义
 * 完全独立的类型系统，不与现有类型混合
 */

export interface CleanupProblem {
  type: '404' | 'duplicate' | 'empty' | 'invalid' // 问题类型
  severity: 'high' | 'medium' | 'low' // 问题严重性
  description: string // 问题描述
  details?: string // 问题详细信息
  canAutoFix: boolean // 是否可以自动修复
  bookmarkId: string // 关联的书签ID
  relatedNodeIds?: string[] // 对于重复问题，关联的其他节点ID
}

export interface CleanupTask {
  type: '404' | 'duplicate' | 'empty' | 'invalid' // 任务类型
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled' // 任务状态
  processed: number // 已处理数量
  total: number // 总数量
  foundIssues: number // 发现问题数量
  estimatedTime?: string // 估计完成时间
  error?: string // 错误信息
}

export interface CleanupSettings {
  '404': {
    timeout: number // 超时时间
    skipHttps: boolean // 是否跳过 HTTPS
    followRedirects: boolean // 是否遵循重定向
    userAgent: string // 用户代理
    ignoreCors: boolean // 是否忽略 CORS
  }
  duplicate: {
    compareUrl: boolean // 是否比较 URL
    compareTitle: boolean // 是否比较标题
    titleSimilarity: number // 标题相似度阈值
    ignoreDomain: boolean // 是否忽略域名
    keepNewest: 'newest' | 'oldest' | 'manual' // 保留最新/旧est/手动
  }
  empty: {
    recursive: boolean // 是否递归检查
    preserveStructure: boolean // 是否保留结构
    minDepth: number // 最小深度
  }
  invalid: {
    checkProtocol: boolean // 是否检查协议
    checkDomain: boolean // 是否检查域名
    allowLocalhost: boolean // 是否允许 localhost
    customPatterns: string // 自定义模式
  }
}

export interface CleanupState {
  // 筛选控制
  isFiltering: boolean // 是否正在筛选
  activeFilters: Array<'404' | 'duplicate' | 'empty' | 'invalid'> // 当前激活的筛选器

  // 扫描状态
  isScanning: boolean // 是否正在扫描
  isExecuting?: boolean // 正在执行清理
  justCompleted?: boolean // 刚完成检测（用于UI反馈）
  tasks: CleanupTask[] // 当前运行的任务列表

  // 筛选结果
  filterResults: Map<string, CleanupProblem[]> // nodeId -> problems

  // UI控制
  showLegend?: boolean // 显示图例
  legendVisibility: {
    // 图例可见性
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

import type { BookmarkNode } from './index'

export interface CleanupScanResult {
  nodeId: string // 节点ID
  problems: CleanupProblem[] // 发现的问题列表
  originalNode: BookmarkNode // 原始节点
}

// 设置项类型定义
export interface SettingItem {
  key: string // 设置项键
  label: string // 设置项标签
  type: 'switch' | 'slider' | 'select' | 'radio' | 'textarea' // 设置项类型
  default: unknown // 默认值
  description: string // 设置项描述
  min?: number // 最小值（适用于滑块）
  max?: number // 最大值（适用于滑块）
  step?: number // 步长（适用于滑块）
  unit?: string // 单位（适用于滑块）
  options?: Array<{ value: string; label: string }> // 选项（适用于选择器）
  placeholder?: string // 占位符（适用于文本区域）
  dependsOn?: string // 依赖项（适用于条件显示）
}

// 默认设置
export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  '404': {
    timeout: 15, // 超时时间（秒）
    skipHttps: true, // 是否跳过 HTTPS
    followRedirects: true, // 是否遵循重定向
    userAgent: 'chrome', // 用户代理
    ignoreCors: true // 是否忽略 CORS
  },
  duplicate: {
    compareUrl: true, // 是否比较 URL
    compareTitle: false, // 是否比较标题
    titleSimilarity: 0.8, // 标题相似度阈值
    ignoreDomain: false, // 是否忽略域名
    keepNewest: 'newest' // 保留最新/旧est/手动
  },
  empty: {
    recursive: true, // 是否递归检查
    preserveStructure: true, // 是否保留结构
    minDepth: 2 // 最小深度
  },
  invalid: {
    checkProtocol: true, // 是否检查协议
    checkDomain: true, // 是否检查域名
    allowLocalhost: false, // 是否允许 localhost
    customPatterns: '' // 自定义模式
  }
}
