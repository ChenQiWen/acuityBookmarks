export type LogLevel = 'info' | 'warn' | 'error';

const levelToStyle: Record<LogLevel, string> = {
  info: 'background: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 3px;',
  warn: 'background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px;',
  error: 'background: #ffebee; color: #b71c1c; padding: 2px 6px; border-radius: 3px;'
};

function formatLabel(scope: string, level: LogLevel): [string, string] {
  const style = levelToStyle[level] || levelToStyle.info;
  return [`%c${scope}`, style];
}

export const logger = {
  info(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'info');
    // eslint-disable-next-line no-console
    console.log(label, style, ...args);
  },
  warn(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'warn');
    // eslint-disable-next-line no-console
    console.warn(label, style, ...args);
  },
  error(scope: string, ...args: unknown[]) {
    const [label, style] = formatLabel(scope, 'error');
    // eslint-disable-next-line no-console
    console.error(label, style, ...args);
  }
};
