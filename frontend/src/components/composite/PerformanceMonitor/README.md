# PerformanceMonitor 性能监控组件

一个性能监控组件，用于显示应用性能指标。

## ✨ 特性

- 📊 **性能指标** - FPS、内存使用等
- 📈 **实时监控** - 实时更新数据
- 🎨 **可视化** - 图表展示
- 📦 **组合组件** - 由 Button + Icon 组成

## 📦 安装

```typescript
import { PerformanceMonitor } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Button](../../base/Button/README.md)
- [Icon](../../base/Icon/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { PerformanceMonitor } from '@/components'
</script>

<template>
  <PerformanceMonitor />
</template>
```

## 💡 使用场景

### 性能监控

```vue
<template>
  <PerformanceMonitor :enabled="isDev" />
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
