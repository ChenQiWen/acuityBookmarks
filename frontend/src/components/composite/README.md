# 复合组件（Composite Components）

## 📖 定义

复合组件是由多个基础组件组合而成的通用 UI 组件，不包含业务逻辑，完全可复用。

## ✨ 特征

- ✅ 由多个基础组件组合而成
- ✅ 纯 UI 展示
- ✅ 无业务逻辑
- ✅ 完全可复用
- ✅ 可独立成 package
- ⚠️ 可能有少量固定的 UI 提示文案

## 📦 组件列表

### 对话框类
- **Dialog** - 对话框（Button + Card + Icon）
- **ConfirmableDialog** - 可确认对话框（Dialog + 确认逻辑）
- **SyncProgressDialog** - 同步进度对话框（Dialog + Icon + Button）

### 表单类
- **Checkbox** - 复选框（Input + Icon）
- **UrlInput** - URL 输入框（Input 组合）

### 展示类
- **Alert** - 警告提示（Icon + 内容）
- **Card** - 卡片容器（可能包含 Icon）
- **EmptyState** - 空状态（Icon + 标题 + 描述）
- **Avatar** - 头像（可能包含 Icon）
- **Chip** - 标签（Button + Icon）
- **Notification** - 通知提示（Icon + 内容）

### 导航类
- **Tabs** - 标签页（多个 Tab 组合）
- **AppHeader** - 应用头部（Icon + Button + ThemeToggle）

### 功能类
- **ThemeToggle** - 主题切换（Icon + Button）
- **PerformanceMonitor** - 性能监控（Button + Icon）

## 🎯 使用示例

### 基本使用

```vue
<script setup lang="ts">
import { Alert, Card, Dialog } from '@/components'
</script>

<template>
  <Card>
    <Alert color="success">
      操作成功！
    </Alert>
  </Card>
  
  <Dialog :show="showDialog" title="确认">
    确定要删除吗？
  </Dialog>
</template>
```

### 组合使用

```vue
<script setup lang="ts">
import { EmptyState, Button } from '@/components'
</script>

<template>
  <EmptyState
    icon="icon-folder"
    title="暂无数据"
    description="还没有添加任何内容"
  >
    <Button variant="primary">添加内容</Button>
  </EmptyState>
</template>
```

## 🔧 开发规范

### 1. 只依赖基础组件

```vue
<!-- ✅ 正确：只导入基础组件 -->
<script setup lang="ts">
import { Icon, Button } from '@/components'
</script>

<!-- ❌ 错误：不要导入其他复合组件或业务组件 -->
<script setup lang="ts">
import { Alert } from '@/components'  // 复合组件
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'  // 业务组件
</script>
```

### 2. 不包含业务逻辑

```vue
<!-- ❌ 错误：包含业务逻辑 -->
<script setup lang="ts">
import { bookmarkService } from '@/application/bookmark/bookmark-service'

async function handleClick() {
  await bookmarkService.createBookmark(...)  // 业务逻辑
}
</script>

<!-- ✅ 正确：通过 emit 传递事件 -->
<script setup lang="ts">
const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  emit('click')  // 只负责 UI 交互
}
</script>
```

### 3. 文案处理

```vue
<!-- ✅ 方案 1：完全由外部传入 -->
<template>
  <Alert>
    <slot />  <!-- 文案由父组件传入 -->
  </Alert>
</template>

<!-- ✅ 方案 2：内置默认文案 + 支持覆盖 -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  message?: string
}>(), {
  message: '默认提示文案'  // 通用的默认文案
})
</script>

<template>
  <Alert>{{ message }}</Alert>
</template>
```

### 4. 命名规范

- **组件名**：PascalCase（如 `EmptyState.vue`）
- **CSS 类名**：kebab-case（如 `.empty-state`）
- **Props**：camelCase（如 `iconSize`）

## 🚫 禁止事项

1. ❌ **不要包含业务逻辑**
   - 不要调用业务服务（如 bookmarkService）
   - 不要处理业务数据（如书签、标签）
   - 不要包含业务算法（如搜索、推荐）

2. ❌ **不要依赖其他复合组件**
   - 只能依赖基础组件
   - 保持低耦合

3. ❌ **不要写死项目特定文案**
   - 文案应该由外部传入
   - 或提供通用的默认文案

## 📚 相关文档

- [组件分类规范](../README.md)
- [基础组件文档](../base/README.md)
- [业务组件文档](../business/README.md)

---

**最后更新**: 2025-01-05  
**维护者**: Kiro AI
