/**
 * 应用服务层统一导出
 */

// 认证
export * from './auth/auth-service'

// 通知
export * from './notification/notification-service'

// 字体
export * from './font/font-service'

// 向后兼容的便捷函数
export { injectDynamicFontLink } from './font/font-service'
export {
  showToast,
  showToastSuccess,
  showToastInfo,
  showToastWarning,
  showToastError
} from './notification/notification-service'

// 调度器
export * from './scheduler/scheduler-service'
