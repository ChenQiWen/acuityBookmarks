/** 间距占位组件类型定义 */
export interface SpacerProps {
  /** 水平方向间距 */ x?: number | string
  /** 垂直方向间距 */ y?: number | string
  /** 是否占满剩余空间 */ flex?: boolean
  /** 自定义类名 */ className?: string
}

export interface SpacerEmits {}
