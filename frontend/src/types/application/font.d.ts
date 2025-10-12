/**
 * 字体服务应用层类型定义
 *
 * 包含字体加载和管理相关的所有类型定义
 */

/**
 * 检测到的语言类型
 *
 * 系统支持的语言列表
 */
export type DetectedLanguage =
  | 'zh' // 中文（通用）
  | 'zh-CN' // 简体中文
  | 'zh-TW' // 繁体中文
  | 'ja' // 日语
  | 'ko' // 韩语
  | 'ar' // 阿拉伯语
  | 'en' // 英语
  | 'mixed' // 混合语言
  | 'unknown' // 未知语言

/**
 * 字体策略接口
 *
 * 定义字体加载策略
 */
export interface FontStrategy {
  /** 系统UI字体 */
  systemUI: string

  /** 用户内容字体 */
  userContent: string

  /** 检测到的语言 */
  detected: DetectedLanguage

  /** 策略名称 */
  name?: string

  /** 字体族 */
  fontFamily?: string

  /** 字体权重 */
  fontWeight?: number | string

  /** 字体样式 */
  fontStyle?: 'normal' | 'italic' | 'oblique'

  /** 字体变体 */
  fontVariant?: string

  /** 是否为本地字体 */
  isLocal?: boolean

  /** 字体 URL */
  url?: string

  /** 字体格式 */
  format?: 'woff' | 'woff2' | 'truetype' | 'opentype'
}

/**
 * 字体加载选项接口
 *
 * 配置字体加载行为
 */
export interface FontLoadOptions {
  /** 超时时间（毫秒） */
  timeout?: number

  /** 是否使用本地字体 */
  useLocalFonts?: boolean

  /** 是否预加载 */
  preload?: boolean

  /** 字体显示策略 */
  fontDisplay?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'

  /** 回退字体 */
  fallback?: string[]
}

/**
 * 字体状态接口
 *
 * 字体的加载状态
 */
export interface FontStatus {
  /** 字体名称 */
  name: string

  /** 加载状态 */
  status: 'loading' | 'loaded' | 'failed'

  /** 是否可用 */
  available: boolean

  /** 加载时间（毫秒） */
  loadTime?: number

  /** 错误信息 */
  error?: string
}

/**
 * 字体管理器配置接口
 *
 * 字体管理器的配置选项
 */
export interface FontManagerConfig {
  /** 默认字体族 */
  defaultFontFamily: string

  /** 是否启用字体子集化 */
  enableSubset: boolean

  /** 是否启用字体预加载 */
  enablePreload: boolean

  /** 最大并发加载数 */
  maxConcurrentLoads: number

  /** 缓存策略 */
  cacheStrategy: 'memory' | 'indexeddb' | 'none'

  /** 缓存过期时间（毫秒） */
  cacheExpiry: number
}

/**
 * 字体集合接口
 *
 * 一组相关的字体
 */
export interface FontCollection {
  /** 集合名称 */
  name: string

  /** 语言 */
  language: DetectedLanguage

  /** 字体列表 */
  fonts: FontStrategy[]

  /** 是否默认加载 */
  autoLoad: boolean

  /** 优先级 */
  priority: number
}

/**
 * 字体度量接口
 *
 * 字体的度量信息
 */
export interface FontMetrics {
  /** 字体名称 */
  fontFamily: string

  /** 字体大小 */
  fontSize: number

  /** 行高 */
  lineHeight: number

  /** 字符宽度 */
  charWidth: number

  /** 上升高度 */
  ascent: number

  /** 下降高度 */
  descent: number

  /** x 高度 */
  xHeight: number

  /** 大写字母高度 */
  capHeight: number
}

/**
 * 字体性能统计接口
 *
 * 字体加载的性能统计
 */
export interface FontPerformanceStats {
  /** 总加载字体数 */
  totalFonts: number

  /** 成功加载数 */
  loadedFonts: number

  /** 失败数 */
  failedFonts: number

  /** 总加载时间（毫秒） */
  totalLoadTime: number

  /** 平均加载时间（毫秒） */
  avgLoadTime: number

  /** 缓存命中数 */
  cacheHits: number

  /** 缓存未命中数 */
  cacheMisses: number
}
