export interface ProgressBarProps {
  /**
   * @description 当前进度
   */
  value: number
  /**
   * @description 最小值
   */
  min?: number
  /**
   * @description 最大值
   */
  max?: number
  /**
   * @description 是否条纹
   */
  striped?: boolean
  /**
   * @description 是否动画
   */
  animated?: boolean
  /**
   * @description 轨道高度
   */
  height?: number
  /**
   * @description 颜色主题
   */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  /**
   * @description 是否不确定进度
   */
  indeterminate?: boolean
  /**
   * @description 兼容旧绑定
   */
  modelValue?: number
} // 进度条组件属性

export interface ProgressBarEmits {
  (event: 'change', value: number): void // 进度变化
} // 进度条组件事件
