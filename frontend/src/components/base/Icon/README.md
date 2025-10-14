# Icon 组件

轻量级图标组件，支持 Material Design Icons 和 Emoji。

## 特性

- 🎨 支持 Material Design Icons (MDI)
- 😊 支持 Emoji 图标
- 📏 多种尺寸选项
- 🎨 语义化颜色支持
- 🔄 旋转和翻转效果
- ⚡ 自动旋转动画

## Props

| 属性     | 类型                                             | 默认值  | 说明                                                         |
| -------- | ------------------------------------------------ | ------- | ------------------------------------------------------------ |
| `name`   | `string`                                         | -       | 图标名称 (MDI格式: `mdi-icon-name` 或 Emoji格式: `emoji:😊`) |
| `size`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'`  | 图标尺寸                                                     |
| `color`  | `string`                                         | -       | 图标颜色 (CSS颜色值或语义化颜色)                             |
| `rotate` | `number`                                         | -       | 旋转角度 (度数)                                              |
| `flipH`  | `boolean`                                        | `false` | 水平翻转                                                     |
| `flipV`  | `boolean`                                        | `false` | 垂直翻转                                                     |
| `spin`   | `boolean`                                        | `false` | 旋转动画                                                     |

## 语义化颜色

- `primary` - 主色调
- `secondary` - 次要色调
- `tertiary` - 第三色调
- `error` - 错误色
- `warning` - 警告色
- `success` - 成功色
- `info` - 信息色
- `muted` - 静音色

## 使用示例

### 基础用法

```vue
<template>
  <!-- Material Design Icon -->
  <Icon name="mdi-home" />

  <!-- Emoji -->
  <Icon name="emoji:🏠" />
</template>
```

### 尺寸和颜色

```vue
<template>
  <!-- 不同尺寸 -->
  <Icon name="mdi-star" size="xs" />
  <Icon name="mdi-star" size="sm" />
  <Icon name="mdi-star" size="md" />
  <Icon name="mdi-star" size="lg" />
  <Icon name="mdi-star" size="xl" />

  <!-- 自定义尺寸 -->
  <Icon name="mdi-star" :size="32" />

  <!-- 语义化颜色 -->
  <Icon name="mdi-check" color="success" />
  <Icon name="mdi-alert" color="warning" />
  <Icon name="mdi-close" color="error" />
</template>
```

### 变换效果

```vue
<template>
  <!-- 旋转 -->
  <Icon name="mdi-refresh" :rotate="45" />

  <!-- 翻转 -->
  <Icon name="mdi-arrow-right" flip-h />

  <!-- 旋转动画 -->
  <Icon name="mdi-loading" spin />
</template>
```

## 自动特性

- 包含 `loading`、`sync`、`cached` 关键词的图标会自动启用旋转动画
- 支持点击事件处理

## 注意事项

- 图标名称必须以 `mdi-` 开头或使用 `emoji:` 前缀
- 自定义颜色值支持任何有效的 CSS 颜色值
- 旋转角度以度为单位
- 组件会自动处理图标路径映射和渲染
