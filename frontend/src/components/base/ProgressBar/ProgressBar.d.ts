export interface ProgressBarProps {
  value: number // 当前进度
  min?: number // 最小值
  max?: number // 最大值
  showLabel?: boolean // 是否显示数值
  striped?: boolean // 是否条纹
  animated?: boolean // 是否动画
  height?: number // 轨道高度
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' // 颜色主题
  indeterminate?: boolean // 是否不确定进度
  modelValue?: number // 兼容旧绑定
} // 进度条组件属性

export interface ProgressBarEmits {
  (event: 'change', value: number): void // 进度变化
} // 进度条组件事件
