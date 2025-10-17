export interface ConfirmableDialogProps {
  modelValue: boolean // 是否显示
  title?: string // 标题文案
  message?: string // 内容文案
  confirmLabel?: string // 确认按钮文本
  cancelLabel?: string // 取消按钮文本
  danger?: boolean // 是否危险提示
  isDirty?: boolean // 是否存在未保存修改
  confirmMessage?: string // 自定义提示文案
  show?: boolean // 兼容 show 控制
}

export interface ConfirmableDialogEmits {
  (event: 'update:modelValue', value: boolean): void // 更新显隐
  (event: 'confirm'): void // 确认操作
  (event: 'cancel'): void // 取消操作
  (event: 'update:show', value: boolean): void // 兼容旧事件
}
