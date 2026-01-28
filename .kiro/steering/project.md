---
inclusion: always
---

# AcuityBookmarks 项目规则

用中文回复

---
# AcuityBookmarks 项目规范
**本文档为 AI IDE 行为准则，必须严格遵守**
---

## 🚨 AI 行为铁律（违反即为错误）

### 1. 禁止主动操作
```
❌ 绝对禁止：主动提交代码（git commit/push）
❌ 绝对禁止：主动生成任何类型的文档（.md/.txt/.doc/.pdf 等）
❌ 绝对禁止：创建总结性文档（如 migration-report.md、summary.md、changelog.md）
❌ 绝对禁止：创建任何形式的记录文件（日志、报告、说明等）
✅ 唯一例外：用户明确说"生成文档"、"创建文档"、"提交代码"时
✅ 代码文件（.ts/.js/.vue/.css 等）不受此限制
```

### 1.1. 文档生成补充说明
```
❌ 禁止场景：
  - 完成任务后自动生成总结文档
  - 主动创建 README、CHANGELOG、TODO 等文件
  - 创建迁移报告、测试报告等
  - 生成任何形式的"记录"或"说明"文件

✅ 允许场景：
  - 用户明确要求："请生成一个文档"
  - 用户明确要求："帮我写一个 README"
  - 修改代码文件（.ts/.js/.vue/.css 等）
  - 在对话中总结和说明（不创建文件）

⚠️ 判断原则：
  - 如果不确定是否应该创建文档 → 不要创建，在对话中说明
  - 如果用户没有明确说"生成"或"创建"文档 → 不要创建
```

### 2. 代码修改强制检查流程
**每次修改代码后，必须按顺序执行：**

```bash
# 步骤 1: 类型检查
bun run typecheck:force

# 步骤 2: 代码规范检查  
bun run lint:check:force

# 步骤 3: 样式检查
bun run stylelint:force
```

**检查结果处理：**
- ✅ **无错误** → 向用户报告"修改完成，检查通过"
- ❌ **有错误** → 立即修复，直到所有检查通过
- ⚠️ **不确定** → 向用户说明情况，等待指示

### 3. 输出规范
```
✅ 允许：直接修改代码
✅ 允许：在对话中总结修改内容
❌ 禁止：创建独立的文档文件来记录修改
❌ 禁止：创建 CHANGELOG.md、TODO.md 等文件（除非用户要求）
❌ 禁止创建一个 spec
```

## 📚 必读文档
- **产品文档（最重要）**：`文档/产品文档/AcuityBookmarks-产品文档-v3.0.md`
- 架构变更必须同步更新产品文档

---

## 🏗️ 架构铁律（必须严格遵守）

### 铁律 1：单向数据流（禁止违反）

**数据流向图：**
```
Chrome Bookmarks API
       ↓
Background Script (唯一监听者)
       ↓
IndexedDB (唯一数据源)
       ↓
Pinia Store (响应式状态)
       ↓
Vue Components (UI 展示)
       ↓
用户操作 → chrome.runtime.sendMessage → Background Script
```

**判断规则：**
```typescript
// ❌ 错误：前端直接调用 Chrome API
// 文件位置：frontend/src/pages/**/*.vue 或 frontend/src/components/**/*.vue
async function createBookmark() {
  await chrome.bookmarks.create({ title: '新书签' })  // ❌ 违反单向数据流
}

// ✅ 正确：通过消息通知 Background Script
async function createBookmark() {
  await chrome.runtime.sendMessage({                   // ✅ 符合架构
    type: 'CREATE_BOOKMARK',
    payload: { title: '新书签' }
  })
  // Background Script 会自动同步到 IndexedDB
  // IndexedDB 变化会触发 Pinia Store 更新
  // Vue 组件通过 Pinia 自动更新 UI
}
```

**快速检查：**
- 🔍 看到 `chrome.bookmarks.*` → 检查文件路径
  - ✅ 在 `frontend/src/background/` → 允许
  - ❌ 在其他位置 → **违反架构，必须修复**

### 铁律 2：DDD 分层架构（严格执行）

**分层依赖规则：**
```
frontend/src/
├── presentation/     (Vue组件、页面)
│   ↓ 只能调用
├── application/      (业务逻辑、服务)
│   ↓ 只能调用  
├── core/             (领域模型、纯业务)
│   ↓ 只能调用
└── infrastructure/   (IndexedDB、Chrome API、HTTP)
```

**判断规则：**
```typescript
// ❌ 错误：跨层访问
// 文件：frontend/src/presentation/components/BookmarkList.vue
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'  // ❌ presentation 直接访问 infrastructure

// ✅ 正确：通过 application 层
// 文件：frontend/src/presentation/components/BookmarkList.vue
import { bookmarkService } from '@/application/bookmark/bookmark-service'  // ✅ 通过 application 层

// 文件：frontend/src/application/bookmark/bookmark-service.ts
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'     // ✅ application 访问 infrastructure
```

### 铁律 3：IndexedDB 唯一入口

**必须使用：**
```typescript
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

// ✅ 正确
const bookmarks = await indexedDBManager.getAllBookmarks()
await indexedDBManager.updateBookmark(id, updates)
```

**绝对禁止：**
```typescript
// ❌ 禁止直接使用原生 API
const db = await indexedDB.open('bookmarks', 1)  // ❌
const request = db.transaction('bookmarks').objectStore('bookmarks').getAll()  // ❌
```

---

## 💾 存储方案选择（必须遵守）

### 存储类型对比表

| 存储类型 | 容量 | 生命周期 | 使用场景 | 示例 |
|---------|------|---------|---------|------|
| **IndexedDB** | 无限* | 永久 | 大量结构化数据 | 2万+书签、爬取元数据、历史记录 |
| **chrome.storage.local** | 10MB | 永久 | 少量配置数据 | 用户偏好、主题设置、快捷键配置 |
| **chrome.storage.session** | 10MB | 会话级 | 临时状态 | 当前筛选条件、展开状态、同步进度 |
| **Pinia Store** | 内存限制 | 页面级 | UI 响应式状态 | 选中项、loading 状态、modal 显示 |

*实际受磁盘空间限制

### 存储选择决策树

```
开始
 ↓
数据量 > 1000 条？
 ├─ 是 → IndexedDB
 └─ 否 → 继续
      ↓
需要浏览器重启后保留？
 ├─ 是 → chrome.storage.local
 └─ 否 → 继续
      ↓
需要跨页面共享（但会话结束可清除）？
 ├─ 是 → chrome.storage.session
 └─ 否 → Pinia Store
```

### 实际使用示例

```typescript
// ✅ 正确：书签数据 → IndexedDB
await indexedDBManager.getAllBookmarks()  // 2万+ 条数据

// ✅ 正确：用户偏好 → chrome.storage.local
await chrome.storage.local.set({ theme: 'dark', language: 'zh-CN' })

// ✅ 正确：当前筛选状态 → chrome.storage.session
await chrome.storage.session.set({ currentFilter: 'unread', expandedFolders: ['123'] })

// ✅ 正确：UI 状态 → Pinia Store
const uiStore = useUIStore()
uiStore.selectedIds = ['abc', 'def']
```

## 🔍 重要：搜索 vs 筛选

### ⚠️ 本项目中统一使用"筛选"概念

**为什么不叫"搜索"？**
- ✅ 所有数据都在本地 IndexedDB（2万+ 书签）
- ✅ 不存在网络请求
- ✅ 从已有集合中过滤符合条件的书签
- ✅ 这是"筛选（Filter）"的定义，而非"搜索（Search）"

**术语规范：**
- ✅ 对外（UI、API、文档）：**筛选（Filter）**
- ✅ 对内（技术实现、代码注释）：search/filter 都可以
- ❌ 禁止在 UI 文案中使用"搜索"

**相关组件：**
- `BookmarkFilter` 组件：书签筛选组件
- `useBookmarkFilter` Composable：书签筛选 hook
- `searchAppService`：底层筛选服务（技术术语保留）

## 🛠️ 技术栈规范

### 关键工具
- **Immer**：`updateMap(nodes, draft => {...})`（不可变状态更新）
- **mitt**：`emitEvent('bookmark:created', {...})`（事件总线）
- **VueUse**：优先使用 `useEventListener`、`useDebounceFn`、`useTimeoutFn`
- **Zod**：所有外部数据必须校验

### TypeScript 规范
- ❌ 永久禁止 `any`、`as any`
- ✅ 必须使用 Zod 校验外部数据
- ✅ 必须添加 JSDoc 注释（中文）

### Vue 组件规范
- ✅ 必须使用 `defineOptions({ name: 'ComponentName' })`
- ❌ 禁止组件内直接调用 `chrome.bookmarks.*`
- ❌ 禁止组件内直接调用 `indexedDB.open()`

---

## ⚠️ 常见错误速查表（必须避免）

### 错误 1：违反单向数据流

**错误代码：**
```typescript
// ❌ 文件：frontend/src/components/BookmarkItem.vue
async function deleteBookmark(id: string) {
  await chrome.bookmarks.remove(id)  // ❌ 组件直接调用 Chrome API
  // 问题：IndexedDB 不会同步，数据不一致
}
```

**正确代码：**
```typescript
// ✅ 文件：frontend/src/components/BookmarkItem.vue
async function deleteBookmark(id: string) {
  await chrome.runtime.sendMessage({
    type: 'DELETE_BOOKMARK',
    payload: { id }
  })
  // Background Script 会：
  // 1. 调用 chrome.bookmarks.remove(id)
  // 2. 监听到变化，自动更新 IndexedDB
  // 3. Pinia Store 响应 IndexedDB 变化
  // 4. Vue 组件自动更新
}
```

### 错误 2：直接修改响应式对象

**错误代码：**
```typescript
// ❌ 直接修改 Map（Vue 无法检测变化）
const nodes = ref(new Map())
nodes.value.set('123', newNode)        // ❌ Vue 不会触发更新
nodes.value.delete('456')               // ❌ UI 不会刷新
```

**正确代码：**
```typescript
// ✅ 使用 Immer 更新（Vue 可以检测）
import { updateMap } from '@/utils/immer-helpers'

const nodes = ref(new Map())
updateMap(nodes, draft => {
  draft.set('123', newNode)     // ✅ Vue 会触发更新
  draft.delete('456')            // ✅ UI 会自动刷新
})
```

### 错误 3：Service Worker 环境错误

**关键认知：Background Script 运行在 Service Worker，没有 DOM API！**

**环境对比表：**

| API | 网页环境 | Service Worker | 正确用法 |
|-----|---------|---------------|---------|
| 定时器 | `window.setTimeout()` | `setTimeout()` | ✅ 直接用全局 `setTimeout` |
| 网络 | `window.fetch()` | `fetch()` | ✅ 直接用全局 `fetch` |
| 存储 | `localStorage` | ❌ 不存在 | ✅ 用 `chrome.storage.*` |
| DOM | `document.*` | ❌ 不存在 | ❌ Background 中禁止使用 |

**错误代码：**
```typescript
// ❌ 文件：frontend/src/background/bookmarks.ts
class BookmarkSync {
  private timer: number | null = null  // ❌ 类型错误
  
  start() {
    this.timer = window.setTimeout(() => {    // ❌ Service Worker 没有 window
      const data = localStorage.getItem('key') // ❌ Service Worker 没有 localStorage
      document.body.innerHTML = 'hi'           // ❌ Service Worker 没有 document
    }, 1000)
  }
}
```

**正确代码：**
```typescript
// ✅ 文件：frontend/src/background/bookmarks.ts
class BookmarkSync {
  private timer: ReturnType<typeof setTimeout> | null = null  // ✅ 正确类型
  
  start() {
    this.timer = setTimeout(async () => {           // ✅ 全局函数，无 window
      const result = await chrome.storage.local.get('key')  // ✅ 用 chrome.storage
      console.log(result.key)                       // ✅ console 在 Service Worker 可用
    }, 1000)
  }
}
```

**受影响文件（写代码时必须检查）：**
- `frontend/src/background/**/*.ts` - **所有文件**
- `frontend/src/services/**/*-service.ts` - **可能在 Background 调用的服务**

### 错误 4：缺少数据校验

**错误代码：**
```typescript
// ❌ 直接使用外部数据（可能不符合类型）
async function loadBookmarks() {
  const data = await indexedDBManager.getAllBookmarks()
  nodes.value = flattenTreeToMap(data)  // ❌ 没有校验，可能运行时报错
}
```

**正确代码：**
```typescript
// ✅ 使用 Zod 校验外部数据
import { BookmarkRecordArraySchema } from '@/core/types/bookmark'

async function loadBookmarks() {
  const rawData = await indexedDBManager.getAllBookmarks()
  const validated = BookmarkRecordArraySchema.parse(rawData)  // ✅ 运行时校验
  nodes.value = flattenTreeToMap(validated)                    // ✅ 类型安全
}
```

### 错误 5：UI 术语不统一

**错误代码：**
```vue
<!-- ❌ UI 中使用"搜索" -->
<template>
  <Input placeholder="搜索书签" />     // ❌ 错误术语
  <Button>开始搜索</Button>            // ❌ 应该用"筛选"
</template>
```

**正确代码：**
```vue
<!-- ✅ UI 中使用"筛选" -->
<template>
  <Input placeholder="筛选书签" />     // ✅ 正确术语
  <Button>开始筛选</Button>            // ✅ 符合产品定位
</template>
```

**原因：**
- 所有数据在本地 IndexedDB，不是远程搜索
- 从已有集合中过滤 = 筛选（Filter）
- 对外统一使用"筛选"概念

## ⚡ 性能要求

**目标：支持 2 万书签流畅操作**

- ✅ 虚拟滚动：使用 `@tanstack/vue-virtual`
- ✅ 批量操作：IndexedDB 分批（2000/批）
- ✅ 缓存树结构：`flattenTreeToMap` 转 Map（O(1) 查找）
- ❌ 禁止全树递归遍历

## ⏱️ 长耗时任务设计原则

### 核心哲学
**真实进度 > 假进度 > 无反馈**

### 业务分级
- 🔴 **核心业务**（书签同步、导入）：同步执行 + 真实进度反馈
  - 必须显示：阶段指示器 + 百分比 + 当前/总数 + 预计剩余时间
  - 分批写入：每批后 `setTimeout(0)` 让出主线程
  
- 🟡 **辅助业务**（爬虫、AI 标签、健康扫描）：Worker 异步 + 队列调度
  - 优先级排序 + 并发控制 + 可暂停/取消

**禁止：**
- ❌ 核心业务放到 Worker（数据不完整时无法使用）
- ❌ 只有转圈圈，没有百分比和预计时间
- ❌ 假进度条（不基于真实数据）

## 🔧 工具命令

```bash
bun run typecheck:force          # 类型检查（提交前必须）
bun run lint:fix:enhanced        # 代码质量检查
bun run format                   # 格式化
bun run build:hot                # 热构建
```

---

## � 核心要点总结（必读）

**牢记这 5 条铁律，避免 95% 的错误：**

| # | 铁律 | 检查方法 | 违反后果 |
|---|------|---------|---------|
| 1 | **单向数据流** | 看到 `chrome.bookmarks.*` 检查文件路径 | 数据不一致、状态混乱 |
| 2 | **IndexedDB 唯一数据源** | 所有读取都通过 `indexedDBManager` | UI 数据不准确 |
| 3 | **禁止前端直接访问 Chrome API** | 前端只能用 `chrome.runtime.sendMessage` | 破坏架构、难以维护 |
| 4 | **Service Worker 兼容** | Background 中禁用 `window.*` / `localStorage` | 运行时报错 |
| 5 | **UI 术语统一** | UI 文案中用"筛选"而非"搜索" | 产品定位混乱 |

---

## ✅ 代码修改前自检清单

**在修改代码前，先问自己：**

- [ ] 我要修改的文件在哪一层？（presentation / application / infrastructure）
- [ ] 我是否需要访问 Chrome API？
  - 是 → 确保在 `frontend/src/background/` 中
  - 否 → 继续
- [ ] 我是否需要读取 IndexedDB？
  - 是 → 必须通过 `indexedDBManager`
  - 否 → 继续
- [ ] 我是否在 Background Script 中写代码？
  - 是 → 禁止使用 `window.*` / `document.*` / `localStorage`
  - 否 → 继续
- [ ] 我的 UI 文案是否使用了"搜索"？
  - 是 → 改为"筛选"
  - 否 → 继续

---

## ✅ 代码修改后必检清单

**每次修改代码后，按顺序执行：**

```bash
# 1. 类型检查
bun run typecheck:force

# 2. 代码规范检查  
bun run lint:check:force

# 3. 样式检查
bun run stylelint:force
```

**所有检查通过后，才能告诉用户"修改完成"。**



