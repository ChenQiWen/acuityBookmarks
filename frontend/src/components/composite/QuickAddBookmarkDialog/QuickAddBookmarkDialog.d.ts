/**
 * 快速添加书签对话框组件类型定义
 */

export interface QuickAddBookmarkDialogProps {
  /** 是否显示对话框 */
  show: boolean
  /** 书签标题 */
  title?: string
  /** 书签 URL */
  url?: string
  /** 网站图标 URL */
  favIconUrl?: string
  /** 是否启用 AI 自动分类 */
  enableAI?: boolean
}

export interface QuickAddBookmarkData {
  /** 书签标题 */
  title: string
  /** 书签 URL */
  url: string
  /** 目标文件夹 ID */
  folderId: string
}
