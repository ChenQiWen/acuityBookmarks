# 收藏功能数据同步修复 - 实现任务

## 核心问题

这是一个**非常基础的状态同步需求**：多个页面可以修改同一个书签的收藏状态，所有页面需要实时同步。

**根本原因**：`bookmarkStore.updateNode` 方法使用了 `updateRef`，但文件没有导入，导致运行时错误。

## 任务列表

- [x] 1. 修复 bookmarkStore.ts 缺少 updateRef 导入
  - 在 `frontend/src/stores/bookmarkStore.ts` 第 22 行
  - 将 `import { updateMap } from '@/infrastructure/state/immer-helpers'`
  - 改为 `import { updateMap, updateRef } from '@/infrastructure/state/immer-helpers'`
  - _验证：Requirements Bug 5，这是导致 `updateRef is not defined` 错误的根本原因_

- [x] 2. 修复 Management.vue 动态导入 updateRef
  - 在 `frontend/src/pages/management/Management.vue` 文件顶部添加静态导入
  - 添加 `import { updateRef } from '@/infrastructure/state/immer-helpers'`
  - 删除第 1668 行的动态导入：`const { updateRef } = await import('@/infrastructure/state/immer-helpers')`
  - _验证：Requirements Bug 5，简化代码，避免动态导入_

- [x] 3. 运行代码检查
  - 运行 `bun run typecheck:force` 确保类型检查通过
  - 运行 `bun run lint:check:force` 确保代码规范检查通过
  - 运行 `bun run stylelint:force` 确保样式检查通过
  - _验证：所有代码检查通过_

- [x] 4. 手动测试验证
  - 在 Management 页面点击收藏 icon，验证不报错
  - 验证左侧树和右侧树的收藏 icon 同时更新
  - 切换到 SidePanel 页面，验证收藏状态同步
  - 刷新页面，验证收藏状态保持
  - _验证：Requirements 验收标准 1-8_

## 任务详情

### 任务 1：修复 Management.vue 中的 updateRef 导入问题

**当前代码**（`frontend/src/pages/management/Management.vue:1668`）：
```typescript
const handleBookmarkToggleFavorite = async (node, isFavorite) => {
  try {
    const { favoriteAppService } = await import(
      '@/application/bookmark/favorite-app-service'
    )
    const { updateRef } = await import('@/infrastructure/state/immer-helpers')
    
    // ... 使用 updateRef
  }
}
```

**修改后**：
```typescript
// 在文件顶部添加静态导入
import { updateRef } from '@/infrastructure/state/immer-helpers'

const handleBookmarkToggleFavorite = async (node, isFavorite) => {
  try {
    const { favoriteAppService } = await import(
      '@/application/bookmark/favorite-app-service'
    )
    // 移除动态导入 updateRef
    
    // ... 使用 updateRef（现在是静态导入的）
  }
}
```

### 任务 2：修复 bookmarkStore.updateNode 方法

**当前代码**（`frontend/src/stores/bookmarkStore.ts:588`）：
```typescript
updateNode(id: string, changes: Partial<BookmarkNode>) {
  updateMap(nodes, draft => {
    const node = draft.get(id)
    if (node) {
      draft.set(id, { ...node, ...changes })
    }
  })
  
  // ❌ 问题：清空 childrenIndex 导致树重建失败
  updateMap(childrenIndex, draft => draft.clear())
  cachedTree.value = []
}
```

**修改后**：
```typescript
updateNode(id: string, changes: Partial<BookmarkNode>) {
  // 1. 更新 nodes Map
  updateMap(nodes, draft => {
    const node = draft.get(id)
    if (node) {
      draft.set(id, { ...node, ...changes })
    }
  })
  
  // 2. 更新 cachedTree（递归查找并更新）
  if (cachedTree.value.length > 0) {
    const updateInTree = (nodes: BookmarkNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === id) {
          Object.assign(node, changes)
          return true
        }
        if (node.children && node.children.length > 0) {
          if (updateInTree(node.children)) {
            return true
          }
        }
      }
      return false
    }

    updateRef(cachedTree, draft => {
      updateInTree(draft)
    })
  }
  
  // 3. 更新 childrenIndex（查找并更新节点引用）
  updateMap(childrenIndex, draft => {
    for (const [_parentId, children] of draft.entries()) {
      const index = children.findIndex(child => child.id === id)
      if (index !== -1) {
        const updatedNode = { ...children[index], ...changes }
        children[index] = updatedNode
      }
    }
  })
}
```

### 任务 3：修复 favoriteAppService 数据流

**当前代码**（`frontend/src/application/bookmark/favorite-app-service.ts`）：
```typescript
async addToFavorites(bookmarkId: string): Promise<boolean> {
  // ... 准备数据
  
  await indexedDBManager.updateBookmark(updatedBookmark)
  this.broadcastFavoriteChange('added', bookmarkId)
  
  return true
}
```

**修改后**：
```typescript
async addToFavorites(bookmarkId: string): Promise<boolean> {
  // ... 准备数据
  
  // 1. 更新 IndexedDB
  await indexedDBManager.updateBookmark(updatedBookmark)
  
  // 2. 同步更新 bookmarkStore（确保 UI 立即响应）
  try {
    const { useBookmarkStore } = await import('@/stores/bookmarkStore')
    const bookmarkStore = useBookmarkStore()
    bookmarkStore.updateNode(bookmarkId, {
      isFavorite: true,
      favoriteOrder,
      favoritedAt
    })
  } catch (error) {
    logger.warn('FavoriteAppService', '更新 bookmarkStore 失败（非致命错误）', error)
  }
  
  // 3. 广播变更事件
  this.broadcastFavoriteChange('added', bookmarkId)
  
  return true
}
```

同样修改 `removeFromFavorites` 方法。

### 任务 4：验证 Management 页面双树同步

**检查点**：
1. `handleBookmarkToggleFavorite` 函数中是否调用了 `bookmarkStore.updateNode()`
2. `handleBookmarkToggleFavorite` 函数中是否调用了 `updateRef(newProposalTree, ...)`
3. 两个更新是否都在 `success` 条件内执行

**预期代码**：
```typescript
const handleBookmarkToggleFavorite = async (node, isFavorite) => {
  try {
    const success = isFavorite
      ? await favoriteAppService.addToFavorites(node.id)
      : await favoriteAppService.removeFromFavorites(node.id)

    if (success) {
      // ✅ 1. 更新左侧原始树（通过 bookmarkStore）
      bookmarkStore.updateNode(node.id, { 
        isFavorite,
        favoriteOrder: isFavorite ? (node.favoriteOrder ?? Date.now()) : undefined,
        favoritedAt: isFavorite ? Date.now() : undefined
      })

      // ✅ 2. 更新右侧提案树
      updateRef(newProposalTree, draft => {
        const updateNodeInTree = (nodes: BookmarkNode[]): boolean => {
          for (const n of nodes) {
            if (n.id === node.id) {
              n.isFavorite = isFavorite
              n.favoriteOrder = isFavorite ? (node.favoriteOrder ?? Date.now()) : undefined
              n.favoritedAt = isFavorite ? Date.now() : undefined
              return true
            }
            if (n.children && n.children.length > 0) {
              if (updateNodeInTree(n.children)) {
                return true
              }
            }
          }
          return false
        }
        
        updateNodeInTree(draft.children)
      })
    }
  } catch (error) {
    logger.error('切换收藏状态失败', error)
  }
}
```

### 任务 5：运行代码检查

**命令**：
```bash
# 1. 类型检查
bun run typecheck:force

# 2. 代码规范检查
bun run lint:check:force

# 3. 样式检查
bun run stylelint:force
```

**预期结果**：
- ✅ 所有检查通过，无错误
- ✅ 无 TypeScript 类型错误
- ✅ 无 ESLint 规范错误
- ✅ 无 Stylelint 样式错误

### 任务 6：手动测试验证

**测试场景 1：SidePanel 页面收藏**
1. 打开 SidePanel 页面
2. 点击任意书签的收藏 icon
3. 验证：icon 立即变为已收藏状态（⭐）
4. 切换到 Management 页面
5. 验证：左右两侧都显示已收藏状态
6. 刷新页面
7. 验证：收藏状态保持

**测试场景 2：Management 页面左侧树收藏**
1. 打开 Management 页面
2. 在左侧树点击任意书签的收藏 icon
3. 验证：左侧 icon 立即变为已收藏状态
4. 验证：右侧树同步显示已收藏状态
5. 切换到 SidePanel 页面
6. 验证：SidePanel 显示已收藏状态

**测试场景 3：Management 页面右侧树收藏**
1. 打开 Management 页面
2. 在右侧树点击任意书签的收藏 icon
3. 验证：右侧 icon 立即变为已收藏状态
4. 验证：左侧树同步显示已收藏状态
5. 切换到 SidePanel 页面
6. 验证：SidePanel 显示已收藏状态

**测试场景 4：跨页面同步**
1. 在 SidePanel 收藏一个书签
2. 切换到 Management 页面
3. 验证：左右两侧都显示已收藏
4. 在 Management 页面取消收藏
5. 切换到 SidePanel 页面
6. 验证：SidePanel 显示未收藏

**测试场景 5：浏览器重启**
1. 收藏几个书签
2. 关闭浏览器
3. 重新打开浏览器
4. 打开扩展
5. 验证：所有收藏状态保持

**测试场景 6：错误处理**
1. 打开浏览器控制台
2. 点击收藏 icon
3. 验证：没有 `updateRef is not defined` 错误
4. 验证：没有其他 JavaScript 错误

## 完成标准

- [ ] 所有任务完成
- [ ] 所有代码检查通过
- [ ] 所有测试场景通过
- [ ] 没有 `updateRef is not defined` 错误
- [ ] 收藏 icon 状态立即更新
- [ ] 所有页面收藏状态同步
