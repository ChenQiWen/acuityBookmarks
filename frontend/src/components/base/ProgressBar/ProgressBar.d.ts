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
   * @description 进度条变体（线性/环形）
   */
  variant?: 'linear' | 'circular'
  /**
   * @description 环形进度条尺寸（像素）
   */
  size?: number
  /**
   * @description 环形进度条线条宽度（像素）
   */
  strokeWidth?: number
  /**
   * @description 是否条纹（仅线性模式）
   */
  striped?: boolean
  /**
   * @description 是否动画
   */
  animated?: boolean
  /**
   * @description 轨道高度（仅线性模式）
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
   * @description CSS 倒计时模式（使用 CSS 动画驱动，适用于 Toast 等场景）
   * - 启用后，进度条从 0% 到 100% 使用 CSS 动画自动完成
   * - duration 参数控制动画时长（毫秒）
   */
  countdown?: boolean
  /**
   * @description 倒计时动画时长（毫秒），仅在 countdown=true 时生效
   */
  duration?: number
  /**
   * @description 倒计时是否暂停
   */
  paused?: boolean
  /**
   * @description 是否显示百分比标签
   */
  showLabel?: boolean
  /**
   * @description 标签位置
   * - 'right': 右侧显示（线性模式默认）
   * - 'center': 中心显示（环形模式默认）
   */
  labelPosition?: 'right' | 'center'
  /**
   * @description 兼容旧绑定
   */
  modelValue?: number
} // 进度条组件属性

export interface ProgressBarEmits {
  (event: 'change', value: number): void // 进度变化
} // 进度条组件事件
