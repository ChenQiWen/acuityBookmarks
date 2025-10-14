# Button 按钮组件

## 📋 概述

高性能、可复用的按钮组件，支持多种变体、尺寸、图标和加载状态。

## 📦 分类

- [x] 基础 UI 组件
- [ ] 复合组件

## 🎯 使用场景

- 触发操作或事件
- 表单提交
- 页面跳转（作为链接）
- 显示加载状态

## 📖 API

### Props

| 属性名      | 类型                                                         | 默认值      | 必填 | 描述                     |
| ----------- | ------------------------------------------------------------ | ----------- | ---- | ------------------------ |
| `variant`   | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'text'` | `'primary'` | 否   | 按钮变体                 |
| `size`      | `'sm' \| 'md' \| 'lg'`                                       | `'md'`      | 否   | 按钮尺寸                 |
| `disabled`  | `boolean`                                                    | `false`     | 否   | 是否禁用                 |
| `loading`   | `boolean`                                                    | `false`     | 否   | 是否加载中               |
| `iconLeft`  | `string`                                                     | -           | 否   | 左侧图标名称             |
| `iconRight` | `string`                                                     | -           | 否   | 右侧图标名称             |
| `block`     | `boolean`                                                    | `false`     | 否   | 是否占满容器宽度         |
| `component` | `'button' \| 'a'`                                            | `'button'`  | 否   | 渲染的组件类型           |
| `type`      | `'button' \| 'submit' \| 'reset'`                            | `'button'`  | 否   | 按钮类型（仅button有效） |
| `href`      | `string`                                                     | -           | 否   | 链接地址（仅a有效）      |
| `target`    | `string`                                                     | -           | 否   | 链接打开方式（仅a有效）  |

### Emits

| 事件名  | 参数             | 描述     |
| ------- | ---------------- | -------- |
| `click` | `(event: Event)` | 点击事件 |

### Slots

| 插槽名    | Props | 描述     |
| --------- | ----- | -------- |
| `default` | -     | 按钮内容 |

## 💡 使用示例

### 基础使用

\`\`\`vue
<template>

  <div>
    <!-- 主要按钮 -->
    <Button variant="primary">主要按钮</Button>
    
    <!-- 次要按钮 -->
    <Button variant="secondary">次要按钮</Button>
    
    <!-- 轮廓按钮 -->
    <Button variant="outline">轮廓按钮</Button>
    
    <!-- 幽灵按钮 -->
    <Button variant="ghost">幽灵按钮</Button>
    
    <!-- 文本按钮 -->
    <Button variant="text">文本按钮</Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components'
</script>

\`\`\`

### 不同尺寸

\`\`\`vue
<template>

  <div>
    <Button size="sm">小按钮</Button>
    <Button size="md">中按钮</Button>
    <Button size="lg">大按钮</Button>
  </div>
</template>
\`\`\`

### 带图标

\`\`\`vue
<template>

  <div>
    <!-- 左侧图标 -->
    <Button icon-left="mdi-check">确认</Button>
    
    <!-- 右侧图标 -->
    <Button icon-right="mdi-chevron-right">下一步</Button>
    
    <!-- 仅图标 -->
    <Button icon-left="mdi-plus" />
  </div>
</template>
\`\`\`

### 加载状态

\`\`\`vue
<template>
<Button :loading="isLoading" @click="handleSubmit">
提交
</Button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components'

const isLoading = ref(false)

const handleSubmit = async () => {
  isLoading.value = true
  try {
    await submitForm()
  } finally {
    isLoading.value = false
  }
}
</script>

\`\`\`

### 禁用状态

\`\`\`vue
<template>
<Button disabled>禁用按钮</Button>
</template>
\`\`\`

### 块级按钮

\`\`\`vue
<template>
<Button block>占满宽度的按钮</Button>
</template>
\`\`\`

### 作为链接

\`\`\`vue
<template>
<Button
component="a"
href="https://example.com"
target="\_blank"

>

    访问网站

  </Button>
</template>
\`\`\`

### 表单提交

\`\`\`vue
<template>

  <form @submit.prevent="handleSubmit">
    <input v-model="name" />
    <Button type="submit" :loading="isSubmitting">
      提交表单
    </Button>
  </form>
</template>
\`\`\`

## 🎨 样式定制

### CSS 变量

| 变量名                   | 默认值 | 描述               |
| ------------------------ | ------ | ------------------ |
| `--color-primary`        | 主题色 | 主要按钮背景色     |
| `--color-primary-hover`  | 主题色 | 主要按钮悬停背景色 |
| `--color-primary-active` | 主题色 | 主要按钮激活背景色 |
| `--color-secondary`      | 次要色 | 次要按钮背景色     |
| `--button-height-sm`     | 32px   | 小按钮高度         |
| `--button-height-md`     | 40px   | 中按钮高度         |
| `--button-height-lg`     | 48px   | 大按钮高度         |
| `--radius-base`          | 8px    | 圆角大小           |
| `--space-2`              | 8px    | 图标与文字间距     |

### 示例

\`\`\`css
.custom-button {
--color-primary: #ff6b6b;
--color-primary-hover: #ff5252;
--radius-base: 4px;
}
\`\`\`

## 📦 依赖组件

- `components/ui/Icon` - 图标显示

## ⚠️ 注意事项

- 加载状态下按钮自动禁用，防止重复点击
- 禁用状态下不会触发点击事件
- 仅图标按钮会自动调整为方形（aspect-ratio: 1）
- 使用 `component="a"` 时，应提供 `href` 属性

## 🔄 更新日志

### v1.0.0 (2025-10-14)

- 迁移到 `components/base/Button/` 目录
- 创建独立的类型定义文件
- 完善组件文档
