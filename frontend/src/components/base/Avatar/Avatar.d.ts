/** 头像组件类型定义 */
export interface AvatarProps {
  /** 图片地址 */ src?: string
  /** 备选文字 */ alt?: string
  /** 显示尺寸 */ size?: number | string
  /** 是否圆形 */ rounded?: boolean
}

export interface AvatarEmits {}
