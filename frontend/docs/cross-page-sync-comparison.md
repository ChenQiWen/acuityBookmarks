# 跨页面数据同步机制对比分析

## 概述

AcuityBookmarks 扩展中存在两套跨页面数据同步机制：

1. **收藏功能同步**：使用 `useCrossPageSync` + `chrome.storage.session`
2. **主题功能同步**：使用 `useThemeSync` + `chrome.storage.local`

## 详细对比

### 1. 收藏功能同步

#### 实现文件
- `frontend/src/composables/useCrossPageSync.ts` - 跨页面同步 composable
- `frontend/src/application/bookmark/favorite-app-service.ts` - 收藏服务
- `frontend/src/background/messaging.ts` - Background Script 消息处理

#### 同步流程
```
用户点击收藏按钮
    ↓
favoriteAppService.addToFavorites()
    ↓
chrome.runtime.sendMessage({ type: 'FAVORITE_CHANGED', action: 'added', bookmarkId })
    ↓
Background Script 接收消息
    ↓
chrome.storage.session.set({ __favoriteEvent: { ... } })
    ↓
chrome.storage.onChanged 事件触发
    ↓
所有页面的 useCrossPageSync 监听器收到通知
    ↓
bookmarkStore.updateNode(bookmarkId, { isFavorite: true })
    ↓
Vue 响应式自动更新 UI
```

#### 存储位置
- `chrome.storage.session` - 会话级存储
- 键名：`__favoriteEvent`

#### 已集成页面
- ✅ Management 页面（`frontend/src/pages/management/main.ts`）
- ✅ SidePanel 页面（`frontend/src/pages/side-panel/main.ts`）
- ❌ **Popup 页面未集成**

---

### 2. 主题功能同步

#### 实现文件
- `frontend/src/composables/useThemeSync.ts` - 主题同步 composable
- `frontend/src/components/base/ThemeToggle/ThemeToggle.vue` - 主题切换组件
- `frontend/src/infrastructure/global-state/global-state-manager.ts` - 全局状态管理器

#### 同步流程
```
用户点击主题切换按钮
    ↓
ThemeToggle.toggleTheme()
    ↓
globalStateManager.setTheme(newTheme)
    ↓
chrome.storage.local.set({ theme: 'dark' })
    ↓
chrome.storage.onChanged 事件触发
    ↓
所有页面的 useThemeSync 监听器收到通知
    ↓
applyTheme(newTheme)
    ↓
直接操作 DOM（document.documentElement）
```

#### 存储位置
- `chrome.storage.local` - 本地持久化存储
- 键名：`theme`

#### 已集成页面
- ✅ Popup 页面（`frontend/src/pages/popup/Popup.vue`）
- ✅ SidePanel 页面（`frontend/src/pages/side-panel/SidePanel.vue`）
- ✅ Management 页面（`frontend/src/pages/management/Management.vue`）

---

## 核心差异

| 特性 | 收藏同步 | 主题同步 |
|------|---------|---------|
| **存储类型** | `chrome.storage.session` | `chrome.storage.local` |
| **生命周期** | 会话级（浏览器关闭后清除） | 永久（浏览器关闭后保留） |
| **消息中转** | 需要 Background Script 中转 | 直接写入 storage |
| **数据更新** | 更新 Pinia Store | 直接操作 DOM |
| **事件键名** | `__favoriteEvent` | `theme` |
| **Popup 集成** | ❌ 未集成 | ✅ 已集成 |

---

## 问题分析

### 问题 1：Popup 页面未集成收藏同步

**现象：**
- Management 和 SidePanel 页面可以同步收藏状态
- Popup 页面无法接收其他页面的收藏变更

**原因：**
- `frontend/src/pages/popup/main.ts` 中没有调用 `initCrossPageSync()`

**影响：**
- 在 Management 或 SidePanel 中收藏/取消收藏书签
- Popup 页面不会实时更新收藏状态
- 需要刷新 Popup 页面才能看到最新状态

### 问题 2：两套不同的同步机制

**现状：**
- 收藏功能使用 `useCrossPageSync` + `chrome.storage.session`
- 主题功能使用 `useThemeSync` + `chrome.storage.local`

**潜在问题：**
- 维护两套不同的同步机制，增加复杂度
- 开发者需要记住不同功能使用不同的同步方式
- 未来添加新功能时可能不清楚应该使用哪套机制

---

## 建议改进方案

### 方案 1：统一使用 `chrome.storage` 监听机制

**优点：**
- 简单直接，Chrome API 原生支持
- 性能开销小
- 不需要 Background Script 中转

**实现：**
```typescript
// 统一的跨页面同步 composable
export function useCrossPageSync() {
  const handleStorageChange = (changes, areaName) => {
    // 主题同步
    if (areaName === 'local' && changes.theme) {
      applyTheme(changes.theme.newValue)
    }
    
    // 收藏同步
    if (areaName === 'session' && changes.__favoriteEvent) {
      const event = changes.__favoriteEvent.newValue
      bookmarkStore.updateNode(event.bookmarkId, { 
        isFavorite: event.action === 'added' 
      })
    }
    
    // 其他功能同步...
  }
  
  chrome.storage.onChanged.addListener(handleStorageChange)
}
```

### 方案 2：使用 Broadcast Channel API

**优点：**
- 专为跨页面通信设计
- 不依赖 Chrome 扩展 API，更通用
- 支持结构化数据传输

**缺点：**
- 不支持跨浏览器窗口（只在同一浏览器进程内）
- 需要额外的持久化机制

### 方案 3：统一使用 mitt 事件总线 + chrome.storage

**优点：**
- 页面内使用 mitt 事件总线（高性能）
- 跨页面使用 chrome.storage（可靠）
- 统一的事件命名规范

**实现：**
```typescript
// 发送事件
emitEvent('bookmark:favorite-changed', { bookmarkId, isFavorite })
chrome.storage.session.set({ 
  __event: { 
    type: 'bookmark:favorite-changed', 
    data: { bookmarkId, isFavorite } 
  } 
})

// 接收事件
onEvent('bookmark:favorite-changed', handleFavoriteChange)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.__event) {
    const { type, data } = changes.__event.newValue
    emitEvent(type, data)
  }
})
```

---

## 推荐方案

**建议采用方案 1：统一使用 `chrome.storage` 监听机制**

### 理由：
1. ✅ **简单可靠**：Chrome API 原生支持，稳定性高
2. ✅ **性能优异**：直接监听 storage 变化，无需中转
3. ✅ **易于维护**：统一的同步机制，降低复杂度
4. ✅ **符合规范**：符合项目的存储选择决策树

### 实施步骤：
1. 在 `frontend/src/pages/popup/main.ts` 中添加 `initCrossPageSync()`
2. 将主题同步逻辑合并到 `useCrossPageSync` 中
3. 统一事件命名规范（如 `__themeEvent`, `__favoriteEvent`）
4. 更新文档，说明统一的同步机制

---

## 性能考虑

### chrome.storage.onChanged 性能
- ✅ **极低开销**：Chrome 原生事件，C++ 实现
- ✅ **按需触发**：只在数据真正变化时触发
- ✅ **批量处理**：多个变化会合并为一次事件

### 最佳实践
1. **避免频繁写入**：使用防抖（debounce）减少写入次数
2. **最小化数据**：只存储必要的同步信息
3. **及时清理**：使用 `chrome.storage.session` 存储临时事件
4. **监听器管理**：组件卸载时及时移除监听器

---

## 总结

**当前状态：**
- ✅ 主题同步：已在所有页面实现，工作正常
- ⚠️ 收藏同步：Popup 页面未集成，需要补充
- ⚠️ 同步机制：存在两套不同的实现方式

**下一步行动：**
1. **立即修复**：在 Popup 页面集成 `initCrossPageSync()`
2. **长期优化**：统一跨页面同步机制，降低维护成本
3. **文档完善**：建立统一的跨页面同步开发指南
