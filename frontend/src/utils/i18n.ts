/*
 * 国际化辅助（Chrome i18n Helpers）
 *
 * 目标：
 * - 统一封装 chrome.i18n.getMessage 为 t()；
 * - 提供 v-i18n 指令，自动填充元素文本；
 *
 * 边界与约束：
 * - 非扩展环境回退为返回 key；
 * - 不做复杂占位符格式化，仅透传 substitutions。
 *
 * 用法：
 * - import { t } from '@/utils/i18n'; t('key')
 */

export function t(key: string, substitutions?: string | string[]): string {
  if (
    typeof chrome !== 'undefined' &&
    chrome.i18n &&
    typeof chrome.i18n.getMessage === 'function'
  ) {
    return chrome.i18n.getMessage(key, substitutions) || key
  }
  // fallback: 直接返回 key
  return key
}

// Vue 3 指令：v-i18n="'key'"
import type { Directive } from 'vue'

export const vI18n: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.textContent = t(binding.value)
  },
  updated(el, binding) {
    el.textContent = t(binding.value)
  }
}
