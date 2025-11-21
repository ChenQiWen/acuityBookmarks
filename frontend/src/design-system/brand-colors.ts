/**
 * AcuityBookmarks 品牌色注入器
 * 
 * 从 design-tokens package 导入品牌色并注入到 DOM
 */

import { colors } from '@acuity-bookmarks/design-tokens'

/**
 * 将品牌色注入到 CSS 变量中
 */
export function injectBrandColors() {
  const root = document.documentElement
  
  // 注入 AcuityBookmarks 品牌色
  root.style.setProperty('--acuity-brand-yellow', colors.brand.yellow)
  root.style.setProperty('--acuity-brand-yellow-hover', colors.brand.yellowHover)
  root.style.setProperty('--acuity-brand-green', colors.brand.green)
  root.style.setProperty('--acuity-brand-green-hover', colors.brand.greenHover)
  root.style.setProperty('--acuity-gradient', colors.brand.gradient.css)

  // 覆盖 Material Design 主色
  root.style.setProperty('--md-sys-color-primary', colors.brand.yellow)
  root.style.setProperty('--md-sys-color-on-primary', '#000')
  root.style.setProperty('--md-sys-color-primary-container', colors.brand.yellowHover)
  root.style.setProperty('--md-sys-color-on-primary-container', '#000')

  // 覆盖 Material Design 次要色
  root.style.setProperty('--md-sys-color-secondary', colors.brand.green)
  root.style.setProperty('--md-sys-color-on-secondary', '#fff')
  root.style.setProperty('--md-sys-color-secondary-container', colors.brand.greenHover)
  root.style.setProperty('--md-sys-color-on-secondary-container', '#fff')

  console.log('✅ AcuityBookmarks brand colors injected')
}
