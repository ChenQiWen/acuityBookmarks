export interface ProgressBarProps {
  value: number
  min?: number
  max?: number
  showLabel?: boolean
  striped?: boolean
  animated?: boolean
} // 进度条组件属性

export interface ProgressBarEmits {
  (event: 'change', value: number): void
} // 进度条组件事件
