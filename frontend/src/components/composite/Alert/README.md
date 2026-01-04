# Alert 警告提示组件

一个警告提示组件，用于向用户显示重要信息、成功、警告或错误消息。

## ✨ 特性

- 🎨 **多种样式** - 支持 filled、outlined、soft 三种样式
- 🌈 **丰富颜色** - 6 种语义化颜色（info、success、warning、error 等）
- 📏 **三种尺寸** - sm、md、lg 满足不同场景
- 🔧 **图标支持** - 自动匹配语义化图标
- 📦 **组合组件** - 由 Icon + 内容区域组成

## 📦 安装

```typescript
import { Alert } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Icon](../../base/Icon/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { Alert } from '@/components'
</script>

<template>
  <Alert />
</template>
```

## 💡 使用场景

### 成功提示

```vue
<template>
  <Alert color="success">
  操作成功！
</Alert>
</template>
```

### 错误提示

```vue
<template>
  <Alert color="error">
  操作失败，请重试
</Alert>
</template>
```



## 📋 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| - | - | - | 待补充 |

### Emits

| 事件名 | 参数 | 说明 |
|--------|------|------|
| - | - | 待补充 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 默认内容 |

## 🎨 样式变量

组件使用 CSS 变量，可以通过覆盖变量来自定义样式。

## ⚠️ 注意事项

1. 这是复合组件，由多个基础组件组合而成
2. 不包含业务逻辑，保持通用性
3. 可在任何项目中使用

## 🔗 相关组件

- [组件分类规范](../../README.md)
- [基础组件文档](../../base/README.md)
- [复合组件文档](../README.md)

## 📝 更新日志

- **v1.0.0** - 初始版本

---

**组件类型**: 复合组件  
**最后更新**: 2025-01-05
