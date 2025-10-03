// Chrome Extension 国际化辅助函数
// 用法：import { t } from '@/utils/i18n'; t('key')

export function t(key: string, substitutions?: string | string[]): string {
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }
  // fallback: 直接返回 key
  return key;
}

// Vue 3 指令：v-i18n="'key'"
import type { Directive } from 'vue';

export const vI18n: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.textContent = t(binding.value);
  },
  updated(el, binding) {
    el.textContent = t(binding.value);
  }
};
