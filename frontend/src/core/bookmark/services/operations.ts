// Bridge wrapper: 按架构规划，鼓励使用应用服务而非直接使用 Manager
// 仍保留对 utils 管理器的兼容转发，同时导出应用层服务以便迁移
export { SmartBookmarkManager, smartBookmarkManager } from '@/utils/smart-bookmark-manager'
export { bookmarkChangeAppService } from '@/application/bookmark/bookmark-change-app-service'
