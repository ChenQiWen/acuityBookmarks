# useKeyboardModifier - Vue 风格的键盘快捷键

这是 `useKeyboard` 的增强版本，提供**类似 Vue 3 模板修饰符**的语法。

## 🎯 为什么需要这个？

### Vue 3 修饰符（仅限模板）

```vue
<template>
  <!-- ✅ Vue 3 修饰符 - 简洁优雅 -->
  <input @keyup.enter="submit" />
  <input @keydown.ctrl.s="save" />
  <input @keydown.esc="cancel" />
</template>
```

### 原始 useKeyboard（编程式）

```typescript
// ❌ 原始方式 - 比较啰嗦
register({
  key: 'enter',
  handler: submit
})

register({
  key: 's',
  ctrl: true,
  handler: save
})
```

### 新的 useKeyboardModifier（兼得两者）

```typescript
// ✅ 新方式 - Vue 风格 + 编程式
on('enter', submit)
on('ctrl.s', save)
on('esc', cancel)
```

---

## 🚀 快速开始

### 基础使用

```vue
<script setup lang="ts">
import {
  useKeyboardModifier,
  ModifierShortcuts
} from '@/composables/useKeyboardModifier'

const { on } = useKeyboardModifier()

// Vue 风格的语法
on(
  'ctrl.s',
  () => {
    console.log('保存')
  },
  '保存文档'
)

on(
  'alt.m',
  () => {
    console.log('打开管理')
  },
  '打开管理页面'
)

on(
  'enter',
  () => {
    console.log('确认')
  },
  '确认操作'
)
</script>
```

### 使用预设常量

```typescript
import {
  useKeyboardModifier,
  ModifierShortcuts
} from '@/composables/useKeyboardModifier'

const { on } = useKeyboardModifier()

on(ModifierShortcuts.SAVE, handleSave, '保存')
on(ModifierShortcuts.UNDO, handleUndo, '撤销')
on(ModifierShortcuts.REDO, handleRedo, '重做')
on(ModifierShortcuts.SEARCH, handleSearch, '搜索')
```

---

## 📚 API 参考

### `on(modifierString, handler, description?, options?)`

注册快捷键

**参数：**

- `modifierString`: 修饰符字符串，如 `'ctrl.enter'`, `'alt.shift.s'`
- `handler`: 回调函数
- `description`: 描述（可选）
- `options`: 其他选项（可选）
  - `preventDefault`: 是否阻止默认行为（默认 true）
  - `stopPropagation`: 是否阻止事件冒泡（默认 false）
  - `allowInInput`: 是否在输入元素中也触发（默认 false）

**返回值：**

- 注销函数

### `off(modifierString)`

注销快捷键

**参数：**

- `modifierString`: 修饰符字符串

---

## 🎨 修饰符语法

### 单个按键

```typescript
on('enter', handler) // Enter
on('esc', handler) // Escape
on('delete', handler) // Delete
on('tab', handler) // Tab
on('space', handler) // Space
on('up', handler) // ↑
on('down', handler) // ↓
on('left', handler) // ←
on('right', handler) // →
```

### 修饰键组合

```typescript
// 单个修饰键
on('ctrl.s', handler) // Ctrl/Cmd + S
on('alt.m', handler) // Alt + M
on('shift.enter', handler) // Shift + Enter
on('meta.k', handler) // Meta/Cmd + K

// 多个修饰键
on('ctrl.shift.z', handler) // Ctrl + Shift + Z
on('ctrl.alt.delete', handler) // Ctrl + Alt + Delete
on('shift.alt.f', handler) // Shift + Alt + F
```

### 修饰符顺序不重要

```typescript
// 这两个是等价的
on('ctrl.shift.s', handler)
on('shift.ctrl.s', handler)
```

---

## 💡 实战示例

### 示例 1: 文本编辑器

```vue
<script setup lang="ts">
import {
  useKeyboardModifier,
  ModifierShortcuts
} from '@/composables/useKeyboardModifier'

const { on } = useKeyboardModifier()

// 文件操作
on(ModifierShortcuts.SAVE, save, '保存')
on('ctrl.shift.s', saveAs, '另存为')
on('ctrl.o', open, '打开文件')
on('ctrl.n', newFile, '新建文件')

// 编辑操作
on(ModifierShortcuts.UNDO, undo, '撤销')
on(ModifierShortcuts.REDO, redo, '重做')
on(ModifierShortcuts.COPY, copy, '复制')
on(ModifierShortcuts.PASTE, paste, '粘贴')
on(ModifierShortcuts.CUT, cut, '剪切')

// 导航
on('ctrl.g', goToLine, '跳转到行')
on('ctrl.p', quickOpen, '快速打开')
on('ctrl.shift.p', commandPalette, '命令面板')
</script>
```

### 示例 2: 对话框

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboardModifier } from '@/composables/useKeyboardModifier'

const showDialog = ref(false)

const { on } = useKeyboardModifier()

// ESC 关闭对话框
on(
  'esc',
  () => {
    showDialog.value = false
  },
  '关闭对话框'
)

// Enter 确认
on(
  'enter',
  () => {
    confirm()
    showDialog.value = false
  },
  '确认'
)
</script>
```

### 示例 3: Popup 页面重构

**之前：**

```typescript
register({
  key: 't',
  alt: true,
  handler: toggleSidePanel,
  description: '切换侧边栏'
})

register({
  key: 'm',
  alt: true,
  handler: openManagement,
  description: '打开管理页面'
})
```

**之后：**

```typescript
const { on } = useKeyboardModifier()

on('alt.t', toggleSidePanel, '切换侧边栏')
on('alt.m', openManagement, '打开管理页面')
```

---

## 🔄 对比：三种 API 风格

### 1. Vue 模板修饰符（最简洁，但仅限模板）

```vue
<template>
  <input @keydown.ctrl.s="save" />
</template>
```

**优点：**

- ✅ 最简洁
- ✅ 声明式

**缺点：**

- ❌ 只能在模板中使用
- ❌ 不适合复杂的键盘逻辑
- ❌ 难以动态管理

---

### 2. useKeyboardModifier（推荐，Vue 风格）

```typescript
const { on } = useKeyboardModifier()
on('ctrl.s', save, '保存')
```

**优点：**

- ✅ 类似 Vue 修饰符的简洁语法
- ✅ 适合简单的快捷键
- ✅ 代码可读性高

**缺点：**

- ⚠️ 不支持复杂的配置

---

### 3. useKeyboard（原始版本，最灵活）

```typescript
const { register } = useKeyboard()
register({
  key: 's',
  ctrl: true,
  handler: save,
  description: '保存',
  preventDefault: true,
  stopPropagation: false,
  allowInInput: false
})
```

**优点：**

- ✅ 最灵活
- ✅ 支持所有配置选项
- ✅ 类型安全

**缺点：**

- ⚠️ 代码略显啰嗦

---

## 🎯 选择建议

| 场景             | 推荐方案              |
| ---------------- | --------------------- |
| 模板中的表单输入 | Vue 模板修饰符        |
| 简单的全局快捷键 | `useKeyboardModifier` |
| 复杂的键盘逻辑   | `useKeyboard`         |
| 需要动态配置     | `useKeyboard`         |

---

## 📦 可用的预设常量

```typescript
ModifierShortcuts.SAVE // 'ctrl.s'
ModifierShortcuts.UNDO // 'ctrl.z'
ModifierShortcuts.REDO // 'ctrl.shift.z'
ModifierShortcuts.SEARCH // 'ctrl.f'
ModifierShortcuts.SELECT_ALL // 'ctrl.a'
ModifierShortcuts.COPY // 'ctrl.c'
ModifierShortcuts.PASTE // 'ctrl.v'
ModifierShortcuts.CUT // 'ctrl.x'
ModifierShortcuts.ENTER // 'enter'
ModifierShortcuts.ESCAPE // 'esc'
ModifierShortcuts.DELETE // 'delete'
ModifierShortcuts.TAB // 'tab'
ModifierShortcuts.SPACE // 'space'
ModifierShortcuts.ARROW_UP // 'up'
ModifierShortcuts.ARROW_DOWN // 'down'
ModifierShortcuts.ARROW_LEFT // 'left'
ModifierShortcuts.ARROW_RIGHT // 'right'
```

---

## ⚠️ 注意事项

### 1. 按键名称小写

```typescript
// ✅ 正确
on('ctrl.enter', handler)

// ❌ 错误
on('Ctrl.Enter', handler) // 虽然也能工作，但不推荐
```

### 2. 方向键简写

```typescript
// ✅ 使用简写
on('up', handler)
on('down', handler)
on('left', handler)
on('right', handler)

// ❌ 不要使用完整名称
on('arrowup', handler) // 虽然也能工作，但不推荐
```

### 3. Escape 键的别名

```typescript
// ✅ 推荐使用简写
on('esc', handler)

// ✅ 也可以使用完整名称
on('escape', handler)
```

---

## 🎉 总结

**`useKeyboardModifier` 将 Vue 3 修饰符的简洁性带到了编程式 API 中！**

- ✅ **更简洁** - `on('ctrl.s', save)` vs `register({ key: 's', ctrl: true, handler: save })`
- ✅ **更直观** - 类似 Vue 模板语法，学习成本低
- ✅ **更易读** - 一眼就能看出是什么快捷键
- ✅ **完全兼容** - 可以和 `useKeyboard` 混用

**选择使用哪个 API？**

- 简单场景 → `useKeyboardModifier`
- 复杂场景 → `useKeyboard`
- 混合使用 → 两者都可以！
