# 🏗️ Frontend/src 目录架构说明

> **版本**: v2.0  
> **最后更新**: 2025-10-14  
> **架构模式**: 分层架构 + 单向数据流

---

## 📐 整体架构理念

### 核心原则

1. **分层架构** - 清晰的职责分离，单向依赖
2. **单向数据流** - `Chrome API → IndexedDB → UI`
3. **领域驱动** - 以业务逻辑为核心，框架无关
4. **依赖倒置** - 高层不依赖低层实现

### 依赖方向（从上到下）

```
Presentation Layer (表现层)
        ↓
Application Layer (应用层)
        ↓
Core Layer (核心业务层)
        ↓
Infrastructure Layer (基础设施层)
```

**规则**: 只能依赖下层，不能跨层访问或逆向依赖

---

## 📁 目录结构总览

```
frontend/src/
├── 🎯 core/                    # 核心业务层 (框架无关)
├── 🔧 infrastructure/          # 基础设施层 (技术实现)
├── 🎬 application/             # 应用服务层 (用例编排)
├── 🎨 presentation/            # 表现层 (UI专用)
├── 💾 stores/                  # 状态管理 (Pinia)
├── 🧩 components/              # Vue组件库
│   ├── base/                   # 基础UI组件 (纯展示，无业务)
│   └── composite/              # 复合组件 (业务相关)
├── 📄 pages/                   # 页面目录（规划中）
│   ├── popup/                  # 弹出窗口页面
│   ├── side-panel/             # 侧边栏页面
│   ├── management/             # 管理页面
│   ├── auth/                   # 认证页面
│   └── settings/               # 设置页面
├── 🎪 composables/             # Vue组合式函数
├── ⚡ services/                # 服务层 (Legacy + 特殊服务)
├── 🗂️  utils-legacy/            # 遗留工具代码 (仅IndexedDB)
├── 👷 workers/                 # Web Workers
├── 🎨 design-system/           # 设计系统
├── 🖼️  icons/                   # 图标库
├── 📦 types/                   # TypeScript类型定义
├── 🔢 constants/               # 常量定义
├── ⚙️  config/                  # 配置文件
└── 🎨 assets/                  # 静态资源

注：页面目录正在从根级别迁移到 pages/ 目录下，详见《组件与页面规范化方案.md》
```

---

## 🎯 Core Layer (核心业务层)

### 定位

**框架无关的业务逻辑**，是整个应用的核心价值所在。

### 设计原则

- ✅ 不依赖 Vue、React 等 UI 框架
- ✅ 不依赖 IndexedDB、LocalStorage 等具体存储实现
- ✅ 纯粹的业务逻辑和领域模型
- ✅ 可独立测试，可复用到其他项目

### 目录结构

```
core/
├── bookmark/
│   ├── domain/                    # 领域模型
│   │   ├── bookmark.ts            # 书签实体
│   │   ├── cleanup-problem.ts     # 清理问题模型
│   │   └── index.ts
│   ├── services/                  # 领域服务
│   │   ├── bookmark-converter.ts  # 书签格式转换
│   │   ├── cleanup-scanner.ts     # 清理扫描器
│   │   ├── diff-engine.ts         # 差异比对引擎
│   │   ├── executor.ts            # 操作执行器
│   │   ├── tree-converter.ts      # 树结构转换
│   │   └── tree-utils.ts          # 树工具函数
│   └── repositories/              # 仓储接口
│       ├── bookmark-repository.ts # 书签仓储接口
│       └── indexeddb-repository.ts# IndexedDB仓储实现
│
├── search/                        # 搜索引擎
│   ├── engine.ts                  # 统一搜索引擎
│   ├── highlight.ts               # 高亮处理
│   ├── query-cache.ts             # 查询缓存
│   ├── unified-search-service.ts  # 统一搜索服务
│   ├── unified-search-types.ts    # 搜索类型定义
│   └── strategies/                # 搜索策略
│       └── fuse-strategy.ts       # Fuse.js策略
│
└── common/                        # 通用核心
    ├── result.ts                  # Result<T, E> 错误处理
    └── store-error.ts             # Store错误类型
```

### 典型用法

```typescript
// ✅ 正确：Core层只包含业务逻辑
import { DiffEngine } from '@/core/bookmark/services/diff-engine'

const differ = new DiffEngine()
const changes = differ.compare(originalTree, modifiedTree)
```

---

## 🔧 Infrastructure Layer (基础设施层)

### 定位

**技术实现细节**，可替换的基础设施组件。

### 设计原则

- ✅ 实现 Core 层定义的接口
- ✅ 可替换性（如 IndexedDB → LocalStorage）
- ✅ 不包含业务逻辑
- ✅ 技术细节封装

### 目录结构

```
infrastructure/
├── indexeddb/                     # IndexedDB 实现
│   ├── manager.ts                 # 数据库管理器（桥接到legacy）
│   ├── schema.ts                  # 数据库Schema
│   ├── connection-pool.ts         # 连接池
│   └── transaction-manager.ts     # 事务管理器
│
├── chrome-api/                    # Chrome API 封装
│   └── message-client.ts          # 消息通信客户端
│
├── events/                        # 事件系统
│   └── event-stream.ts            # 事件流
│
├── http/                          # HTTP 客户端
│   ├── api-client.ts              # API客户端
│   └── safe-fetch.ts              # 安全fetch封装
│
├── i18n/                          # 国际化
│   └── i18n-service.ts            # i18n服务
│
├── logging/                       # 日志系统
│   ├── logger.ts                  # 日志记录器
│   └── error-handler.ts           # 错误处理器
│
└── error-handling/                # 错误处理
    ├── error-hooks.ts             # 错误钩子
    ├── error-middleware.ts        # 错误中间件
    └── store-error-handler.ts     # Store错误处理
```

### 典型用法

```typescript
// ✅ 正确：通过桥接层访问
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

const bookmarks = await indexedDBManager.getAllBookmarks()
```

---

## 🎬 Application Layer (应用服务层)

### 定位

**用例编排层**，协调多个领域服务完成具体业务场景。

### 设计原则

- ✅ 编排多个 Core 服务
- ✅ 处理事务边界
- ✅ 协调数据流
- ✅ 不包含复杂业务逻辑（委托给 Core）

### 目录结构

```
application/
├── bookmark/
│   ├── bookmark-app-service.ts         # 书签应用服务
│   ├── bookmark-change-app-service.ts  # 书签变更服务
│   └── tree-app-service.ts             # 树操作服务
│
├── cleanup/
│   └── cleanup-app-service.ts          # 清理应用服务
│
├── search/
│   ├── search-app-service.ts           # 搜索应用服务
│   └── search-app-service-refactored.ts# 重构版搜索服务
│
├── auth/
│   └── auth-service.ts                 # 认证服务
│
├── notification/
│   └── notification-service.ts         # 通知服务
│
├── scheduler/
│   └── scheduler-service.ts            # 调度服务
│
├── settings/
│   └── settings-app-service.ts         # 设置服务
│
├── health/
│   └── health-app-service.ts           # 健康检查服务
│
├── font/
│   └── font-service.ts                 # 字体服务
│
└── ui/                                 # UI相关应用服务
```

### 典型用法

```typescript
// ✅ 正确：Application层编排多个服务
export class BookmarkAppService {
  constructor(
    private repo: BookmarkRepository,
    private differ: DiffEngine,
    private executor: BookmarkExecutor
  ) {}

  async applyChanges(changes: Change[]) {
    // 1. 验证变更（Core服务）
    const validated = this.differ.validateChanges(changes)

    // 2. 执行变更（Core服务）
    await this.executor.execute(validated)

    // 3. 刷新缓存（Infrastructure）
    await this.repo.refreshCache()
  }
}
```

---

## 🎨 Presentation Layer (表现层)

### 定位

**UI专用的代码**，包括 Vue 组件、Composables、Stores（仅UI状态）。

### 📦 Stores (状态管理)

```
stores/
├── bookmarkStore.ts          # 书签状态（通用）
├── management-store.ts       # 管理页面状态
├── popup-store.ts           # 弹出窗口状态
└── ui-store.ts              # UI状态
```

**设计原则**:

- ✅ 只管理 UI 状态（加载、选中、展开等）
- ✅ 委托业务逻辑给 Application 层
- ✅ 不直接调用 Chrome API 或 IndexedDB
- ❌ 不包含复杂的树转换、差异比对等逻辑

**示例**:

```typescript
export const useManagementStore = defineStore('management', () => {
  const bookmarkApp = inject<BookmarkAppService>('bookmarkApp')!

  // ✅ UI 状态
  const isLoading = ref(false)
  const selectedNodes = ref([])

  // ✅ 委托给服务层
  async function loadData() {
    isLoading.value = true
    const result = await bookmarkApp.getBookmarkTree()
    // ... 更新 UI 状态
    isLoading.value = false
  }

  return { isLoading, selectedNodes, loadData }
})
```

---

### 🧩 Components (Vue组件)

```
components/
├── BookmarkFolderNode.vue
├── BookmarkItemNode.vue
├── BookmarkTreeView.vue
├── FolderScanIndicator.vue
├── SearchPopup.vue
├── SimpleBookmarkTree.vue
├── SimpleTreeNode.vue
├── SmartBookmarkRecommendations.vue
└── ... (更多UI组件)
```

**设计原则**:

- ✅ 纯展示逻辑
- ✅ 通过 props 接收数据
- ✅ 通过 emits 发送事件
- ✅ 使用 Composables 复用逻辑
- ❌ 不直接调用服务层

---

### 🎪 Composables (组合式函数)

```
composables/
├── useLazyFavicon.ts        # Favicon懒加载
└── index.ts                 # 导出入口
```

**设计原则**:

- ✅ 封装可复用的 UI 逻辑
- ✅ 使用 Vue 响应式 API
- ✅ 可在多个组件中使用
- ✅ 处理生命周期和清理

**示例**:

```typescript
export function useLazyFavicon(url: Ref<string>, rootEl: Ref<HTMLElement>) {
  const faviconUrl = ref('')
  const isLoading = ref(false)

  // 使用 IntersectionObserver 实现懒加载
  onMounted(() => {
    const observer = new IntersectionObserver(entries => {
      // ... 懒加载逻辑
    })
    observer.observe(rootEl.value)
  })

  return { faviconUrl, isLoading }
}
```

---

### 🎨 Presentation 子目录

```
presentation/
├── stores/           # 表现层专用Store（未来规划）
└── ui/              # UI工具函数（未来规划）
```

_注：这是架构优化的一部分，将逐步把 `stores/` 迁移到此处_

---

## ⚡ Services (服务层 - Legacy + 特殊服务)

### 定位

**过渡性目录**，包含尚未迁移到新架构的服务和特殊服务。

### 目录结构

```
services/
├── bookmark-crawler-trigger.ts      # 书签爬虫触发器
├── bookmark-sync-service.ts         # 书签同步服务（核心！）
├── crawl-task-scheduler.ts          # 爬虫任务调度器
├── favicon-service.ts               # Favicon服务
├── lightweight-bookmark-enhancer.ts # 轻量级增强器
├── local-bookmark-crawler.ts        # 本地书签爬虫
├── local-crawler-worker.ts          # 爬虫Worker
├── modern-bookmark-service.ts       # 现代化书签服务
├── search-performance-monitor.ts    # 搜索性能监控
├── search-worker-adapter.ts         # 搜索Worker适配器
├── smart-recommendation-engine.ts   # 智能推荐引擎
└── README.md                        # 服务说明文档
```

### 核心服务说明

#### 📌 bookmark-sync-service.ts

**用途**: **单向数据流的核心！** 负责将 Chrome API 数据同步到 IndexedDB

```typescript
// Chrome API → IndexedDB 的唯一入口
export class BookmarkSyncService {
  async syncAllBookmarks() {
    // 1. 从 Chrome API 读取
    const tree = await chrome.bookmarks.getTree()

    // 2. 扁平化并生成 pathIds
    const flattened = this.flattenBookmarkTree(tree)

    // 3. 写入 IndexedDB
    await indexedDBManager.bulkUpdateBookmarks(flattened)
  }
}
```

#### 📌 modern-bookmark-service.ts

**用途**: 监听 Background 广播，派发前端事件

```typescript
// 监听 IndexedDB 同步完成消息
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'BOOKMARKS_DB_SYNCED') {
    window.dispatchEvent(new CustomEvent(AB_EVENTS.BOOKMARKS_DB_SYNCED))
  }
})
```

#### 📌 favicon-service.ts

**用途**: Favicon 缓存和加载（支持多种策略）

```typescript
export class FaviconService {
  async getFavicon(url: string) {
    // 1. 检查 IndexedDB 缓存
    const cached = await this.loadFromDB(url)
    if (cached) return cached

    // 2. 尝试多种来源（Google、直接、DuckDuckGo）
    const favicon = await this.fetchFavicon(url)

    // 3. 保存到 IndexedDB
    await this.saveToDB(url, favicon)
    return favicon
  }
}
```

#### 📌 smart-recommendation-engine.ts

**用途**: 智能推荐系统（基于用户行为）

- 频率分析
- 最近访问
- 上下文相关性
- 时间模式分析

### 未来规划

这些服务将逐步迁移到新架构：

- `bookmark-sync-service.ts` → `infrastructure/sync/`
- `favicon-service.ts` → `application/favicon/`
- `smart-recommendation-engine.ts` → `core/recommendation/`

---

## 🗂️ Utils-Legacy (遗留工具代码)

### 定位

**仅保留 IndexedDB 相关代码**，其他工具已迁移完成。

### 目录结构

```
utils-legacy/
├── indexeddb-manager.ts     # IndexedDB管理器（~1556行）
├── indexeddb-schema.ts      # 数据库Schema（~536行）
└── indexeddb/               # IndexedDB辅助模块
```

### 为什么保留？

1. **规模大**: 2000+ 行代码
2. **复杂度高**: 涉及复杂的数据库操作和迁移逻辑
3. **已隔离**: 通过 `infrastructure/indexeddb/manager.ts` 桥接
4. **优先级低**: 当前架构已足够好

### 正确使用方式

```typescript
// ✅ 通过桥接层访问
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

// ❌ 不要直接访问
import { indexedDBManager } from '@/utils-legacy/indexeddb-manager'
```

---

## 🧩 Components Layer (组件库)

### 定位

**可复用的 Vue 组件**，分为基础 UI 组件和复合业务组件。

### 设计原则

1. **单一职责** - 每个组件只做一件事
2. **高内聚低耦合** - 组件间依赖清晰
3. **文档完善** - 每个组件都有类型定义和使用文档
4. **可测试** - 纯函数式设计，易于测试

### 目录结构

```
components/
├── base/                       # 基础 UI 组件（27个）
│   ├── Button/
│   │   ├── Button.vue          # 组件实现
│   │   ├── Button.types.ts     # TypeScript 类型定义
│   │   ├── Button.test.ts      # 单元测试（可选）
│   │   └── README.md           # 组件文档
│   ├── Input/
│   ├── Checkbox/
│   ├── Icon/
│   ├── Card/
│   └── ... (其他23个基础组件)
│
├── composite/                  # 复合组件（业务相关）
│   ├── BookmarkTree/
│   │   ├── BookmarkTree.vue
│   │   ├── BookmarkTree.types.ts
│   │   ├── README.md
│   │   └── components/         # 子组件
│   │       ├── TreeNode/
│   │       └── TreeToolbar/
│   ├── SearchPanel/
│   ├── BookmarkRecommendations/
│   └── InlineSearch/
│
├── ui/                         # Legacy UI组件（待迁移）
└── index.ts                    # 统一导出
```

### 基础 UI 组件 (Base Components)

**特征**:

- ✅ 纯展示组件，无业务逻辑
- ✅ 通过 props 接收所有数据
- ✅ 通过 emits 发送所有事件
- ✅ 完全受控（Controlled Component）
- ✅ 可在任何项目中复用

**组件清单**:

| 组件名         | 功能     | 状态        |
| -------------- | -------- | ----------- |
| `Button`       | 按钮     | ✅ 已有     |
| `Input`        | 输入框   | ✅ 已有     |
| `Checkbox`     | 复选框   | ✅ 已有     |
| `Icon`         | 图标     | ✅ 已有     |
| `Card`         | 卡片     | ✅ 已有     |
| `Dialog`       | 对话框   | ✅ 已有     |
| `Tooltip`      | 工具提示 | ✅ 已有     |
| `Switch`       | 开关     | ✅ 已有     |
| `Chip`         | 标签     | ✅ 已有     |
| `Badge`        | 徽章     | ✅ 已有     |
| _... 其他17个_ |          | 🚧 待规范化 |

**使用示例**:

```typescript
import { Button, Input, Icon } from '@/components'

// 完整的类型提示
<Button
  variant="primary"
  size="md"
  :loading="isLoading"
  @click="handleClick"
/>
```

### 复合组件 (Composite Components)

**特征**:

- ✅ 组合多个基础 UI 组件
- ✅ 包含自身的交互逻辑
- ✅ 可访问业务数据（通过 props 或 inject）
- ✅ 可调用 Application 层服务
- ❌ 不直接访问 Chrome API 或 IndexedDB

**组件清单**:

| 组件名                    | 功能     | 依赖的基础组件        |
| ------------------------- | -------- | --------------------- |
| `BookmarkTree`            | 书签树   | Icon, Checkbox, Input |
| `SearchPanel`             | 搜索面板 | Input, Button, List   |
| `BookmarkRecommendations` | 智能推荐 | Card, Icon, Badge     |
| `InlineSearch`            | 内联搜索 | Input, Icon           |

**使用示例**:

```typescript
import { BookmarkTree } from '@/components'

<BookmarkTree
  :nodes="bookmarkNodes"
  :config="treeConfig"
  @node-select="handleSelect"
/>
```

### 组件规范

每个组件必须包含：

1. **`.vue` 文件** - 组件实现
2. **`.types.ts` 文件** - TypeScript 类型定义
3. **`README.md` 文件** - 使用文档
4. **`.test.ts` 文件** - 单元测试（可选）

详细规范见：[《组件与页面规范化方案.md》](./组件与页面规范化方案.md)

---

## 📄 Pages Layer (页面目录)

> **状态**: 🚧 规划中，详见 [《组件与页面规范化方案.md》](./组件与页面规范化方案.md)

### 定位

**应用的页面入口**，每个页面都是一个独立的 SPA 或页面应用。

### 规划中的结构

```
pages/
├── popup/                      # 弹出窗口页面
│   ├── index.html              # HTML 模板
│   ├── main.ts                 # 入口文件
│   ├── Popup.vue               # 主组件
│   ├── components/             # 页面专用组件
│   └── README.md               # 页面文档
│
├── side-panel/                 # 侧边栏页面
│   ├── SidePanel.vue
│   ├── components/
│   └── README.md
│
├── management/                 # 管理页面
│   ├── Management.vue          # 主组件（~2571行）
│   ├── components/             # 页面专用组件
│   └── README.md
│
├── auth/                       # 认证页面
│   ├── Login.vue
│   └── README.md
│
└── settings/                   # 设置页面
    ├── Settings.vue
    └── README.md
```

### 当前状态（待迁移）

当前页面文件仍在根级别目录：

- `popup/` → 待迁移到 `pages/popup/`
- `side-panel/` → 待迁移到 `pages/side-panel/`
- `management/` → 待迁移到 `pages/management/`
- `auth/` → 待迁移到 `pages/auth/`
- `settings/` → 待迁移到 `pages/settings/`

---

## 👷 Workers (Web Workers)

```
workers/
├── search-worker.ts          # 搜索Worker（后台搜索）
└── ... (其他Worker)
```

**用途**: 将耗时操作移到后台线程，避免阻塞UI

---

## 🎨 Design System (设计系统)

```
design-system/
├── base.css                          # 基础样式
├── tokens.css                        # 设计令牌
├── typography.css                    # 排版系统
├── material-theme.css                # Material主题
└── MATERIAL_THEME_INTEGRATION_GUIDE.md
```

**设计原则**:

- ✅ CSS变量驱动
- ✅ Material Design 风格
- ✅ 统一的视觉语言
- ✅ 易于主题切换

---

## 🖼️ Icons (图标库)

```
icons/
├── mdi.ts            # Material Design Icons
└── ...
```

---

## 📦 其他支持目录

### types/ (TypeScript类型)

```
types/
├── index.ts          # 公共类型定义
└── ...
```

### constants/ (常量)

```
constants/
├── events.ts         # 事件名称
├── storage-keys.ts   # 存储键
└── ...
```

### config/ (配置)

```
config/
├── app-config.ts     # 应用配置
└── ...
```

### assets/ (静态资源)

```
assets/
├── images/
├── fonts/
└── ...
```

---

## 🔄 单向数据流架构

### 完整数据流

```
┌─────────────────────────────────────────┐
│        Chrome Bookmarks API             │  ← 唯一真实数据源
│         (唯一的写入来源)                  │
└───────────────┬─────────────────────────┘
                │
                │ chrome.bookmarks.onCreated
                │ chrome.bookmarks.onChanged
                │ chrome.bookmarks.onMoved
                │ chrome.bookmarks.onRemoved
                │
                ↓
┌─────────────────────────────────────────┐
│   Background/Service Worker             │  ← 中心化监听
│   • background.js                       │
│   • setupBookmarkChangeListeners()      │
└───────────────┬─────────────────────────┘
                │
                │ 调用 BookmarkSyncService
                ↓
┌─────────────────────────────────────────┐
│   services/bookmark-sync-service.ts     │  ← 同步服务
│   • syncAllBookmarks()                  │
│   • flattenBookmarkTree()               │
│   • convertChromeNodeToRecord()         │
└───────────────┬─────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────┐
│          IndexedDB                      │  ← 中心化存储
│   • 所有书签数据                         │
│   • 包含 pathIds、depth 等增强字段       │
└───────────────┬─────────────────────────┘
                │
                │ 广播消息
                │ chrome.runtime.sendMessage({
                │   type: 'BOOKMARKS_DB_SYNCED'
                │ })
                ↓
┌─────────────────────────────────────────┐
│   modern-bookmark-service.ts            │  ← 消息中继
│   • 监听 chrome.runtime.onMessage       │
│   • 派发 AB_EVENTS.BOOKMARKS_DB_SYNCED  │
└───────────────┬─────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────┐
│      前端页面 (UI层)                     │  ← 响应更新
│   • Management.vue                      │
│   • SidePanel.vue                       │
│   • Popup.vue                           │
│   • 监听 BOOKMARKS_DB_SYNCED 事件        │
│   • 从 IndexedDB 刷新数据                │
│   • 更新 UI                              │
└─────────────────────────────────────────┘
```

### 数据存储层（IndexedDB）

- 现状更新（2025-10-18）：`frontend/src/infrastructure/indexeddb/manager.ts` 已完全接管 CRUD、搜索、统计等功能，`utils-legacy/` 目录已清理。
- 修改准则：所有 IndexedDB 访问需通过 `manager.ts` 暴露的 API，新增字段需先更新 `schema.ts` 与 `validation/` 目录。

### 背景脚本

- 现状更新：`background` 目录已通过 `services/navigation-service.ts` 与应用层服务解耦，不再直接访问 Chrome API（通知、Tabs、SidePanel 等）。
- 后续规范：新增背景流程时，应先在 `services/` 或 `application/` 定义接口，再在 `background` 调用，保持 DDD 边界清晰。

### 关键规则

1. ✅ **Chrome API 是唯一的真实数据源**
2. ✅ **Background 是唯一的同步入口**
3. ✅ **IndexedDB 是所有页面的数据源**
4. ✅ **所有页面只从 IndexedDB 读取**
5. ❌ **UI 永远不直接读取 Chrome API**
6. ❌ **UI 永远不直接写入 IndexedDB**

---

## 🎯 架构优化进展

### ✅ 已完成

- [x] 创建 `core/` 层（书签和搜索核心）
- [x] 创建 `infrastructure/` 层
- [x] 创建 `application/` 层
- [x] 建立单向数据流机制
- [x] IndexedDB 桥接层
- [x] 类型系统优化
- [x] Favicon 服务独立化

### 🚧 进行中

- [ ] 精简 `management-store.ts`（当前 ~1717 行）
- [ ] 迁移更多 `services/` 到新架构
- [ ] 统一错误处理（Result<T, E> 模式）

### 📋 计划中

- [ ] 统一搜索系统（多个搜索实现合并）
- [ ] 完整迁移 `utils-legacy/`
- [ ] 性能监控系统
- [ ] E2E 测试覆盖

---

## 📚 相关文档

- [单向数据流架构说明.md](../../单向数据流架构说明.md)
- [架构可视化对比.md](./架构可视化对比.md)
- [架构优化实施指南.md](./架构优化实施指南.md)

---

## 🎓 新人上手指南

### 1. 从哪里开始？

**推荐学习路径**:

1. 阅读 [单向数据流架构说明.md](../../单向数据流架构说明.md)
2. 查看 `core/bookmark/` 了解核心业务逻辑
3. 查看 `application/bookmark/` 了解用例编排
4. 查看 `Management.vue` 了解 UI 如何使用服务

### 2. 添加新功能时

**遵循以下流程**:

1. **定义领域模型** → `core/*/domain/`
2. **实现业务逻辑** → `core/*/services/`
3. **编排用例** → `application/*/`
4. **创建 UI** → `components/`, `stores/`

### 3. 常见问题

**Q: 我要读取书签数据，应该调用什么？**

```typescript
// ✅ 正确
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
const bookmarks = await indexedDBManager.getAllBookmarks()

// ❌ 错误
const tree = await chrome.bookmarks.getTree()
```

**Q: 我要修改书签，应该调用什么？**

```typescript
// ✅ 正确
await chrome.bookmarks.update(id, { title: 'New Title' })
// Background 会自动同步到 IndexedDB，并广播更新

// ❌ 错误
await indexedDBManager.updateBookmark(id, { title: 'New Title' })
// 不要直接写 IndexedDB！
```

**Q: Store 应该包含什么逻辑？**

```typescript
// ✅ 正确：只管理 UI 状态
const isLoading = ref(false)
const selectedIds = ref([])

// ❌ 错误：包含复杂业务逻辑
function compareAndDiff(tree1, tree2) {
  // 复杂的树比对算法 ← 应该在 core/ 层
}
```

---

## 🎉 总结

### 核心优势

1. **清晰的职责分离** - 每一层都有明确的职责
2. **单向数据流** - 数据流向可预测，易于调试
3. **高内聚低耦合** - 模块间依赖清晰，易于维护
4. **可测试性强** - Core 层可独立测试
5. **易于扩展** - 新增功能遵循既定模式

### 关键原则（再次强调）

```

```
