export interface ButtonProps {
  // 按钮组件属性
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text' // 外观风格（默认 primary）
  size?: 'sm' | 'md' | 'lg' // 尺寸规格（默认 md）
  disabled?: boolean // 是否禁用（默认 false）
  loading?: boolean // 是否加载中（默认 false）
  iconLeft?: string // 左侧图标名称
  iconRight?: string // 右侧图标名称
  block?: boolean // 是否占满整行（默认 false）
  borderless?: boolean // 是否隐藏边框，常用于纯图标按钮
  component?: 'button' | 'a' // 渲染标签（默认 button）
  type?: 'button' | 'submit' | 'reset' // 原生按钮类型（默认 button）
  href?: string // 链接地址，仅 component 为 a 时生效
  target?: string // 链接打开方式，仅 component 为 a 时生效
}

export interface ButtonEmits {
  (event: 'click', e: Event): void // 点击事件
}
