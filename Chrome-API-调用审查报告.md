# Chrome Bookmarks API 调用审查报告

## 📋 审查时间

2025-10-26

## 🎯 审查目标

确保前端 UI 层（pages/、components/、stores/）不直接调用 Chrome Bookmarks API，
保持数据流单向性：Chrome API → Background Script → IndexedDB → UI

## ✅ 合格区域（无违规）

### 1. UI 层

- ✅ `frontend/src/pages/` - **无直接调用**
- ✅ `frontend/src/components/` - **无直接调用**
- ✅ `frontend/src/stores/` - **无直接调用**

### 2. Background Script（允许调用）

- ✅ `frontend/src/background/bookmarks.ts` - 监听器（合规）
  - `chrome.bookmarks.onCreated`
  - `chrome.bookmarks.onChanged`
  - `chrome.bookmarks.onMoved`
  - `chrome.bookmarks.onRemoved`
  - `chrome.bookmarks.onImportBegan`
  - `chrome.bookmarks.onImportEnded`

- ✅ `frontend/src/background/omnibox.ts` - 地址栏功能（合规）
  - `chrome.bookmarks.get(id)` - 获取单个书签跳转

## ⚠️ 需要注意的区域

### 1. Application 层

#### `frontend/src/application/bookmark/bookmark-app-service.ts`

**调用**:

```typescript
chrome.bookmarks.create() // 创建书签
chrome.bookmarks.update() // 更新书签
chrome.bookmarks.remove() // 删除书签
```

**评估**: ⚠️ **需要讨论**

- **当前设计**: Application 层直接调用 Chrome API 进行 CRUD
- **问题**:
  - 绕过了 Background Script 的同步机制
  - 可能导致 IndexedDB 数据不同步
- **建议**:
  - 改为通过 `chrome.runtime.sendMessage` 发送到 Background Script
  - 由 Background Script 统一处理并同步到 IndexedDB

**优先级**: 🔴 **高** - 影响数据一致性

---

### 2. Services 层

#### `frontend/src/services/bookmark-sync-service.ts`

**调用**:

```typescript
chrome.bookmarks.getTree() // 全量同步时获取
chrome.bookmarks.get(id) // 增量同步时获取单个
```

**评估**: ✅ **合规**

- **场景**: 后台同步服务，由 Background Script 调用
- **职责**: 将 Chrome API 数据同步到 IndexedDB
- **正确性**: ✅ 这是数据流的起点，合规

---

#### `frontend/src/services/modern-bookmark-service.ts`

**调用**:

```typescript
chrome.bookmarks.onCreated.addListener()
chrome.bookmarks.onRemoved.addListener()
chrome.bookmarks.onChanged.addListener()
chrome.bookmarks.onMoved.addListener()
chrome.bookmarks.onImportBegan.addListener()
chrome.bookmarks.onImportEnded.addListener()
```

**评估**: ⚠️ **需要审查**

- **问题**: 这个服务注册了重复的监听器
- **现状**: `background/bookmarks.ts` 已经注册了监听器
- **建议**:
  - 如果这是遗留代码，应该移除
  - 避免重复监听导致多次同步

**优先级**: 🟡 **中** - 可能影响性能

---

#### `frontend/src/services/bookmark-crawler-trigger.ts`

**调用**:

```typescript
chrome.bookmarks.onCreated.addListener() // 监听新书签触发爬取
```

**评估**: ✅ **基本合规**

- **场景**: 监听书签创建，触发爬虫
- **职责**: 增强功能（爬取书签内容）
- **建议**: 考虑移到 Background Script，通过消息触发

**优先级**: 🟢 **低** - 功能性代码

---

### 3. 类型定义（无影响）

- ✅ `frontend/src/types/api.ts` - 类型定义
- ✅ `frontend/src/core/common/store-error.ts` - 类型检查
- ✅ `frontend/src/core/bookmark/services/` - 类型转换

## 🚨 高优先级问题

### 问题 1: Application 层直接 CRUD

**文件**: `frontend/src/application/bookmark/bookmark-app-service.ts`

**问题代码**:

```typescript
// ❌ 当前：直接调用 Chrome API
async createBookmark(data: BookmarkCreateDetails) {
  const node = await chrome.bookmarks.create({ ... })
  return Ok(convertToBookmarkNode(node))
}
```

**正确做法**:

```typescript
// ✅ 应该：通过 Background Script
async createBookmark(data: BookmarkCreateDetails) {
  const result = await chrome.runtime.sendMessage({
    type: 'CREATE_BOOKMARK',
    data
  })
  return result
}
```

**影响**:

- 🔴 数据不一致：直接创建不会触发 Background 的同步逻辑
- 🔴 IndexedDB 不更新：其他组件看不到新数据
- 🔴 广播机制失效：其他标签页不会收到通知

---

## 📊 统计数据

| 区域                                | Chrome API 调用          | 是否合规        |
| ----------------------------------- | ------------------------ | --------------- |
| **UI 层** (pages/components/stores) | 0                        | ✅ 完全合规     |
| **Background Script**               | 7                        | ✅ 合规         |
| **Application 层**                  | 3 (create/update/remove) | ⚠️ 需要修复     |
| **Services 层**                     | ~15                      | ⚠️ 部分需要审查 |
| **Types/Core**                      | 0 (仅类型)               | ✅ 合规         |

## 🎯 修复建议

### 立即修复（高优先级）

#### 1. 重构 bookmark-app-service.ts

**当前问题**:

```typescript
// ❌ 应用层直接调用 Chrome API
chrome.bookmarks.create()
chrome.bookmarks.update()
chrome.bookmarks.remove()
```

**修复方案**:

##### 方案 A: 消息传递（推荐）⭐

```typescript
// bookmark-app-service.ts
async createBookmark(data: BookmarkCreateDetails) {
  const result = await chrome.runtime.sendMessage({
    type: 'CREATE_BOOKMARK',
    data
  })
  if (!result.success) {
    return Err(result.error)
  }
  return Ok(result.bookmark)
}

// background/messaging.ts
case 'CREATE_BOOKMARK': {
  const node = await chrome.bookmarks.create(message.data)
  await bookmarkSyncService.syncOne(node.id)
  sendResponse({ success: true, bookmark: node })
  return
}
```

##### 方案 B: 保持现状 + 手动同步

```typescript
// bookmark-app-service.ts
async createBookmark(data: BookmarkCreateDetails) {
  // 1. 调用 Chrome API
  const node = await chrome.bookmarks.create(data)

  // 2. 手动同步到 IndexedDB
  await bookmarkSyncService.syncOne(node.id)

  // 3. 广播通知
  chrome.runtime.sendMessage({
    type: 'acuity-bookmarks-db-synced',
    eventType: 'created',
    bookmarkId: node.id
  })

  return Ok(convertToBookmarkNode(node))
}
```

**推荐**: 方案 A（统一由 Background 处理）

---

### 可选修复（中优先级）

#### 2. 清理重复的监听器

**文件**: `frontend/src/services/modern-bookmark-service.ts`

**问题**: 与 `background/bookmarks.ts` 重复注册监听器

**修复**:

- 如果是遗留代码，直接移除此文件
- 如果有特殊用途，改为订阅 `acuity-bookmarks-db-synced` 事件

---

## ✅ 总结

### 合规情况

- ✅ **UI 层完全合规** - 无直接 Chrome API 调用
- ✅ **Background Script 正确** - 监听器和同步机制到位
- ⚠️ **Application 层需要修复** - CRUD 操作应通过 Background

### 数据流现状

**理想架构**:

```
Chrome API → Background Script → IndexedDB → bookmarkStore → UI
```

**实际架构**:

```
Chrome API → Background Script → IndexedDB → bookmarkStore → UI  ✅
     ↑                                                            ↓
     └──────────── application/bookmark-app-service ─────────────┘  ⚠️
                   (绕过了 Background 的同步机制)
```

### 风险评估

- 🔴 **数据一致性风险**: Application 层直接调用可能导致 IndexedDB 不同步
- 🟡 **性能风险**: 重复的监听器可能导致多次同步
- 🟢 **架构清晰度**: 整体架构清晰，只需修复 Application 层

---

**建议优先级**:

1. 🔴 修复 `bookmark-app-service.ts` 的 CRUD 操作
2. 🟡 审查并清理 `modern-bookmark-service.ts` 的重复监听器
3. 🟢 文档化 `bookmark-crawler-trigger.ts` 的设计决策

---

**报告生成时间**: 2025-10-26  
**审查范围**: frontend/src 目录  
**审查工具**: grep chrome.bookmarks
