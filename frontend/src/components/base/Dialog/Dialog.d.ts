export interface DialogProps {
  modelValue?: boolean // 绑定显隐
  title?: string // 标题文案
  icon?: string // 标题左侧图标
  iconColor?: string // 标题图标颜色
  maxWidth?: string // 最大宽度
  minWidth?: string // 最小宽度
  persistent?: boolean // 是否阻止外部关闭
  fullscreen?: boolean // 是否全屏
  scrollable?: boolean // 是否允许正文滚动
  enterToConfirm?: boolean // 回车提交
  escToClose?: boolean // ESC关闭
  bodyMinHeight?: string // 主体最小高度
  cancelable?: boolean // 是否允许取消
  enableCancelGuard?: boolean // 取消前是否校验
  cancelConfirmText?: string // 取消确认提示文案
  cancelConfirmOkText?: string // 取消确认按钮
  cancelConfirmContinueText?: string // 取消继续编辑按钮
  teleportTarget?: string // Teleport 目标
  closeOnOverlay?: boolean // 点击蒙层关闭
  hideClose?: boolean // 隐藏关闭按钮
  show?: boolean // 兼容 show 控制
}

export interface DialogEmits {
  (event: 'update:modelValue', value: boolean): void // 更新显隐
  (event: 'update:show', value: boolean): void // 兼容旧事件
  (event: 'open'): void // 打开
  (event: 'close'): void // 关闭
  (event: 'confirm'): void // 确认
}
