/**
 * AcuityBookmarks 品牌色彩系统
 * 
 * 核心设计理念：基于 Material Design 3 薄荷绿主题
 * - 薄荷绿 (#89EAD7): Material Design 种子色，代表"清新"、"智能"、"现代"
 * - 品牌色完全遵循 Material Design 3 规范
 * - 不覆盖 Material Design 自动生成的颜色系统
 */

export const colors = {
  /**
   * Material Design 主题色
   * 这些颜色直接来自 Material Design 3 的薄荷绿主题
   * 不应该被覆盖或修改
   */
  brand: {
    /** Material Design Primary - Logo 蓝色 (#3B82F6) */
    primary: '#3B82F6',
    /** Material Design Primary (dark) */
    primaryDark: '#1E40AF',
    /** Material Design Secondary - Logo 紫色 (#C026D3) */
    secondary: '#C026D3',
    /** Material Design Secondary (dark) */
    secondaryDark: '#86198F',
    
    /** 品牌渐变 - 蓝紫渐变，呼应 Logo */
    gradient: {
      start: '#3B82F6',
      middle: '#8B5CF6',
      end: '#C026D3',
      /** CSS 渐变字符串 */
      css: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #C026D3 100%)'
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
    infoBorder: 'rgba(59, 130, 246, 0.5)',
    
    /** AI 功能专用色 - 与 Logo 紫色标签一致 */
    ai: '#C026D3',
    aiLight: 'rgba(192, 38, 211, 0.1)',
    aiBorder: 'rgba(192, 38, 211, 0.5)'
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
 * Material Design 3 主题配置
 * 
 * ⚠️ 重要：AcuityBookmarks 完全使用 Material Design 3 自动生成的颜色系统
 * 
 * Material Design 会根据种子色 (#89EAD7) 自动生成完整的颜色方案，包括：
 * - primary, secondary, tertiary 及其变体
 * - surface, background 及其层级
 * - error, warning 等语义色
 * - 亮色/暗色主题的所有变体
 * 
 * 我们不应该手动覆盖这些颜色，除非有特殊需求。
 * 如果需要自定义颜色，应该在 Material Design Theme Builder 中调整，
 * 然后重新生成 material-theme.css
 * 
 * @see https://m3.material.io/theme-builder
 */
export const materialTheme = {
  // 保留语义化颜色的映射（这些不会被 Material Design 自动生成）
  '--md-ref-palette-error': colors.semantic.error,
  '--md-ref-palette-success': colors.semantic.success,
  '--md-ref-palette-warning': colors.semantic.warning,
  '--md-ref-palette-info': colors.semantic.info
} as const

export type Colors = typeof colors
export type MaterialTheme = typeof materialTheme
