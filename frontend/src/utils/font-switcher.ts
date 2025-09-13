/**
 * 简单字体切换器
 * 根据语言动态更新CSS变量，实现字体切换
 * 类似Icon字体的使用方式，简单有效
 */

export type SupportedLanguage = 
  | 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'ar' 
  | 'es' | 'fr' | 'de' | 'ru';

export interface FontSwitcherState {
  currentLanguage: SupportedLanguage;
  isReady: boolean;
}

class FontSwitcher {
  private state: FontSwitcherState = {
    currentLanguage: 'en',
    isReady: false
  };

  private listeners: ((state: FontSwitcherState) => void)[] = [];

  /**
   * 初始化字体切换器
   */
  async initialize(): Promise<void> {
    console.log('🎨 初始化字体切换器...');
    
    // 强制预加载所有字体
    await this.preloadFonts();
    
    // 检测用户语言偏好
    const userLanguage = this.detectUserLanguage();
    
    // 设置初始语言
    this.switchLanguage(userLanguage);
    
    // 强制验证字体应用
    await this.verifyFontApplication();
    
    this.state.isReady = true;
    this.notifyListeners();
    
    console.log(`✅ 字体切换器初始化完成，当前语言: ${userLanguage}`);
  }

  /**
   * 切换语言字体
   */
  switchLanguage(language: SupportedLanguage): void {
    if (this.state.currentLanguage === language) {
      return;
    }

    console.log(`🌍 切换字体语言: ${this.state.currentLanguage} → ${language}`);

    // 更新CSS变量 - 使用强制优先级
    const fontFamily = this.getFontFamily(language);
    document.documentElement.style.setProperty(
      '--font-family-dynamic', 
      fontFamily
    );

    // 强制应用字体到body元素（覆盖系统默认）
    document.body.style.setProperty(
      'font-family', 
      fontFamily, 
      'important'
    );

    // 更新页面语言属性
    document.documentElement.lang = language;

    // 更新状态
    this.state.currentLanguage = language;
    
    // 保存用户偏好
    try {
      localStorage.setItem('acuity-font-language', language);
    } catch (error) {
      console.warn('保存字体语言偏好失败:', error);
    }

    // 通知监听器
    this.notifyListeners();

    console.log(`✅ 字体切换完成: ${language}, 字体栈: ${fontFamily}`);
    console.log('🎯 强制应用到body元素，覆盖系统默认字体');
  }

  /**
   * 获取当前状态
   */
  getState(): FontSwitcherState {
    return { ...this.state };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: FontSwitcherState) => void): () => void {
    this.listeners.push(listener);
    
    // 返回取消订阅函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取语言对应的字体族（强制Noto字体优先）
   */
  private getFontFamily(language: SupportedLanguage): string {
    // 使用更严格的字体定义，确保Noto字体优先
    const fontFamilies: Record<SupportedLanguage, string> = {
      'en': '"NotoSans", "Noto Sans", sans-serif',
      'zh-CN': '"NotoSansSC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "微软雅黑", sans-serif',
      'zh-TW': '"NotoSansTC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "微軟正黑體", sans-serif',
      'ja': '"NotoSansJP", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif',
      'ko': '"NotoSansKR", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif',
      'ar': '"NotoSansArabic", "Noto Sans Arabic", "Tahoma", "Arial Unicode MS", sans-serif',
      'es': '"NotoSans", "Noto Sans", sans-serif',
      'fr': '"NotoSans", "Noto Sans", sans-serif',
      'de': '"NotoSans", "Noto Sans", sans-serif',
      'ru': '"NotoSans", "Noto Sans", sans-serif'
    };

    return fontFamilies[language] || fontFamilies['en'];
  }

  /**
   * 检测用户语言偏好
   */
  private detectUserLanguage(): SupportedLanguage {
    // 1. 尝试从本地存储读取
    try {
      const saved = localStorage.getItem('acuity-font-language');
      if (saved && this.isSupportedLanguage(saved)) {
        console.log(`📱 使用保存的语言偏好: ${saved}`);
        return saved as SupportedLanguage;
      }
    } catch (error) {
      console.warn('读取语言偏好失败:', error);
    }

    // 2. 优先使用Chrome扩展API检测
    let browserLang = 'en';
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        browserLang = chrome.i18n.getUILanguage().toLowerCase();
        console.log(`🔧 使用Chrome扩展语言API: ${browserLang}`);
      } else {
        browserLang = navigator.language.toLowerCase();
        console.log(`🌐 使用浏览器语言API: ${browserLang}`);
      }
    } catch (error) {
      browserLang = navigator.language.toLowerCase();
      console.warn('Chrome语言检测失败，使用navigator.language:', error);
    }
    
    const detected = this.mapBrowserLanguage(browserLang);
    console.log(`🌍 最终检测结果: ${browserLang} → ${detected}`);
    return detected;
  }

  /**
   * 映射浏览器语言到支持的语言
   */
  private mapBrowserLanguage(browserLang: string): SupportedLanguage {
    const langMap: Record<string, SupportedLanguage> = {
      'zh-cn': 'zh-CN',
      'zh': 'zh-CN',
      'zh-tw': 'zh-TW',
      'zh-hk': 'zh-TW',
      'ja': 'ja',
      'ja-jp': 'ja',
      'ko': 'ko',
      'ko-kr': 'ko',
      'ar': 'ar',
      'es': 'es',
      'fr': 'fr', 
      'de': 'de',
      'ru': 'ru'
    };

    return langMap[browserLang] || 'en';
  }

  /**
   * 检查是否为支持的语言
   */
  private isSupportedLanguage(lang: string): boolean {
    const supported: SupportedLanguage[] = [
      'en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ar', 
      'es', 'fr', 'de', 'ru'
    ];
    return supported.includes(lang as SupportedLanguage);
  }

  /**
   * 强制预加载所有字体
   */
  private async preloadFonts(): Promise<void> {
    const fonts = [
      'NotoSans',
      'NotoSansSC', 
      'NotoSansTC',
      'NotoSansJP',
      'NotoSansKR',
      'NotoSansArabic'
    ];

    const loadPromises = fonts.map(async (fontFamily) => {
      try {
        // 使用Font Loading API强制加载字体
        const font = new FontFace(fontFamily, `url('../fonts/${fontFamily}-Regular.woff2') format('woff2')`);
        await font.load();
        document.fonts.add(font);
        return true;
      } catch (error) {
        console.warn(`字体加载失败: ${fontFamily}`, error);
        return false;
      }
    });

    const results = await Promise.all(loadPromises);
    const successCount = results.filter(Boolean).length;
    if (successCount < fonts.length) {
      console.warn(`部分字体加载失败: ${successCount}/${fonts.length}`);
    }
  }

  /**
   * 验证字体应用效果
   */
  private async verifyFontApplication(): Promise<void> {
    // 等待字体完全渲染
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 检查当前字体
    const computedStyle = getComputedStyle(document.body);
    const actualFont = computedStyle.fontFamily;
    
    // 如果仍然是系统字体，强制刷新
    if (actualFont.includes('PingFang') || actualFont.includes('Microsoft YaHei')) {
      this.forceRefreshFonts();
    }
  }

  /**
   * 强制刷新字体显示
   */
  private forceRefreshFonts(): void {
    // 临时移除并重新添加字体样式
    const style = document.createElement('style');
    style.textContent = `
      * {
        font-family: var(--font-family-dynamic) !important;
      }
      body, html {
        font-family: var(--font-family-dynamic) !important;
      }
    `;
    style.id = 'force-font-refresh';
    
    document.head.appendChild(style);
    
    // 强制重绘
    void document.body.offsetHeight;
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('字体状态监听器执行失败:', error);
      }
    });
  }
}

// 创建单例实例
export const fontSwitcher = new FontSwitcher();

// 便捷函数
export async function initializeFonts(): Promise<void> {
  await fontSwitcher.initialize();
}

export function switchToLanguage(language: SupportedLanguage): void {
  fontSwitcher.switchLanguage(language);
}

export function getCurrentFontState(): FontSwitcherState {
  return fontSwitcher.getState();
}

export function subscribeFontChanges(listener: (state: FontSwitcherState) => void): () => void {
  return fontSwitcher.subscribe(listener);
}

export default fontSwitcher;
