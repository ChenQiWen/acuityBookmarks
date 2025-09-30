/**
 * 轻量后端日志工具（Bun/Node 终端友好）
 * 提供 info/warn/error/debug 四个级别，统一作用域标签格式。
 */

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const DEFAULT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');
let CURRENT_LEVEL = DEFAULT_LEVEL;

function shouldLog(level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL];
}

function format(scope, level, args) {
  // 使用终端友好格式，不依赖 CSS 样式
  return [`[${scope}]`, ...args];
}

export const logger = {
  setLevel(level) {
    if (level in LEVEL_ORDER) CURRENT_LEVEL = level;
  },

  info(scope, ...args) {
    if (!shouldLog('info')) return;
    console.info(...format(scope, 'info', args));
  },
  warn(scope, ...args) {
    if (!shouldLog('warn')) return;
    console.warn(...format(scope, 'warn', args));
  },
  error(scope, ...args) {
    if (!shouldLog('error')) return;
    console.error(...format(scope, 'error', args));
  },
  debug(scope, ...args) {
    if (!shouldLog('debug')) return;
    (console.debug || console.log)(...format(scope, 'debug', args));
  }
};

export default logger;
