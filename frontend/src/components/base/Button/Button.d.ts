export interface ButtonProps {
  /** 按钮的样式 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text' // 外观风格（默认 primary）
  /** 按钮的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 按钮是否禁用 */
  disabled?: boolean
  /** 按钮是否加载中 */
  loading?: boolean
  /** 按钮的左侧图标 */
  iconLeft?: string
  /** 按钮的右侧图标 */
  iconRight?: string
  /** 按钮是否占满整行 */
  block?: boolean
  /** 按钮是否隐藏边框，常用于纯图标按钮 */
  borderless?: boolean
  /** 按钮的渲染标签 */
  component?: 'button' | 'a'
  /** 按钮的原生按钮类型 (仅 component 为 button 时生效) */
  type?: 'button' | 'submit' | 'reset'
  /** 按钮的链接地址，仅 component 为 a 时生效 */
  href?: string
  /** 按钮的链接打开方式，仅 component 为 a 时生效 */
  target?: string
}

export interface ButtonEmits {
  /** 按钮点击事件 */
  (event: 'click', e: Event): void // 点击事件
}
