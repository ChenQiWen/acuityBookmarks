/**
 * AcuityBookmarks 品牌色彩系统
 * 
 * 核心设计理念：
 * - 金黄色 (#ffd700): 代表"精选"、"高价值"、"智能发现"
 * - 深绿色 (#16a085): 代表"稳定"、"专业"、"可信赖"
 * - 黄色渐变: 品牌视觉识别的核心元素
 */

export const colors = {
  /**
   * 品牌主色
   */
  brand: {
    /** 金黄色 - 注册按钮、强调元素 */
    yellow: '#ffd700',
    /** 深绿色 - 登录按钮、主要操作 */
    green: '#16a085',
    /** 深绿色悬停态 */
    greenHover: '#138d75',
    /** 金黄色悬停态 */
    yellowHover: '#ffed4e',
    
    /** 品牌渐变 - 装饰区域背景 */
    gradient: {
      start: '#ffd54f',
      middle: '#ffeb3b',
      end: '#ffc107',
      /** CSS 渐变字符串 */
      css: 'linear-gradient(135deg, #ffd54f 0%, #ffeb3b 50%, #ffc107 100%)'
    }
  },

  /**
   * 语义化颜色
   */
  semantic: {
    /** 成功状态 */
    success: '#22c55e',
    successLight: 'rgba(34, 197, 94, 0.1)',
    successBorder: 'rgba(34, 197, 94, 0.5)',
    
    /** 错误状态 */
    error: '#ef4444',
    errorLight: 'rgba(239, 68, 68, 0.1)',
    errorBorder: 'rgba(239, 68, 68, 0.5)',
    
    /** 警告状态 */
    warning: '#f59e0b',
    warningLight: 'rgba(245, 158, 11, 0.1)',
    warningBorder: 'rgba(245, 158, 11, 0.5)',
    
    /** 信息状态 */
    info: '#3b82f6',
    infoLight: 'rgba(59, 130, 246, 0.1)',
    infoBorder: 'rgba(59, 130, 246, 0.5)'
  },

  /**
   * 灰度色阶
   */
  neutral: {
    white: '#ffffff',
    black: '#000000',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827'
  },

  /**
   * 文本颜色
   */
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    disabled: '#d1d5db',
    inverse: '#ffffff'
  },

  /**
   * 边框颜色
   */
  border: {
    default: '#e5e7eb',
    light: '#f3f4f6',
    strong: '#d1d5db',
    focus: '#3b82f6'
  },

  /**
   * 背景颜色
   */
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    overlay: 'rgba(0, 0, 0, 0.5)'
  }
} as const

/**
 * Chrome Material Design 兼容层
 * 将 AcuityBookmarks 品牌色映射到 Chrome Material Design 变量
 */
export const materialTheme = {
  // 主色调
  '--md-sys-color-primary': colors.brand.yellow,
  '--md-sys-color-on-primary': colors.neutral.black,
  '--md-sys-color-primary-container': colors.brand.gradient.start,
  '--md-sys-color-on-primary-container': colors.neutral.black,

  // 次要色
  '--md-sys-color-secondary': colors.brand.green,
  '--md-sys-color-on-secondary': colors.neutral.white,
  '--md-sys-color-secondary-container': colors.brand.greenHover,
  '--md-sys-color-on-secondary-container': colors.neutral.white,

  // 表面色
  '--md-sys-color-surface': colors.background.primary,
  '--md-sys-color-on-surface': colors.text.primary,
  '--md-sys-color-surface-variant': colors.background.secondary,
  '--md-sys-color-on-surface-variant': colors.text.secondary,

  // 错误色
  '--md-sys-color-error': colors.semantic.error,
  '--md-sys-color-on-error': colors.neutral.white,
  '--md-sys-color-error-container': colors.semantic.errorLight,
  '--md-sys-color-on-error-container': colors.semantic.error,

  // 边框
  '--md-sys-color-outline': colors.border.default,
  '--md-sys-color-outline-variant': colors.border.light
} as const

export type Colors = typeof colors
export type MaterialTheme = typeof materialTheme
