# SvgIcon 组件

SVG 图标组件，用于渲染 Material Design Icons。

## 特性

- 🎨 支持 SVG 路径渲染
- 📏 多种尺寸选项
- 🎨 语义化颜色支持
- 🔄 旋转和翻转效果
- ⚡ 旋转动画

## Props

| 属性     | 类型                                             | 默认值  | 说明                             |
| -------- | ------------------------------------------------ | ------- | -------------------------------- |
| `path`   | `string`                                         | -       | SVG 路径数据                     |
| `size`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'`  | 图标尺寸                         |
| `color`  | `string`                                         | -       | 图标颜色 (CSS颜色值或语义化颜色) |
| `spin`   | `boolean`                                        | `false` | 旋转动画                         |
| `rotate` | `number`                                         | -       | 旋转角度 (度数)                  |
| `flipH`  | `boolean`                                        | `false` | 水平翻转                         |
| `flipV`  | `boolean`                                        | `false` | 垂直翻转                         |

## 使用示例

```vue
<template>
  <SvgIcon
    path="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2Z"
    size="lg"
    color="primary"
  />
</template>
```

## 注意事项

- 通常不直接使用，而是通过 Icon 组件使用
- SVG 路径需要符合 Material Design Icons 格式
- 支持所有标准的 SVG 属性传递
