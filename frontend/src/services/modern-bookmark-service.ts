/**
 * @deprecated 此文件已废弃，请使用 @/infrastructure/chrome-api/bookmark-gateway
 * 
 * 现代化书签服务（Modern） - 基于 Chrome Bookmarks API 最新特性
 *
 * 此文件仅用于向后兼容，所有实现已迁移到 BookmarkAPIGateway
 */

// 向后兼容：重新导出新的实现
export {
  BookmarkAPIGateway as ModernBookmarkService,
  bookmarkAPIGateway as modernBookmarkService,
  type EnhancedBookmarkNode as ModernBookmarkNode,
  type BookmarkSearchOptions,
  type BookmarkRecommendationContext,
  getRecentBookmarks,
  searchBookmarks,
  getBookmarkRecommendations
} from '@/infrastructure/chrome-api/bookmark-gateway'
