/**
 * 应用服务层统一导出
 */

export * from './bookmark/bookmark-app-service'
export * from './cleanup/cleanup-app-service'
export * from './health/health-app-service'
export * from './notification/notification-service'
export * from './settings/settings-app-service'
export * from './font/font-service'

// 查询服务：导出新的 queryAppService 和兼容的旧名称
export {
  QueryAppService,
  queryAppService,
  searchAppService,
  filterAppService
} from './query/query-app-service'

// AI 服务
export { AIAppService, aiAppService } from './ai/ai-app-service'
