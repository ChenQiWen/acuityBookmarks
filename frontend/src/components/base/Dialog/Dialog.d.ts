/** 通用弹窗组件类型定义 */
export interface DialogProps {
  /** 是否显示 */ modelValue: boolean
  /** 是否可点击遮罩关闭 */ closeOnOverlay?: boolean
  /** 是否全屏展示 */ fullscreen?: boolean
}

export interface DialogEmits {
  /** 更新显隐 */ (event: 'update:modelValue', value: boolean): void
  /** 打开事件 */ (event: 'open'): void
  /** 关闭事件 */ (event: 'close'): void
}
