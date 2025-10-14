# EmojiIcon 组件

Emoji 图标组件，用于渲染 Emoji 字符。

## 特性

- 😊 支持 Emoji 字符渲染
- 📏 多种尺寸选项
- 🎨 语义化颜色支持
- 🔄 旋转和翻转效果
- ⚡ 旋转动画

## Props

| 属性     | 类型                                             | 默认值  | 说明                             |
| -------- | ------------------------------------------------ | ------- | -------------------------------- |
| `char`   | `string`                                         | -       | Emoji 字符                       |
| `size`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'`  | 图标尺寸                         |
| `color`  | `string`                                         | -       | 图标颜色 (CSS颜色值或语义化颜色) |
| `rotate` | `number`                                         | -       | 旋转角度 (度数)                  |
| `flipH`  | `boolean`                                        | `false` | 水平翻转                         |
| `flipV`  | `boolean`                                        | `false` | 垂直翻转                         |
| `spin`   | `boolean`                                        | `false` | 旋转动画                         |

## 使用示例

```vue
<template>
  <EmojiIcon char="🏠" size="lg" color="primary" />
</template>
```

## 注意事项

- 通常不直接使用，而是通过 Icon 组件使用
- Emoji 字符需要是有效的 Unicode Emoji
- 支持所有标准的 HTML 属性传递
