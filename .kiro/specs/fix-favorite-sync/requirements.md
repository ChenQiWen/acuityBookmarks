# 收藏功能数据同步修复 - 需求文档

## 问题描述

用户报告：SidePanel 页面显示书签已收藏，但书签树中显示未收藏，收藏状态在不同页面间不一致。

## 根本原因分析

### 1. 数据流问题
- **正确的数据流**：favoriteAppService → IndexedDB → bookmarkStore → UI
- **实际问题**：IndexedDB 更新了，但 bookmarkStore 的响应式状态没有正确更新

### 2. 具体 Bug 点

#### Bug 1: bookmarkStore.updateNode 清空 childrenIndex 导致树重建失败
**位置**：`frontend/src/stores/bookmarkStore.ts:588`
```typescript
// ❌ 问题代码
updateMap(childrenIndex, draft => draft.clear())
cachedTree.value = [] // 清空缓存，触发 computed 重建树
```
**问题**：清空 `childrenIndex` 后，`bookmarkTree` computed 无法正确重建树，因为依赖的索引数据丢失

#### Bug 2: Management 页面使用 newProposalTree 而非 bookmarkStore
**位置**：`frontend/src/pages/management/Management.vue:1655`
```typescript
// ❌ 问题代码：更新的是提案树，而非主 store
updateRef(newProposalTree, draft => {
  const updateRecursive = (nodes: BookmarkNode[]): boolean => {
    for (const n of nodes) {
      if (n.id === node.id) {
        n.isFavorite = isFavorite
        return true
      }
      // ...
    }
  }
  updateRecursive(draft.children)
})
```
**问题**：Management 页面右侧显示的是 `newProposalTree`（提案树），左侧显示的是 `bookmarkStore.bookmarkTree`（原始树），更新提案树不会影响左侧树的显示

#### Bug 3: favoriteAppService 没有触发 bookmarkStore 更新
**位置**：`frontend/src/application/bookmark/favorite-app-service.ts`
```typescript
// ❌ 问题：只更新了 IndexedDB，没有通知 bookmarkStore
await indexedDBManager.updateBookmark(updatedBookmark)
this.broadcastFavoriteChange('added', bookmarkId)
```
**问题**：`broadcastFavoriteChange` 只发送 Chrome runtime 消息，但 bookmarkStore 没有监听这个消息

#### Bug 4: insertBookmarks 保留自定义字段的逻辑可能失效
**位置**：`frontend/src/infrastructure/indexeddb/manager.ts:656`
```typescript
// ⚠️ 潜在问题：如果 existingMap 为空，所有自定义字段都会丢失
const existing = existingMap.get(record.id)
return {
  ...record,
  isFavorite: existing?.isFavorite ?? record.isFavorite,
  // ...
}
```
**问题**：在首次加载或全量同步时，`existingMap` 可能为空，导致自定义字段丢失

#### Bug 5: updateRef 未定义错误
**位置**：`frontend/src/pages/management/Management.vue:1668-1687`
```typescript
// ❌ 问题代码：updateRef 是动态导入的，只在函数作用域内有效
const handleBookmarkToggleFavorite = async (node, isFavorite) => {
  const { updateRef } = await import('@/infrastructure/state/immer-helpers')
  
  // ... 其他代码
  
  // ✅ 这里可以使用 updateRef（在同一作用域）
  updateRef(newProposalTree, draft => {
    // ...
  })
}
```
**问题**：
1. 点击收藏图标时报错 `ReferenceError: updateRef is not defined`
2. 虽然侧边栏收藏数据更新了，但书签目录树组件的收藏 icon 状态没有变化
3. 左侧原始树依赖 `bookmarkStore.bookmarkTree`，但 `bookmarkStore.updateNode` 调用后没有正确触发响应式更新

## 需求

### 功能需求

1. **FR-1**: 收藏状态在所有页面保持一致
   - SidePanel 页面
   - Management 页面（左右两侧）
   - Popup 页面
   - 书签树组件

2. **FR-2**: 收藏操作实时生效
   - 点击收藏图标后，UI 立即更新
   - IndexedDB 数据持久化
   - 其他页面自动同步

3. **FR-3**: 数据持久化
   - 浏览器重启后收藏状态保留
   - Chrome 书签同步不影响收藏状态

### 非功能需求

1. **NFR-1**: 性能
   - 收藏操作响应时间 < 100ms
   - 不阻塞 UI 渲染

2. **NFR-2**: 可靠性
   - 数据一致性保证
   - 错误处理和回滚机制

3. **NFR-3**: 可维护性
   - 遵循单向数据流架构
   - 代码清晰易懂

## 当前问题（2025-12-10）

### 问题现象
1. 点击收藏 icon 时报错：`Error in event handler: ReferenceError: updateRef is not defined`
2. 侧边栏收藏书签数据已更新
3. 但书签目录树组件的收藏 icon 状态没有变化

### 问题分析
根据代码检查（`Management.vue:1668`），`updateRef` 是通过动态导入的：
```typescript
const { updateRef } = await import('@/infrastructure/state/immer-helpers')
```

但这个动态导入的 `updateRef` 只在 `handleBookmarkToggleFavorite` 函数作用域内有效。如果在该函数外部或其他地方使用了 `updateRef`，就会报 `updateRef is not defined` 错误。

### 需要修复的点
1. 将 `updateRef` 改为静态导入，而不是动态导入
2. 确保 `bookmarkStore.updateNode` 正确触发响应式更新
3. 确保 Management 页面左侧树（原始树）和右侧树（提案树）都正确更新

## 验收标准

1. ✅ 在任意页面点击收藏图标，所有页面的收藏状态立即同步
2. ✅ 刷新页面后，收藏状态保持不变
3. ✅ 浏览器重启后，收藏状态保持不变
4. ✅ Management 页面左右两侧收藏状态一致
5. ✅ 收藏操作不影响书签树的展开/折叠状态
6. ✅ 收藏操作不触发整个书签树重新加载
7. ✅ 点击收藏图标不报错（`updateRef is not defined`）
8. ✅ 书签目录树组件的收藏 icon 状态立即更新
