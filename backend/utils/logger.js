/**
 * 轻量后端日志工具（Bun/Node/Cloudflare Workers 通用）
 *
 * 职责：
 * - 提供 info/warn/error/debug 四个日志级别
 * - 统一作用域标签格式，便于日志追踪
 * - 兼容 Cloudflare Workers 和 Node.js 环境
 *
 * 特性：
 * - 使用终端友好格式，不依赖 CSS 样式
 * - 支持运行时调整日志级别
 * - 环境自适应（开发环境默认 debug，生产环境默认 info）
 */

/**
 * 日志级别优先级映射
 *
 * 数字越大，级别越高，输出的日志越少
 */
const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }

// Cloudflare Workers 环境没有 process；这里做兼容处理，避免顶层访问导致 ReferenceError
const ENV =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.process !== 'undefined' &&
  globalThis.process?.env
    ? globalThis.process.env
    : {}
const DEFAULT_LEVEL =
  ENV.LOG_LEVEL || (ENV.NODE_ENV === 'development' ? 'debug' : 'info')
let CURRENT_LEVEL = DEFAULT_LEVEL

/**
 * 判断指定日志级别是否应该输出
 *
 * @param {string} level - 日志级别
 * @returns {boolean} 如果应该输出返回 true
 */
function shouldLog(level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL]
}

/**
 * 格式化日志输出
 *
 * @param {string} scope - 作用域标签
 * @param {string} level - 日志级别（未使用，保留用于扩展）
 * @param {Array} args - 日志参数
 * @returns {Array} 格式化后的参数数组
 */
function format(scope, level, args) {
  // 使用终端友好格式，不依赖 CSS 样式
  return [`[${scope}]`, ...args]
}

/**
 * 日志器对象
 *
 * 提供统一的日志输出接口
 */
export const logger = {
  /**
   * 设置日志级别
   *
   * @param {string} level - 日志级别（debug/info/warn/error/silent）
   */
  setLevel(level) {
    if (level in LEVEL_ORDER) CURRENT_LEVEL = level
  },

  /**
   * 输出 info 级别日志
   *
   * @param {string} scope - 作用域标签
   * @param {...any} args - 要输出的内容
   */
  info(scope, ...args) {
    if (!shouldLog('info')) return
    console.info(...format(scope, 'info', args))
  },

  /**
   * 输出 warn 级别日志
   *
   * @param {string} scope - 作用域标签
   * @param {...any} args - 要输出的内容
   */
  warn(scope, ...args) {
    if (!shouldLog('warn')) return
    console.warn(...format(scope, 'warn', args))
  },

  /**
   * 输出 error 级别日志
   *
   * @param {string} scope - 作用域标签
   * @param {...any} args - 要输出的内容
   */
  error(scope, ...args) {
    if (!shouldLog('error')) return
    console.error(...format(scope, 'error', args))
  },

  /**
   * 输出 debug 级别日志
   *
   * @param {string} scope - 作用域标签
   * @param {...any} args - 要输出的内容
   */
  debug(scope, ...args) {
    if (!shouldLog('debug')) return
    ;(console.debug || console.log)(...format(scope, 'debug', args))
  }
}

export default logger
