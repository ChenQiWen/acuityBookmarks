// 动态插入 Google Fonts link，并根据浏览器语言切换字体

const FONT_FAMILY_MAP: Record<string, { family: string; google: string }> = {
  'zh-CN': { family: 'Noto Sans SC', google: 'Noto+Sans+SC' },
  'zh-TW': { family: 'Noto Sans TC', google: 'Noto+Sans+TC' },
  'ja':    { family: 'Noto Sans JP', google: 'Noto+Sans+JP' },
  'ko':    { family: 'Noto Sans KR', google: 'Noto+Sans+KR' },
  'ar':    { family: 'Noto Sans Arabic', google: 'Noto+Sans+Arabic' },
  'default': { family: 'Noto Sans', google: 'Noto+Sans' }
};


export function injectDynamicFontLink() {
  const doInject = () => {
    let lang = 'en';
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      lang = chrome.i18n.getUILanguage();
    } else {
      lang = navigator.language || navigator.languages?.[0] || 'en';
    }
    console.log('[dynamic-font-link] chrome.i18n.getUILanguage() =', lang);
    alert(lang)
    let langKey = 'default';
    if (lang.startsWith('zh-CN') || lang.startsWith('zh-Hans')) langKey = 'zh-CN';
    else if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant') || lang.startsWith('zh-HK')) langKey = 'zh-TW';
    else if (lang.startsWith('ja')) langKey = 'ja';
    else if (lang.startsWith('ko')) langKey = 'ko';
    else if (lang.startsWith('ar')) langKey = 'ar';
    const font = FONT_FAMILY_MAP[langKey] || FONT_FAMILY_MAP['default'];
    const href = `https://fonts.googleapis.com/css2?family=${font.google}:wght@100..900&display=swap`;

    // 移除已存在的动态字体 link
    const old = document.getElementById('dynamic-google-font');
    if (old) old.remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = 'dynamic-google-font';
    document.head.appendChild(link);

    // 设置全局 CSS 变量，保证字体优先级
    document.documentElement.style.setProperty('--font-family-dynamic', `"${font.family}", sans-serif`);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doInject);
  } else {
    doInject();
  }
}
