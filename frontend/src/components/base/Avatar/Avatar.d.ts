/** 头像组件类型定义 */
export interface AvatarProps {
  // 头像组件属性
  src?: string // 图片地址
  alt?: string // 文字占位
  size?: number | string // 头像尺寸
  rounded?: boolean // 是否圆形
}

export interface AvatarEmits {} // 头像组件事件
