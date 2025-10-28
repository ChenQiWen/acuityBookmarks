/**
 * 应用服务层统一导出
 */

export * from './auth/auth-service'
export * from './bookmark/bookmark-app-service'
export * from './cleanup/cleanup-app-service'
export * from './health/health-app-service'
export * from './notification/notification-service'
export * from './settings/settings-app-service'
export * from './font/font-service'

// 筛选服务：导出新的 filterAppService 和兼容的 searchAppService
export {
  FilterAppService,
  filterAppService,
  searchAppService
} from './filter/filter-app-service'
