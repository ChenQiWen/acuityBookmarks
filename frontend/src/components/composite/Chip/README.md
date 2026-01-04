# Chip 标签组件

一个标签组件，用于显示标签、过滤器或可删除的项目。

## ✨ 特性

- 🎨 **多种样式** - 支持 filled、outlined 样式
- 🌈 **丰富颜色** - 多种语义化颜色
- ❌ **可删除** - 支持删除操作
- 🔧 **图标支持** - 可添加图标
- 📦 **组合组件** - 由 Button + Icon 组成

## 📦 安装

```typescript
import { Chip } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Button](../../base/Button/README.md)
- [Icon](../../base/Icon/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { Chip } from '@/components'
</script>

<template>
  <Chip />
</template>
```

## 💡 使用场景

### 标签列表

```vue
<template>
  <Chip
  v-for="tag in tags"
  :key="tag"
  closable
  @close="removeTag(tag)"
>
  {{ tag }}
</Chip>
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
