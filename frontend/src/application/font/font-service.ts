/**
 * 字体服务 - 应用服务层
 *
 * 职责：
 * - 智能检测文本语言并应用最优字体
 * - 管理字体策略和配置
 * - 提供动态字体应用功能
 * - 支持多语言字体优化
 */

import type { Result } from '../../core/common/result'
import { logger } from '../../infrastructure/logging/logger'
import type { DetectedLanguage, FontStrategy } from '@/types/application/font'

/**
 * 字体服务配置
 *
 * @deprecated 将在下一版本移至 @/types/application/font
 */
export interface FontServiceConfig {
  enableAutoDetection: boolean
  enableDynamicApplication: boolean
  debugMode: boolean
  systemUISelectors: string[]
  userContentSelectors: string[]
}

/**
 * 语言统计信息
 *
 * @deprecated 将在下一版本移至 @/types/application/font
 */
export interface LanguageStats {
  detectedLanguage: DetectedLanguage
  recommendedSystemFont: string | undefined
  recommendedContentFont: string | undefined
  textLength: number
  cleanLength: number
}

/**
 * 字体应用结果
 */
export interface FontApplicationResult {
  detectedLang: DetectedLanguage
  fontFamily: string
  strategy: FontStrategy
}

/**
 * 字体服务
 */
export class FontService {
  private config: FontServiceConfig
  private strategies: Map<DetectedLanguage, FontStrategy> = new Map()
  private observers: MutationObserver[] = []

  constructor(config: Partial<FontServiceConfig> = {}) {
    this.config = {
      enableAutoDetection: true,
      enableDynamicApplication: true,
      debugMode: import.meta.env.DEV,
      systemUISelectors: [
        '.system-ui',
        '.navigation',
        '.toolbar',
        '.menu',
        '.dialog-header',
        '.button',
        '.form-label',
        '.status-text'
      ],
      userContentSelectors: [
        '.user-content',
        '.bookmark-item',
        '.bookmark-title',
        '.folder-name',
        '.search-results'
      ],
      ...config
    }

    this.initializeFontStrategies()

    if (this.config.enableDynamicApplication) {
      this.setupDynamicFontApplication()
    }
  }

  /**
   * 初始化字体策略
   */
  private initializeFontStrategies(): void {
    // 中文内容优先策略
    this.strategies.set('zh', {
      systemUI: '"NotoSansSC", "PingFang SC", "Microsoft YaHei", sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'zh'
    })

    this.strategies.set('zh-CN', {
      systemUI: '"NotoSansSC", "PingFang SC", "Microsoft YaHei", sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'zh-CN'
    })

    this.strategies.set('zh-TW', {
      systemUI: '"NotoSansTC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      userContent:
        '"NotoSansTC", "NotoSansSC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'zh-TW'
    })

    // 日文内容优先策略
    this.strategies.set('ja', {
      systemUI:
        '"NotoSansJP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
      userContent:
        '"NotoSansJP", "NotoSansSC", "NotoSansTC", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'ja'
    })

    // 韩文内容优先策略
    this.strategies.set('ko', {
      systemUI:
        '"NotoSansKR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      userContent:
        '"NotoSansKR", "NotoSansJP", "NotoSansSC", "NotoSansTC", "NotoSans", system-ui, sans-serif',
      detected: 'ko'
    })

    // 阿拉伯文内容优先策略
    this.strategies.set('ar', {
      systemUI: '"NotoSansArabic", "Tahoma", "Arial Unicode MS", sans-serif',
      userContent:
        '"NotoSansArabic", "NotoSans", "NotoSansSC", "NotoSansTC", system-ui, sans-serif',
      detected: 'ar'
    })

    // 英文内容优先策略
    this.strategies.set('en', {
      systemUI:
        '"NotoSans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      userContent:
        '"NotoSans", "NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", system-ui, sans-serif',
      detected: 'en'
    })

    // 混合语言内容策略
    this.strategies.set('mixed', {
      systemUI:
        '"NotoSans", "NotoSansSC", "NotoSansJP", "NotoSansKR", system-ui, sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSansArabic", "NotoSans", system-ui, sans-serif',
      detected: 'mixed'
    })

    // 未知语言备选策略
    this.strategies.set('unknown', {
      systemUI: '"NotoSans", system-ui, sans-serif',
      userContent:
        '"NotoSans", "NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSansArabic", system-ui, sans-serif',
      detected: 'unknown'
    })
  }

  /**
   * 检测文本语言
   */
  detectLanguage(text: string): DetectedLanguage {
    if (!text || text.trim().length === 0) return 'unknown'

    // 移除标点符号和数字，只分析文字
    const cleanText = text.replace(
      /[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0750-\u077f\u3400-\u4dbf\u0041-\u005A\u0061-\u007A]/g,
      ''
    )

    if (cleanText.length === 0) return 'en' // 纯数字/符号，默认英文字体

    // 字符统计
    const stats = {
      chinese: 0,
      japanese: 0,
      korean: 0,
      arabic: 0,
      latin: 0,
      total: cleanText.length
    }

    for (const char of cleanText) {
      const code = char.charCodeAt(0)

      // 中文字符 (包括简繁体)
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf)
      ) {
        stats.chinese++
      }
      // 日文假名
      else if (
        (code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff)
      ) {
        stats.japanese++
      }
      // 韩文
      else if (code >= 0xac00 && code <= 0xd7af) {
        stats.korean++
      }
      // 阿拉伯文
      else if (
        (code >= 0x0600 && code <= 0x06ff) ||
        (code >= 0x0750 && code <= 0x077f)
      ) {
        stats.arabic++
      }
      // 拉丁字符
      else if (
        (code >= 0x0041 && code <= 0x005a) ||
        (code >= 0x0061 && code <= 0x007a)
      ) {
        stats.latin++
      }
    }

    // 计算比例
    const chineseRatio = stats.chinese / stats.total
    const japaneseRatio = stats.japanese / stats.total
    const koreanRatio = stats.korean / stats.total
    const arabicRatio = stats.arabic / stats.total
    const latinRatio = stats.latin / stats.total

    // 判断主要语言
    if (chineseRatio > 0.3) {
      return this.detectChineseVariant(text)
    }

    if (japaneseRatio > 0.1 || (japaneseRatio > 0.05 && chineseRatio > 0.1)) {
      return 'ja'
    }

    if (koreanRatio > 0.3) {
      return 'ko'
    }

    if (arabicRatio > 0.3) {
      return 'ar'
    }

    if (latinRatio > 0.7) {
      return 'en'
    }

    // 检测是否为混合语言
    const nonLatinTotal =
      chineseRatio + japaneseRatio + koreanRatio + arabicRatio
    if (nonLatinTotal > 0.2 && latinRatio > 0.2) {
      return 'mixed'
    }

    if (chineseRatio > 0.1) {
      return this.detectChineseVariant(text)
    }

    return 'unknown'
  }

  /**
   * 检测中文变体 (简体/繁体)
   */
  private detectChineseVariant(text: string): 'zh-CN' | 'zh-TW' {
    // 简化的简繁体检测 - 基于常见字符
    const simplifiedIndicators = [
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '他',
      '这',
      '中',
      '来'
    ]
    const traditionalIndicators = [
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '他',
      '這',
      '中',
      '來'
    ]

    let _simplifiedScore = 0
    let _traditionalScore = 0

    for (const char of simplifiedIndicators) {
      if (text.includes(char)) _simplifiedScore++
    }

    for (const char of traditionalIndicators) {
      if (text.includes(char)) _traditionalScore++
    }

    // 检测繁体特有字符
    const traditionalOnlyChars = /[繁體字線條]/
    if (traditionalOnlyChars.test(text)) {
      return 'zh-TW'
    }

    // 默认简体中文
    return 'zh-CN'
  }

  /**
   * 为元素应用智能字体
   */
  applySmartFont(
    element: HTMLElement,
    isSystemUI: boolean = false
  ): Result<FontApplicationResult, Error> {
    try {
      const text = element.textContent || ''
      const detectedLang = this.detectLanguage(text)
      const strategy =
        this.strategies.get(detectedLang) || this.strategies.get('unknown')!

      const fontFamily = isSystemUI ? strategy.systemUI : strategy.userContent
      element.style.fontFamily = fontFamily

      // 添加调试信息
      if (this.config.debugMode) {
        element.setAttribute('data-detected-lang', detectedLang)
        element.setAttribute(
          'data-font-strategy',
          isSystemUI ? 'system' : 'content'
        )
      }

      return ok({ detectedLang, fontFamily, strategy })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 批量处理页面元素
   */
  processPageElements(): Result<void, Error> {
    try {
      // 处理系统UI元素
      const systemSelector = this.config.systemUISelectors.join(', ')
      const systemElements = document.querySelectorAll(systemSelector)
      systemElements.forEach(element => {
        this.applySmartFont(element as HTMLElement, true)
      })

      // 处理用户内容元素
      const contentSelector = this.config.userContentSelectors.join(', ')
      const contentElements = document.querySelectorAll(contentSelector)
      contentElements.forEach(element => {
        this.applySmartFont(element as HTMLElement, false)
      })

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 设置动态字体应用 - 监听DOM变化
   */
  private setupDynamicFontApplication(): void {
    if (!this.config.enableDynamicApplication) return

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement

              // 检查是否为系统UI或用户内容
              const systemSelector = this.config.systemUISelectors.join(', ')
              const contentSelector =
                this.config.userContentSelectors.join(', ')

              const isSystemUI = element.closest(systemSelector) !== null
              const isUserContent = element.closest(contentSelector) !== null

              if (isSystemUI || isUserContent) {
                this.applySmartFont(element, isSystemUI)
              }

              // 递归处理子元素
              const allSelectors = `${systemSelector}, ${contentSelector}`
              const childElements = element.querySelectorAll(allSelectors)
              childElements.forEach(child => {
                const childIsSystemUI = child.closest(systemSelector) !== null
                this.applySmartFont(child as HTMLElement, childIsSystemUI)
              })
            }
          })
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    this.observers.push(observer)
  }

  /**
   * 手动刷新所有字体
   */
  refreshAllFonts(): Result<void, Error> {
    return this.processPageElements()
  }

  /**
   * 获取语言统计信息
   */
  getLanguageStats(text: string): LanguageStats {
    const detected = this.detectLanguage(text)
    const strategy = this.strategies.get(detected)

    return {
      detectedLanguage: detected,
      recommendedSystemFont: strategy?.systemUI,
      recommendedContentFont: strategy?.userContent,
      textLength: text.length,
      cleanLength: text.replace(
        /[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0750-\u077f\u0041-\u005A\u0061-\u007A]/g,
        ''
      ).length
    }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<FontServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): FontServiceConfig {
    return { ...this.config }
  }

  /**
   * 获取所有字体策略
   */
  getStrategies(): Map<DetectedLanguage, FontStrategy> {
    return new Map(this.strategies)
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

/**
 * 默认字体服务实例
 */
export const fontService = new FontService()

/**
 * 便捷函数（保持向后兼容）
 */
export function detectTextLanguage(text: string): DetectedLanguage {
  return fontService.detectLanguage(text)
}

export function applySmartFontToElement(
  element: HTMLElement,
  isSystemUI: boolean = false
): FontApplicationResult | null {
  const result = fontService.applySmartFont(element, isSystemUI)
  return result.ok ? result.value : null
}

export function initializeSmartFonts(): void {
  // 页面加载完成后自动处理
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const result = fontService.processPageElements()
        if (result.ok) {
          logger.info('FontService', '智能字体管理器已初始化')
        } else {
          logger.error('FontService', '智能字体管理器初始化失败', result.error)
        }
      }, 100)
    })
  } else {
    setTimeout(() => {
      const result = fontService.processPageElements()
      if (result.ok) {
        logger.info('FontService', '智能字体管理器已初始化')
      } else {
        logger.error('FontService', '智能字体管理器初始化失败', result.error)
      }
    }, 100)
  }
}
