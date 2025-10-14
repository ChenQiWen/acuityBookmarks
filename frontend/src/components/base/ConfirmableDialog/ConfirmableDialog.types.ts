/**
 * ConfirmableDialog 组件类型定义
 */

export interface ConfirmableDialogProps {
  show: boolean
  confirmMessage?: string
  isDirty?: boolean
}

export interface ConfirmableDialogEmits {
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
}
