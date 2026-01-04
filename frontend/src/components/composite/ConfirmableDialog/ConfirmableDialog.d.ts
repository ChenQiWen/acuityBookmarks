export interface ConfirmableDialogProps {
  /** 是否显示 */
  modelValue?: boolean
  /** 标题文案 */
  title?: string
  /** 内容文案 */
  message?: string
  /** 确认按钮文本 */
  confirmLabel?: string
  /** 取消按钮文本 */
  cancelLabel?: string
  /** 是否危险提示 */
  danger?: boolean
  /** 是否存在未保存修改 */
  isDirty?: boolean
  /** 自定义提示文案 */
  confirmMessage?: string // 自定义提示文案
  /** 兼容 show 控制 */
  show?: boolean
}

export interface ConfirmableDialogEmits {
  (event: 'update:modelValue', value: boolean): void // 更新显隐
  (event: 'confirm'): void // 确认操作
  (event: 'cancel'): void // 取消操作
  (event: 'update:show', value: boolean): void // 兼容旧事件
}
