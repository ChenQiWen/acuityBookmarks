/**
 * 📦 Button - 按钮组件类型定义
 */

/**
 * 组件 Props
 */
export interface ButtonProps {
  /**
   * 按钮变体
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text'

  /**
   * 按钮尺寸
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean

  /**
   * 是否加载中
   * @default false
   */
  loading?: boolean

  /**
   * 左侧图标名称
   */
  iconLeft?: string

  /**
   * 右侧图标名称
   */
  iconRight?: string

  /**
   * 是否占满容器宽度
   * @default false
   */
  block?: boolean

  /**
   * 渲染的组件类型
   * @default 'button'
   */
  component?: 'button' | 'a'

  /**
   * 按钮类型（仅当component='button'时有效）
   * @default 'button'
   */
  type?: 'button' | 'submit' | 'reset'

  /**
   * 链接地址（仅当component='a'时有效）
   */
  href?: string

  /**
   * 链接打开方式（仅当component='a'时有效）
   */
  target?: string
}

/**
 * 组件 Emits
 */
export interface ButtonEmits {
  /**
   * 点击事件
   * @param event - 原生事件对象
   */
  (event: 'click', e: Event): void
}
