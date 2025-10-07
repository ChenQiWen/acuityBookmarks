/**
 * 应用程序配置常量
 * 基于产品文档的设计理念，优化性能和用户体验
 */

// === 性能配置 ===
export const PERFORMANCE_CONFIG = {
  // 数据缓存时间（毫秒）- 平衡性能和数据新鲜度
  DATA_CACHE_TIME: 5000,

  // 书签悬停防抖时间（毫秒）- 优化交互响应性
  HOVER_DEBOUNCE_TIME: 200,

  // 搜索防抖时间（毫秒）- 减少API调用频率
  SEARCH_DEBOUNCE_TIME: 300,

  // 页面关闭延迟（毫秒）- 确保操作完成
  PAGE_CLOSE_DELAY: 1000,

  // AI组织页面关闭延迟（毫秒）
  AI_PAGE_CLOSE_DELAY: 1500,

  // 通知自动隐藏时间（毫秒）
  NOTIFICATION_HIDE_DELAY: 3000,

  // 复制操作模拟延迟（毫秒）- 提升用户体验
  COPY_SIMULATION_DELAY: 300,

  // 指纹校验延迟（毫秒）- 避免初始化冲突
  FINGERPRINT_CHECK_DELAY: 300
} as const

// === 书签管理配置 ===
export const BOOKMARK_CONFIG = {
  // 搜索结果限制 - 基于用户体验优化
  SEARCH_LIMIT: 20,

  // 大数据集阈值 - 超过此数量启用性能优化
  LARGE_DATASET_THRESHOLD: 1000,

  // 批量处理大小 - 避免阻塞UI
  BATCH_PROCESS_SIZE: 100,

  // IntersectionObserver根边距 - 优化懒加载
  OBSERVER_ROOT_MARGIN: '100px',

  // IntersectionObserver阈值
  OBSERVER_THRESHOLD: 0.01,

  // 搜索历史最大长度
  MAX_SEARCH_HISTORY: 10
} as const

// === UI交互配置 ===
export const UI_CONFIG = {
  // 拖拽动画时间（毫秒）
  DRAG_ANIMATION_TIME: 150,

  // 拖拽交换阈值
  DRAG_SWAP_THRESHOLD: 0.65,

  // 等待元素出现超时时间（毫秒）
  ELEMENT_WAIT_TIMEOUT: 1500,

  // 滚动行为配置
  SCROLL_BEHAVIOR: {
    behavior: 'smooth' as const,
    block: 'nearest' as const,
    inline: 'center' as const
  }
} as const

// === Chrome API配置 ===
export const CHROME_CONFIG = {
  // 书签栏ID
  BOOKMARKS_BAR_ID: '1',

  // 其他书签ID
  OTHER_BOOKMARKS_ID: '2',

  // API调用重试次数
  API_RETRY_COUNT: 3,

  // API调用超时时间（毫秒）
  API_TIMEOUT: 10000,

  // 并发API调用限制
  MAX_CONCURRENT_CALLS: 5
} as const

// === 错误处理配置 ===
export const ERROR_CONFIG = {
  // 默认错误消息
  DEFAULT_ERROR_MESSAGE: '操作失败，请重试',

  // Chrome API错误消息映射
  CHROME_ERROR_MESSAGES: {
    'Extension context invalidated': '扩展上下文已失效，请刷新页面',
    'Cannot access contents of the page': '无法访问页面内容，请检查权限',
    'The operation was interrupted': '操作被中断，请重试'
  },

  // 错误重试间隔（毫秒）
  RETRY_DELAY: 1000,

  // 最大重试次数
  MAX_RETRY_ATTEMPTS: 3
} as const

// === 调试配置 ===
export const DEBUG_CONFIG = {
  // 开发环境标识
  IS_DEVELOPMENT: import.meta.env.DEV,

  // 性能监控启用状态
  PERFORMANCE_MONITORING: true,

  // 详细日志启用状态
  VERBOSE_LOGGING: false
} as const

// === API 基础配置（新增：支持线上/本地环境切换） ===
export const API_CONFIG = {
  // 优先使用显式配置，其次使用开发环境默认值
  API_BASE:
    // 优先显式变量（两者都支持）
    (import.meta.env.VITE_CLOUDFLARE_MODE === 'true'
      ? import.meta.env.VITE_CLOUDFLARE_WORKER_URL ||
        import.meta.env.VITE_API_BASE_URL
      : import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_CLOUDFLARE_WORKER_URL) ||
    // 开发默认走 Cloudflare 本地（wrangler dev 默认 8787）
    (import.meta.env.DEV
      ? 'http://127.0.0.1:8787'
      : 'https://api.acuitybookmarks.com'),
  ENDPOINTS: {
    crawl: '/api/crawl',
    checkUrls: '/api/check-urls'
  }
} as const

// === 爬虫配置（新增：本地-only、限速与调度） ===
export const CRAWLER_CONFIG = {
  // 模式：'local' | 'hybrid' | 'serverless'
  MODE:
    (import.meta.env.VITE_CRAWLER_MODE as 'local' | 'hybrid' | 'serverless') ||
    'local',

  // 并发与批量控制（避免影响用户网络体验）
  CONCURRENCY: Number(import.meta.env.VITE_CRAWLER_CONCURRENCY || 2),
  PER_DOMAIN_CONCURRENCY: Number(
    import.meta.env.VITE_CRAWLER_PER_DOMAIN_CONCURRENCY || 1
  ),
  BATCH_SIZE: Number(import.meta.env.VITE_CRAWLER_BATCH_SIZE || 5),
  BATCH_INTERVAL_MS: Number(
    import.meta.env.VITE_CRAWLER_BATCH_INTERVAL_MS || 1500
  ),

  // 频率控制
  DAILY_LIMIT: Number(import.meta.env.VITE_CRAWLER_DAILY_LIMIT || 200),
  FAILED_RETRY_INTERVAL_MS: 24 * 60 * 60 * 1000,

  // 调度策略
  USE_IDLE_SCHEDULING:
    import.meta.env.VITE_CRAWLER_USE_IDLE_SCHEDULING === 'false' ? false : true,
  IDLE_DELAY_MS: Number(import.meta.env.VITE_CRAWLER_IDLE_DELAY_MS || 3000),

  // 合规与请求头
  RESPECT_ROBOTS:
    import.meta.env.VITE_CRAWLER_RESPECT_ROBOTS === 'false' ? false : true,
  REQUEST_HEADERS: {
    userAgent: 'AcuityBookmarks-Extension/1.0',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
} as const

// === AI配置（新增：支持提供者选择与自动检测） ===
export const AI_CONFIG = {
  // 可选值：'auto' | 'chrome' | 'cloudflare'
  PROVIDER:
    (import.meta.env.VITE_AI_PROVIDER as 'auto' | 'chrome' | 'cloudflare') ||
    'auto',
  // 默认温度与最大tokens，兼容现有调用
  DEFAULT_TEMPERATURE: 0.6,
  DEFAULT_MAX_TOKENS: 256,
  // 新增：Prompt API最佳实践所需参数
  DEFAULT_TOP_K: 40,
  // 可选：指定Chrome内置模型名称（根据环境），默认使用内置模型
  CHROME_MODEL: (import.meta.env.VITE_CHROME_MODEL as string) || 'builtin',
  // 统一Cloudflare默认模型常量
  CLOUDFLARE_DEFAULT_MODEL:
    (import.meta.env.VITE_CLOUDFLARE_DEFAULT_MODEL as string) ||
    '@cf/meta/llama-3.1-8b-instruct',
  // 初始提示（系统指令等），用于会话初始化
  INITIAL_PROMPTS: (() => {
    const raw = import.meta.env.VITE_AI_INITIAL_PROMPTS as string | undefined
    if (raw && raw.trim()) {
      // 约定以 \n\n 分隔多段初始提示
      return raw
        .split('\n\n')
        .map(s => s.trim())
        .filter(Boolean)
    }
    return [
      'You are AcuityBookmarks assistant. Help organize and search bookmarks efficiently.',
      'Prefer concise, actionable answers. Chinese UI; respond in Chinese by default.'
    ]
  })(),
  TAG_GENERATION_PROMPT: `You are a bookmark tagging assistant. Based on the bookmark's title and content, generate 2-3 relevant tags.
- Tags should be concise and high-level (e.g., "React", "JavaScript", "Web Development").
- Output only a JSON array of strings, with no extra explanations.
- Example input: "useCallback - React", content: "useCallback is a React Hook..."
- Example output: ["React", "Hook", "Performance"]`
} as const

// === 导出类型 ===
export type PerformanceConfig = typeof PERFORMANCE_CONFIG
export type BookmarkConfig = typeof BOOKMARK_CONFIG
export type UIConfig = typeof UI_CONFIG
export type ChromeConfig = typeof CHROME_CONFIG
export type ErrorConfig = typeof ERROR_CONFIG
export type DebugConfig = typeof DEBUG_CONFIG
export type ApiConfig = typeof API_CONFIG
export type CrawlerConfig = typeof CRAWLER_CONFIG
export type AiConfig = typeof AI_CONFIG
