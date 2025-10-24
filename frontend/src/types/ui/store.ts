import type { BookmarkNode } from '@/types/domain/bookmark'

export interface SidebarState {
  isOpen: boolean
  activeTab: 'bookmarks' | 'cleanup' | 'settings'
}

export interface SnackbarState {
  show: boolean
  text: string
  color: 'info' | 'success' | 'warning' | 'error'
  timeout: number
}

export interface DialogState {
  isOpen: boolean
  data?: unknown
}

export interface TreeSelectionState {
  selectedIds: Set<string>
  lastSelectedId?: string
}

export interface BookmarkDialogPayload {
  bookmark: BookmarkNode
  mode: 'edit' | 'delete'
}

export interface UIState {
  sidebar: SidebarState
  snackbar: SnackbarState
  dialogs: Record<string, DialogState>
  selection: TreeSelectionState
}

export const DEFAULT_SNACKBAR_STATE: SnackbarState = {
  show: false,
  text: '',
  color: 'info',
  timeout: 3000
}
