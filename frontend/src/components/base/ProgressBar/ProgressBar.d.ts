/** 进度条组件类型定义 */
export interface ProgressBarProps {
  /** 当前进度值 */ value: number
  /** 最小值 */ min?: number
  /** 最大值 */ max?: number
  /** 是否显示标签 */ showLabel?: boolean
  /** 是否条纹动画 */ striped?: boolean
  /** 是否动画过渡 */ animated?: boolean
}

export interface ProgressBarEmits {
  /** 进度变化 */ (event: 'change', value: number): void
}
