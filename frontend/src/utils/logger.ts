/**
 * 日志工具（轻量封装）
 *
 * - 统一样式化输出，便于在开发者工具中快速分辨；
 * - 支持 info/warn/error/debug 四级；
 * - 在生产环境抑制 debug，避免噪音与性能影响。
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const levelToStyle: Record<LogLevel, string> = {
  info: 'background: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 3px;',
  warn: 'background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px;',
  error:
    'background: #ffebee; color: #b71c1c; padding: 2px 6px; border-radius: 3px;',
  debug:
    'background: #f3e5f5; color: #4a148c; padding: 2px 6px; border-radius: 3px;'
}

function formatLabel(scope: string, level: LogLevel): [string, string] {
  const style = levelToStyle[level] || levelToStyle.info
  return [`%c${scope}`, style]
}

export const logger = {
  info(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'info')

    console.info(label, style, ...args)
  },
  warn(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'warn')

    console.warn(label, style, ...args)
  },
  error(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'error')

    console.error(label, style, ...args)
  },
  debug(scope: string, ...args: unknown[]) {
    if (import.meta.env.DEV) {
      const [label, style] = formatLabel(scope, 'debug')

      // 使用 info 输出以符合 no-console 白名单
      console.info(label, style, ...args)
    }
  }
}
