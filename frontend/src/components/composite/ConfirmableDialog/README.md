# ConfirmableDialog 可确认对话框组件

一个带确认逻辑的对话框组件，用于需要用户确认的操作。

## ✨ 特性

- ✅ **确认逻辑** - 内置确认/取消逻辑
- ⚠️ **脏数据检测** - 检测未保存的更改
- 🔒 **防误操作** - 二次确认机制
- 📦 **组合组件** - 基于 Dialog 组件

## 📦 安装

```typescript
import { ConfirmableDialog } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Dialog](../../base/Dialog/README.md)


## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { ConfirmableDialog } from '@/components'
</script>

<template>
  <ConfirmableDialog />
</template>
```

## 💡 使用场景

### 表单确认

```vue
<template>
  <ConfirmableDialog
  :show="showDialog"
  :is-dirty="hasChanges"
  title="编辑信息"
  @confirm="handleSave"
>
  <form>...</form>
</ConfirmableDialog>
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
