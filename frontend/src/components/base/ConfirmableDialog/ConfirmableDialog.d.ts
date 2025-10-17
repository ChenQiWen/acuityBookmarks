/** 可确认对话框类型定义 */
export interface ConfirmableDialogProps {
  /** 是否显示 */ modelValue: boolean
  /** 标题文案 */ title?: string
  /** 内容文案 */ message?: string
  /** 确认按钮文本 */ confirmLabel?: string
  /** 取消按钮文本 */ cancelLabel?: string
  /** 是否危险提示 */ danger?: boolean
}

export interface ConfirmableDialogEmits {
  /** 更新显隐 */ (event: 'update:modelValue', value: boolean): void
  /** 确认操作 */ (event: 'confirm'): void
  /** 取消操作 */ (event: 'cancel'): void
}
