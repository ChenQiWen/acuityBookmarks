/** 按钮组件类型定义 */
export interface ButtonProps {
  /** 外观风格（默认 primary） */ variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'text'
  /** 尺寸规格（默认 md） */ size?: 'sm' | 'md' | 'lg'
  /** 是否禁用（默认 false） */ disabled?: boolean
  /** 是否加载中（默认 false） */ loading?: boolean
  /** 左侧图标名称 */ iconLeft?: string
  /** 右侧图标名称 */ iconRight?: string
  /** 是否占满整行（默认 false） */ block?: boolean
  /** 渲染标签（默认 button） */ component?: 'button' | 'a'
  /** 原生按钮类型（默认 button） */ type?: 'button' | 'submit' | 'reset'
  /** 链接地址，仅 component 为 a 时生效 */ href?: string
  /** 链接打开方式，仅 component 为 a 时生效 */ target?: string
}

export interface ButtonEmits {
  /** 点击事件 */ (event: 'click', e: Event): void
}
