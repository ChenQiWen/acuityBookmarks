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
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // 构建标识
  BUILD_ID: 'BID-b7f2d9',
  
  // 性能监控启用状态
  PERFORMANCE_MONITORING: true,
  
  // 详细日志启用状态
  VERBOSE_LOGGING: false
} as const

// === 导出类型 ===
export type PerformanceConfig = typeof PERFORMANCE_CONFIG
export type BookmarkConfig = typeof BOOKMARK_CONFIG
export type UIConfig = typeof UI_CONFIG
export type ChromeConfig = typeof CHROME_CONFIG
export type ErrorConfig = typeof ERROR_CONFIG
export type DebugConfig = typeof DEBUG_CONFIG