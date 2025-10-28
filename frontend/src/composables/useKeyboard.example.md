# useKeyboard - 键盘快捷键管理

通用的键盘快捷键管理 Composable，用于提升 PC 端用户体验。

## 📚 功能特性

- ✅ **声明式 API**：简洁的快捷键注册方式
- ✅ **修饰键支持**：Ctrl、Alt、Shift、Meta 组合键
- ✅ **作用域管理**：全局或局部（特定元素）监听
- ✅ **输入保护**：自动避免与输入元素冲突
- ✅ **自动清理**：组件卸载时自动移除监听
- ✅ **条件启用**：支持响应式的启用/禁用状态
- ✅ **预设快捷键**：常用快捷键开箱即用

## 🚀 基础使用

### 示例 1: 全局快捷键

```vue
<script setup lang="ts">
import { useKeyboard, CommonShortcuts } from '@/composables/useKeyboard'

const { register } = useKeyboard()

// 使用预设快捷键
register(
  CommonShortcuts.save(() => {
    console.log('保存文档')
  })
)

// 自定义快捷键
register({
  key: 'k',
  ctrl: true,
  handler: () => {
    console.log('打开命令面板')
  },
  description: '打开命令面板'
})
</script>
```

### 示例 2: 局部快捷键（仅在特定元素内生效）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboard } from '@/composables/useKeyboard'

const containerRef = ref<HTMLElement | null>(null)

const { register } = useKeyboard({
  global: false,
  target: containerRef
})

register({
  key: 'arrowdown',
  handler: () => {
    console.log('在容器内按下向下箭头')
  }
})
</script>

<template>
  <div ref="containerRef" tabindex="0">
    <!-- 只有当焦点在这个容器内时，快捷键才会生效 -->
    内容区域
  </div>
</template>
```

### 示例 3: 条件启用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboard } from '@/composables/useKeyboard'

const isEditing = ref(false)

const { register } = useKeyboard({
  enabled: isEditing
})

// 只有在编辑模式下才会生效
register({
  key: 'escape',
  handler: () => {
    isEditing.value = false
  },
  description: '退出编辑模式'
})
</script>
```

### 示例 4: 复杂组合键

```vue
<script setup lang="ts">
import { useKeyboard } from '@/composables/useKeyboard'

const { register } = useKeyboard()

// Ctrl + Shift + P
register({
  key: 'p',
  ctrl: true,
  shift: true,
  handler: () => {
    console.log('打开命令面板')
  }
})

// Alt + M
register({
  key: 'm',
  alt: true,
  handler: () => {
    console.log('打开管理页面')
  }
})
</script>
```

## 🎯 实战案例

### 案例 1: 重构 Popup.vue 的快捷键

**之前（直接写在组件中）：**

```vue
<script setup lang="ts">
onMounted(() => {
  const globalHotkeyHandler = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return
    }

    const key = event.key.toLowerCase()
    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (event.code === 'KeyT') {
        event.preventDefault()
        toggleSidePanel()
        return
      }
      switch (key) {
        case 'm':
          event.preventDefault()
          openManualOrganizePage()
          return
      }
    }
  }

  window.addEventListener('keydown', globalHotkeyHandler)
})
</script>
```

**之后（使用 useKeyboard）：**

```vue
<script setup lang="ts">
import { useKeyboard } from '@/composables/useKeyboard'

const { register } = useKeyboard()

// Alt + T - 切换侧边栏
register({
  key: 't',
  alt: true,
  handler: toggleSidePanel,
  description: '切换侧边栏'
})

// Alt + M - 打开管理页面
register({
  key: 'm',
  alt: true,
  handler: openManualOrganizePage,
  description: '打开管理页面'
})
</script>
```

### 案例 2: 书签树导航

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboard } from '@/composables/useKeyboard'

const selectedIndex = ref(0)
const bookmarks = ref([...])

const { register } = useKeyboard()

// 向上导航
register({
  key: 'arrowup',
  handler: () => {
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  },
  description: '选择上一个书签'
})

// 向下导航
register({
  key: 'arrowdown',
  handler: () => {
    if (selectedIndex.value < bookmarks.value.length - 1) {
      selectedIndex.value++
    }
  },
  description: '选择下一个书签'
})

// 回车打开
register({
  key: 'enter',
  handler: () => {
    const bookmark = bookmarks.value[selectedIndex.value]
    if (bookmark) {
      openBookmark(bookmark)
    }
  },
  description: '打开选中的书签'
})
</script>
```

### 案例 3: 对话框快捷键

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboard, CommonShortcuts } from '@/composables/useKeyboard'

const showDialog = ref(false)

const { register } = useKeyboard({
  enabled: showDialog // 只在对话框显示时启用
})

// ESC 关闭对话框
register(
  CommonShortcuts.escape(() => {
    showDialog.value = false
  })
)

// Enter 确认
register(
  CommonShortcuts.enter(() => {
    handleConfirm()
    showDialog.value = false
  })
)
</script>
```

## 📋 API 参考

### KeyboardShortcut 类型

```typescript
interface KeyboardShortcut {
  /** 按键（小写），如 'a', 'enter', 'escape' */
  key: string
  /** 是否需要 Ctrl/Cmd 键 */
  ctrl?: boolean
  /** 是否需要 Alt 键 */
  alt?: boolean
  /** 是否需要 Shift 键 */
  shift?: boolean
  /** 是否需要 Meta 键（Mac Command / Windows 键） */
  meta?: boolean
  /** 回调函数 */
  handler: (event: KeyboardEvent) => void
  /** 是否阻止默认行为（默认 true） */
  preventDefault?: boolean
  /** 是否阻止事件冒泡（默认 false） */
  stopPropagation?: boolean
  /** 描述（用于调试和文档） */
  description?: string
  /** 是否在输入元素中也触发（默认 false） */
  allowInInput?: boolean
}
```

### UseKeyboardOptions 类型

```typescript
interface UseKeyboardOptions {
  /** 是否全局监听（默认 true） */
  global?: boolean
  /** 目标元素（如果不是全局监听） */
  target?: Ref<HTMLElement | null> | HTMLElement | null
  /** 是否启用（默认 true） */
  enabled?: Ref<boolean> | boolean
  /** 是否在输入元素中禁用快捷键（默认 true） */
  disableInInput?: boolean
}
```

### 返回值

```typescript
{
  /** 注册快捷键 */
  register: (shortcut: KeyboardShortcut) => () => void
  /** 注销快捷键 */
  unregister: (shortcut: KeyboardShortcut) => void
  /** 清空所有快捷键 */
  clear: () => void
  /** 获取所有已注册的快捷键 */
  getShortcuts: () => ReadonlyMap<string, KeyboardShortcut>
}
```

## 🎨 常用快捷键预设

`CommonShortcuts` 提供了常用快捷键的预设：

```typescript
CommonShortcuts.save(() => {}) // Ctrl/Cmd + S
CommonShortcuts.undo(() => {}) // Ctrl/Cmd + Z
CommonShortcuts.redo(() => {}) // Ctrl/Cmd + Shift + Z
CommonShortcuts.search(() => {}) // Ctrl/Cmd + F
CommonShortcuts.escape(() => {}) // Escape
CommonShortcuts.enter(() => {}) // Enter
CommonShortcuts.delete(() => {}) // Delete
CommonShortcuts.arrowUp(() => {}) // Arrow Up
CommonShortcuts.arrowDown(() => {}) // Arrow Down
CommonShortcuts.arrowLeft(() => {}) // Arrow Left
CommonShortcuts.arrowRight(() => {}) // Arrow Right
```

## ⚠️ 注意事项

1. **避免冲突**：注册快捷键时检查是否与浏览器默认快捷键冲突
2. **输入保护**：默认在输入元素（input、textarea、select）中禁用快捷键
3. **清理**：组件卸载时自动清理，无需手动移除
4. **文档**：为每个快捷键添加 `description`，便于维护和调试

## 🔧 调试

开启 logger 的 debug 模式可以看到快捷键的注册和触发日志：

```typescript
// 在控制台查看日志
// [Keyboard] 注册快捷键: Ctrl + S
// [Keyboard] 触发快捷键: Ctrl + S 保存
```

## 📝 最佳实践

1. **集中管理**：为每个页面创建一个 `useXxxKeyboard` composable 集中管理快捷键
2. **使用预设**：优先使用 `CommonShortcuts` 中的预设快捷键
3. **添加描述**：为每个快捷键添加清晰的 `description`
4. **条件启用**：使用 `enabled` 选项控制快捷键的启用状态
5. **避免冲突**：注意不要覆盖浏览器或操作系统的系统快捷键

## 🚀 未来扩展

可能的扩展方向：

- 快捷键提示 UI（显示可用快捷键列表）
- 快捷键自定义（让用户自定义快捷键）
- 快捷键冲突检测（自动检测并提示冲突）
- 快捷键序列支持（如 Vim 风格的组合键）
