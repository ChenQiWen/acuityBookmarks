export interface ProgressBarProps {
  // 进度条组件属性
  value: number // 当前进度值
  min?: number // 最小值
  max?: number // 最大值
  showLabel?: boolean // 是否显示标签
  striped?: boolean // 是否条纹动画
  animated?: boolean // 是否动画过渡
}

export interface ProgressBarEmits {
  (event: 'change', value: number): void // 进度变化
}
