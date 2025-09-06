/**
 * AcuityBookmarks Material Design 主题
 * 严格遵循Google Material Design 3.0规范，基于项目logo定制主题颜色
 */

// Material Design 3.0 颜色系统 - 基于logo的薄荷绿主题
export const colors = {
  // Primary Color Palette (基于logo的薄荷绿)
  primary: {
    primary: '#28c7a9',        // Primary 500 - 薄荷绿主色
    onPrimary: '#ffffff',      // 主色上的文字
    primaryContainer: '#a7f3d0', // Primary 200 - 浅薄荷绿容器
    onPrimaryContainer: '#064e3b', // 容器上的文字
  },

  // Secondary Color Palette (基于logo的深蓝)
  secondary: {
    secondary: '#14213d',      // Secondary 700 - 深蓝色
    onSecondary: '#ffffff',    // 次要色上的文字
    secondaryContainer: '#e0e7ff', // Secondary 100 - 浅蓝容器
    onSecondaryContainer: '#1e1b4b', // 容器上的文字
  },

  // Tertiary Color Palette
  tertiary: {
    tertiary: '#0f766e',       // Tertiary 600 - 深薄荷绿
    onTertiary: '#ffffff',     // 第三色上的文字
    tertiaryContainer: '#ccfbf1', // Tertiary 100 - 极浅薄荷绿
    onTertiaryContainer: '#134e4a', // 容器上的文字
  },

  // Surface Colors (Material Design 3.0)
  surface: {
    surface: '#fefefe',        // 主表面色
    onSurface: '#1a1c1e',      // 表面上的文字
    surfaceVariant: '#f4f4f5', // 表面变体
    onSurfaceVariant: '#44474e', // 表面变体上的文字
    surfaceContainer: '#f0f0f3', // 表面容器
    surfaceContainerHigh: '#e9e9ec', // 高层表面容器
    surfaceContainerHighest: '#e3e3e6', // 最高层表面容器
  },

  // Background Colors
  background: {
    background: '#fefefe',     // 主背景色
    onBackground: '#1a1c1e',   // 背景上的文字
  },

  // Outline Colors
  outline: {
    outline: '#74777f',        // 边框色
    outlineVariant: '#c4c7cf', // 边框变体
  },

  // Error Colors
  error: {
    error: '#ba1a1a',          // 错误色
    onError: '#ffffff',        // 错误色上的文字
    errorContainer: '#ffdad6', // 错误容器
    onErrorContainer: '#410002', // 错误容器上的文字
  },

  // Success Colors (Material Design扩展)
  success: {
    success: '#2e7d32',        // 成功色
    onSuccess: '#ffffff',      // 成功色上的文字
    successContainer: '#c8e6c9', // 成功容器
    onSuccessContainer: '#1b5e20', // 成功容器上的文字
  },

  // Warning Colors (Material Design扩展)
  warning: {
    warning: '#f57c00',        // 警告色
    onWarning: '#ffffff',      // 警告色上的文字
    warningContainer: '#ffe0b2', // 警告容器
    onWarningContainer: '#e65100', // 警告容器上的文字
  }
}

// Material Design 3.0 Elevation (阴影系统)
export const elevation = {
  level0: 'none',                                    // 无阴影
  level1: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
  level2: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
  level3: '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
  level4: '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
  level5: '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
}

// Material Design 3.0 Shape (形状系统)
export const shape = {
  corner: {
    none: '0px',
    extraSmall: '4px',
    small: '8px',
    medium: '12px',
    large: '16px',
    extraLarge: '28px',
    full: '50%',
  }
}

// Material Design 3.0 Typography Scale
export const typography = {
  // Display styles
  displayLarge: {
    fontSize: '57px',
    fontWeight: '400',
    lineHeight: '64px',
    letterSpacing: '-0.25px',
    color: colors.surface.onSurface,
  },
  displayMedium: {
    fontSize: '45px',
    fontWeight: '400',
    lineHeight: '52px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },
  displaySmall: {
    fontSize: '36px',
    fontWeight: '400',
    lineHeight: '44px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },

  // Headline styles
  headlineLarge: {
    fontSize: '32px',
    fontWeight: '400',
    lineHeight: '40px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },
  headlineMedium: {
    fontSize: '28px',
    fontWeight: '400',
    lineHeight: '36px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },
  headlineSmall: {
    fontSize: '24px',
    fontWeight: '400',
    lineHeight: '32px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },

  // Title styles
  titleLarge: {
    fontSize: '22px',
    fontWeight: '400',
    lineHeight: '28px',
    letterSpacing: '0px',
    color: colors.surface.onSurface,
  },
  titleMedium: {
    fontSize: '16px',
    fontWeight: '500',
    lineHeight: '24px',
    letterSpacing: '0.15px',
    color: colors.surface.onSurface,
  },
  titleSmall: {
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
    letterSpacing: '0.1px',
    color: colors.surface.onSurface,
  },

  // Label styles
  labelLarge: {
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
    letterSpacing: '0.1px',
    color: colors.surface.onSurface,
  },
  labelMedium: {
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '16px',
    letterSpacing: '0.5px',
    color: colors.surface.onSurface,
  },
  labelSmall: {
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '16px',
    letterSpacing: '0.5px',
    color: colors.surface.onSurface,
  },

  // Body styles
  bodyLarge: {
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '24px',
    letterSpacing: '0.5px',
    color: colors.surface.onSurface,
  },
  bodyMedium: {
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '20px',
    letterSpacing: '0.25px',
    color: colors.surface.onSurface,
  },
  bodySmall: {
    fontSize: '12px',
    fontWeight: '400',
    lineHeight: '16px',
    letterSpacing: '0.4px',
    color: colors.surface.onSurface,
  },

  // 自定义品牌样式 (基于Material Design扩展)
  brandTitle: {
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: '28px',
    letterSpacing: '0.15px',
    color: colors.secondary.secondary, // 使用深蓝色
  },
  brandSubtitle: {
    fontSize: '12px',
    fontWeight: '400',
    lineHeight: '16px',
    letterSpacing: '0.4px',
    color: colors.tertiary.tertiary, // 使用深薄荷绿
  },
}

// Material Design 3.0 Spacing System
export const spacing = {
  space0: '0px',
  space4: '4px',
  space8: '8px',
  space12: '12px',
  space16: '16px',
  space20: '20px',
  space24: '24px',
  space32: '32px',
  space40: '40px',
  space48: '48px',
  space56: '56px',
  space64: '64px',
}

// Material Design 3.0 Component Tokens
export const components = {
  // 品牌区域
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.space12,
    width: '100%',
  },

  // Logo样式
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: shape.corner.medium,
    objectFit: 'contain' as const,
  },

  // Filled Button (主要按钮)
  filledButton: {
    backgroundColor: colors.primary.primary,
    color: colors.primary.onPrimary,
    border: 'none',
    borderRadius: shape.corner.full,
    height: '40px',
    padding: `0 ${spacing.space24}`,
    boxShadow: elevation.level0,
    fontWeight: '500',
    fontSize: typography.labelLarge.fontSize,
    lineHeight: typography.labelLarge.lineHeight,
    letterSpacing: typography.labelLarge.letterSpacing,
  },

  // Outlined Button (次要按钮)
  outlinedButton: {
    backgroundColor: 'transparent',
    color: colors.primary.primary,
    border: `1px solid ${colors.outline.outline}`,
    borderRadius: shape.corner.full,
    height: '40px',
    padding: `0 ${spacing.space24}`,
    boxShadow: elevation.level0,
    fontWeight: '500',
    fontSize: typography.labelLarge.fontSize,
    lineHeight: typography.labelLarge.lineHeight,
    letterSpacing: typography.labelLarge.letterSpacing,
  },

  // Text Button (文本按钮)
  textButton: {
    backgroundColor: 'transparent',
    color: colors.primary.primary,
    border: 'none',
    borderRadius: shape.corner.full,
    height: '40px',
    padding: `0 ${spacing.space12}`,
    boxShadow: elevation.level0,
    fontWeight: '500',
    fontSize: typography.labelLarge.fontSize,
    lineHeight: typography.labelLarge.lineHeight,
    letterSpacing: typography.labelLarge.letterSpacing,
  },

  // Filled Card (填充卡片)
  filledCard: {
    backgroundColor: colors.surface.surfaceContainerHighest,
    color: colors.surface.onSurface,
    borderRadius: shape.corner.medium,
    boxShadow: elevation.level1,
    border: 'none',
    padding: spacing.space16,
  },

  // Outlined Card (轮廓卡片)
  outlinedCard: {
    backgroundColor: colors.surface.surface,
    color: colors.surface.onSurface,
    borderRadius: shape.corner.medium,
    boxShadow: elevation.level0,
    border: `1px solid ${colors.outline.outlineVariant}`,
    padding: spacing.space16,
  },

  // Elevated Card (悬浮卡片)
  elevatedCard: {
    backgroundColor: colors.surface.surfaceContainer,
    color: colors.surface.onSurface,
    borderRadius: shape.corner.medium,
    boxShadow: elevation.level1,
    border: 'none',
    padding: spacing.space16,
  },

  // Text Field (输入框)
  textField: {
    backgroundColor: colors.surface.surfaceVariant,
    color: colors.surface.onSurfaceVariant,
    borderRadius: `${shape.corner.extraSmall} ${shape.corner.extraSmall} 0 0`,
    border: 'none',
    borderBottom: `1px solid ${colors.outline.outline}`,
    padding: `${spacing.space16} ${spacing.space16} ${spacing.space8}`,
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight,
  },
}

// Material Design 3.0 CSS Custom Properties
export const cssVariables = `
  /* Primary Colors */
  --md-sys-color-primary: ${colors.primary.primary};
  --md-sys-color-on-primary: ${colors.primary.onPrimary};
  --md-sys-color-primary-container: ${colors.primary.primaryContainer};
  --md-sys-color-on-primary-container: ${colors.primary.onPrimaryContainer};

  /* Secondary Colors */
  --md-sys-color-secondary: ${colors.secondary.secondary};
  --md-sys-color-on-secondary: ${colors.secondary.onSecondary};
  --md-sys-color-secondary-container: ${colors.secondary.secondaryContainer};
  --md-sys-color-on-secondary-container: ${colors.secondary.onSecondaryContainer};

  /* Tertiary Colors */
  --md-sys-color-tertiary: ${colors.tertiary.tertiary};
  --md-sys-color-on-tertiary: ${colors.tertiary.onTertiary};
  --md-sys-color-tertiary-container: ${colors.tertiary.tertiaryContainer};
  --md-sys-color-on-tertiary-container: ${colors.tertiary.onTertiaryContainer};

  /* Surface Colors */
  --md-sys-color-surface: ${colors.surface.surface};
  --md-sys-color-on-surface: ${colors.surface.onSurface};
  --md-sys-color-surface-variant: ${colors.surface.surfaceVariant};
  --md-sys-color-on-surface-variant: ${colors.surface.onSurfaceVariant};
  --md-sys-color-surface-container: ${colors.surface.surfaceContainer};
  --md-sys-color-surface-container-high: ${colors.surface.surfaceContainerHigh};
  --md-sys-color-surface-container-highest: ${colors.surface.surfaceContainerHighest};

  /* Background Colors */
  --md-sys-color-background: ${colors.background.background};
  --md-sys-color-on-background: ${colors.background.onBackground};

  /* Outline Colors */
  --md-sys-color-outline: ${colors.outline.outline};
  --md-sys-color-outline-variant: ${colors.outline.outlineVariant};

  /* Error Colors */
  --md-sys-color-error: ${colors.error.error};
  --md-sys-color-on-error: ${colors.error.onError};
  --md-sys-color-error-container: ${colors.error.errorContainer};
  --md-sys-color-on-error-container: ${colors.error.onErrorContainer};

  /* Warning Colors */
  --md-sys-color-warning: ${colors.warning.warning};
  --md-sys-color-on-warning: ${colors.warning.onWarning};
  --md-sys-color-warning-container: ${colors.warning.warningContainer};
  --md-sys-color-on-warning-container: ${colors.warning.onWarningContainer};

  /* Elevation */
  --md-sys-elevation-level0: ${elevation.level0};
  --md-sys-elevation-level1: ${elevation.level1};
  --md-sys-elevation-level2: ${elevation.level2};
  --md-sys-elevation-level3: ${elevation.level3};
  --md-sys-elevation-level4: ${elevation.level4};
  --md-sys-elevation-level5: ${elevation.level5};

  /* Shape */
  --md-sys-shape-corner-none: ${shape.corner.none};
  --md-sys-shape-corner-extra-small: ${shape.corner.extraSmall};
  --md-sys-shape-corner-small: ${shape.corner.small};
  --md-sys-shape-corner-medium: ${shape.corner.medium};
  --md-sys-shape-corner-large: ${shape.corner.large};
  --md-sys-shape-corner-extra-large: ${shape.corner.extraLarge};
  --md-sys-shape-corner-full: ${shape.corner.full};
`

// Material Design 3.0 工具函数
export const utils = {
  // 应用Material Design主题变量到文档
  applyMaterialTheme: () => {
    const style = document.createElement('style')
    style.textContent = `:root { ${cssVariables} }`
    document.head.appendChild(style)
  },

  // 获取品牌标题样式
  getBrandTitleStyle: () => typography.brandTitle,

  // 获取品牌副标题样式
  getBrandSubtitleStyle: () => typography.brandSubtitle,

  // 获取填充按钮样式
  getFilledButtonStyle: () => components.filledButton,

  // 获取轮廓按钮样式
  getOutlinedButtonStyle: () => components.outlinedButton,

  // 获取文本按钮样式
  getTextButtonStyle: () => components.textButton,

  // 获取填充卡片样式
  getFilledCardStyle: () => components.filledCard,

  // 获取轮廓卡片样式
  getOutlinedCardStyle: () => components.outlinedCard,

  // 获取悬浮卡片样式
  getElevatedCardStyle: () => components.elevatedCard,

  // 获取输入框样式
  getTextFieldStyle: () => components.textField,
}
