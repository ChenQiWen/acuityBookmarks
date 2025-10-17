/** 开关组件类型定义 */
export interface SwitchProps {
  /** 是否开启 */ modelValue: boolean
  /** 是否禁用 */ disabled?: boolean
  /** 是否显示标签 */ label?: string
}

export interface SwitchEmits {
  /** 更新数值 */ (event: 'update:modelValue', value: boolean): void
  /** 状态切换 */ (event: 'change', value: boolean): void
}
