# Tabs 标签页组件

一个标签页组件，用于组织和切换不同的内容区域。

## ✨ 特性

- 🎨 **Material Design** - 遵循 MD3 设计规范
- ⌨️ **键盘导航** - 方向键切换标签
- 🔧 **图标支持** - 标签可包含图标
- ♿ **无障碍** - 完整的 ARIA 支持
- 📦 **组合组件** - 可能包含 Icon

## 📦 安装

```typescript
import { Tabs } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Icon](../../base/Icon/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { Tabs } from '@/components'
</script>

<template>
  <Tabs />
</template>
```

## 💡 使用场景

### 基础标签页

```vue
<template>
  <Tabs v-model="activeTab">
  <Tab value="tab1" label="标签1">内容1</Tab>
  <Tab value="tab2" label="标签2">内容2</Tab>
</Tabs>
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
