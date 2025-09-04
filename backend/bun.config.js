/**
 * Bun热更新配置
 * 优化开发体验和性能
 */

export default {
  // 热更新配置
  hotReload: {
    // 监听的文件扩展名
    extensions: ['.js', '.ts', '.json'],
    
    // 忽略的文件和目录
    ignore: [
      'node_modules/**',
      'test/**',
      '**/*.test.js',
      '**/*.test.ts',
      '.git/**',
      'logs/**',
      'tmp/**'
    ],
    
    // 热更新延迟（毫秒）
    debounce: 100,
    
    // 是否在热更新时清屏
    clearScreen: true,
    
    // 是否显示详细日志
    verbose: process.env.NODE_ENV === 'development'
  },

  // 开发服务器配置
  server: {
    port: process.env.PORT || 3000,
    hostname: process.env.HOST || 'localhost',
    
    // 优雅关闭超时时间
    gracefulShutdownTimeout: 5000,
    
    // 请求超时时间
    requestTimeout: 30000
  },

  // 性能优化
  performance: {
    // 启用HTTP/2（如果支持）
    http2: false,
    
    // 启用压缩
    compression: true,
    
    // 缓存配置
    cache: {
      maxAge: process.env.NODE_ENV === 'production' ? 86400 : 0
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json',
    
    // 热更新时的日志格式
    hotReloadFormat: '🔥 [Hot Reload] {message} ({timestamp})'
  }
};
