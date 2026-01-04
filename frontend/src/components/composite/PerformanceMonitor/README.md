# PerformanceMonitor 性能监控组件

## 功能

- 实时显示内存使用情况
- 监控组件渲染和更新性能
- 显示缓存使用情况
- 提供性能优化开关
- 支持缓存清理

## 使用

```vue
<template>
  <PerformanceMonitor />
</template>

<script setup>
import { PerformanceMonitor } from '@/components'
</script>
```

## 仅在开发环境显示

该组件默认只在开发环境显示，生产环境会自动隐藏。
