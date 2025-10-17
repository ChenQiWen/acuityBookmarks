export interface DialogProps {
  // 通用弹窗组件属性
  modelValue: boolean // 是否显示
  closeOnOverlay?: boolean // 是否可点击遮罩关闭
  fullscreen?: boolean // 是否全屏展示
}

export interface DialogEmits {
  (event: 'update:modelValue', value: boolean): void // 更新显隐
  (event: 'open'): void // 打开事件
  (event: 'close'): void // 关闭事件
}
