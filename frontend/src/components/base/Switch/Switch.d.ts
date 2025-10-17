export interface SwitchProps {
  // 开关组件属性
  modelValue: boolean // 是否开启
  disabled?: boolean // 是否禁用
  label?: string // 是否显示标签
}

export interface SwitchEmits {
  (event: 'update:modelValue', value: boolean): void // 更新数值
  (event: 'change', value: boolean): void // 状态切换
}
