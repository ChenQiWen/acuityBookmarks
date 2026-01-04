# UrlInput URL 输入框组件

一个 URL 输入框组件，带 URL 验证和格式化功能。

## ✨ 特性

- ✅ **URL 验证** - 自动验证 URL 格式
- 🔧 **自动格式化** - 自动添加协议
- 🎨 **错误提示** - 清晰的错误提示
- 📦 **组合组件** - 基于 Input 组件

## 📦 安装

```typescript
import { UrlInput } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Input](../../base/Input/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { UrlInput } from '@/components'
</script>

<template>
  <UrlInput />
</template>
```

## 💡 使用场景

### URL 输入

```vue
<template>
  <UrlInput
  v-model="url"
  placeholder="https://example.com"
  @validate="handleValidate"
/>
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
