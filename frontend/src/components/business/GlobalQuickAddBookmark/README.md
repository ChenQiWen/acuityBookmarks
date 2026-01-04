# GlobalQuickAddBookmark

## 📖 组件描述

全局快速添加书签组件，监听来自 background script 的消息，显示快速添加书签对话框。

## ✨ 特性

- ✅ 全局消息监听 - 监听 `SHOW_ADD_BOOKMARK_DIALOG` 消息
- ✅ 自动数据验证 - 验证 URL 和标题的有效性
- ✅ AI 标签生成 - 支持 AI 自动生成标签
- ✅ 错误处理 - 完善的错误提示和日志记录
- ✅ 通知反馈 - 操作成功/失败的通知提示

## 🔗 依赖组件

- [QuickAddBookmarkDialog](../QuickAddBookmarkDialog/README.md) - 快速添加书签对话框

## 📦 安装

```vue
<script setup lang="ts">
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
</script>
```

## 🎯 基础用法

### 在页面根组件中添加

```vue
<script setup lang="ts">
import GlobalQuickAddBookmark from '@/components/business/GlobalQuickAddBookmark/GlobalQuickAddBookmark.vue'
</script>

<template>
  <div class="app">
    <!-- 页面内容 -->
    <router-view />
    
    <!-- 全局快速添加书签 -->
    <GlobalQuickAddBookmark />
  </div>
</template>
```

### 触发添加书签对话框

```typescript
// 从任何地方发送消息
chrome.runtime.sendMessage({
  type: 'SHOW_ADD_BOOKMARK_DIALOG',
  data: {
    title: '页面标题',
    url: 'https://example.com',
    favIconUrl: 'https://example.com/favicon.ico'
  }
})
```

## 📋 API 文档

### Props

此组件不接受任何 props。

### Emits

此组件不触发任何事件。

### Slots

此组件不提供任何插槽。

## 🎨 使用场景

### 场景 1：从 content script 添加书签

```typescript
// content-script.ts
chrome.runtime.sendMessage({
  type: 'SHOW_ADD_BOOKMARK_DIALOG',
  data: {
    title: document.title,
    url: window.location.href,
    favIconUrl: getFavIconUrl()
  }
})
```

### 场景 2：从 background script 添加书签

```typescript
// background.ts
chrome.runtime.sendMessage({
  type: 'SHOW_ADD_BOOKMARK_DIALOG',
  data: {
    title: tab.title,
    url: tab.url,
    favIconUrl: tab.favIconUrl
  }
})
```

### 场景 3：从右键菜单添加书签

```typescript
// background.ts
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-bookmark') {
    chrome.runtime.sendMessage({
      type: 'SHOW_ADD_BOOKMARK_DIALOG',
      data: {
        title: tab?.title || info.pageUrl,
        url: info.pageUrl,
        favIconUrl: tab?.favIconUrl
      }
    })
  }
})
```

## 🔧 工作原理

### 消息监听流程

```
1. 组件挂载时注册消息监听器
   ↓
2. 接收 SHOW_ADD_BOOKMARK_DIALOG 消息
   ↓
3. 验证数据（URL 不能为空）
   ↓
4. 显示 QuickAddBookmarkDialog
   ↓
5. 用户确认后发送 CREATE_BOOKMARK 消息
   ↓
6. Background script 创建书签
   ↓
7. 显示成功/失败通知
```

### 数据验证

```typescript
// ✅ 必须验证
if (!data.url || data.url.trim() === '') {
  // 显示错误通知
  return
}

// ✅ 标题为空时使用 URL
if (!data.title || data.title.trim() === '') {
  data.title = data.url
}
```

## ⚠️ 注意事项

### 1. 必须在每个页面添加

```vue
<!-- ✅ 正确：在每个页面的根组件中添加 -->
<template>
  <div>
    <router-view />
    <GlobalQuickAddBookmark />
  </div>
</template>

<!-- ❌ 错误：只在某些页面添加 -->
<template>
  <div>
    <router-view />
    <!-- 缺少 GlobalQuickAddBookmark -->
  </div>
</template>
```

### 2. URL 验证

```typescript
// ✅ 正确：验证 URL
if (!data.url || data.url.trim() === '') {
  notificationService.notifyError('URL 不能为空')
  return
}

// ❌ 错误：不验证 URL
chrome.runtime.sendMessage({
  type: 'CREATE_BOOKMARK',
  data: {
    url: ''  // 可能创建文件夹而不是书签
  }
})
```

### 3. 消息响应

```typescript
// ✅ 正确：返回响应
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_ADD_BOOKMARK_DIALOG') {
    // 处理消息
    sendResponse({ success: true })
    return true  // 保持消息通道打开
  }
})

// ❌ 错误：不返回响应
chrome.runtime.onMessage.addListener((message) => {
  // 处理消息
  // 没有 sendResponse
})
```

## 🔗 相关组件

- [QuickAddBookmarkDialog](../QuickAddBookmarkDialog/README.md) - 快速添加书签对话框
- [GlobalSyncProgress](../GlobalSyncProgress/README.md) - 全局同步进度

## 📚 相关文档

- [业务组件规范](../README.md)
- [组件分类规范](../../README.md)
- [Chrome Extension 消息传递](https://developer.chrome.com/docs/extensions/mv3/messaging/)

## 🔄 更新日志

### v1.0.0 (2025-01-05)

- ✅ 初始版本
- ✅ 支持全局消息监听
- ✅ 支持数据验证
- ✅ 支持 AI 标签生成
- ✅ 支持错误处理和通知

---

**最后更新**: 2025-01-05  
**维护者**: Kiro AI
