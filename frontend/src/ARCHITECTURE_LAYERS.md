# 前端项目中间层架构总览

## 📊 项目共有 **8 个中间层**

根据 DDD 分层架构和项目实际情况，前端项目包含以下 8 个中间层：

---

## 🏗️ 标准 DDD 四层架构

### 1. **Presentation Layer（展示层）**

**路径**: `frontend/src/presentation/`

**定位**：

- UI 组件和应用服务层之间的桥梁
- 隔离组件对基础设施层的直接访问
- 提供 UI 友好的接口

**职责**：

- ✅ 封装适配器（Adapters）：将应用层接口转换为 UI 友好接口
- ✅ 提供 Composables：响应式状态管理和数据获取
- ✅ 统一错误处理和用户反馈
- ✅ 数据格式转换（UI 格式）

**包含**：

```
presentation/
├── adapters/          # 适配器
│   ├── bookmark-adapter.ts
│   └── notification-adapter.ts
├── composables/       # 组合式函数（Presentation 专用）
│   ├── useBookmarkData.ts
│   └── useNotification.ts
└── index.ts
```

**依赖关系**：

- ✅ 可依赖：`application/`（应用服务层）
- ❌ 禁止依赖：`infrastructure/`（基础设施层）
- ❌ 禁止依赖：`core/`（核心领域层）

**使用示例**：

```typescript
// ✅ 正确：通过适配器访问
import { bookmarkPresentationAdapter } from '@/presentation'
const result = await bookmarkPresentationAdapter.getBookmarks()
```

---

### 2. **Application Layer（应用服务层）**

**路径**: `frontend/src/application/`

**定位**：

- 应用业务逻辑的协调层
- 封装领域层的能力，提供应用级服务
- 处理业务流程编排

**职责**：

- ✅ 业务流程编排（协调多个领域服务）
- ✅ 事务管理
- ✅ 应用级错误处理
- ✅ 权限验证
- ✅ 数据校验和转换

**包含**：

```
application/
├── auth/              # 认证服务
├── bookmark/          # 书签应用服务
├── cleanup/           # 清理服务
├── font/              # 字体服务
├── health/            # 健康检查服务
├── notification/      # 通知服务
├── query/             # 查询服务
├── scheduler/         # 调度服务
└── settings/          # 设置服务
```

**依赖关系**：

- ✅ 可依赖：`core/`（核心领域层）
- ✅ 可依赖：`infrastructure/`（基础设施层）
- ❌ 禁止依赖：`presentation/`（展示层）

**使用示例**：

```typescript
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
const result = await bookmarkAppService.getAllBookmarks()
```

---

### 3. **Core Layer（核心领域层）**

**路径**: `frontend/src/core/`

**定位**：

- 领域模型和业务规则
- 不依赖任何外部技术实现
- 纯业务逻辑，可独立测试

**职责**：

- ✅ 领域模型定义
- ✅ 业务规则实现
- ✅ 领域服务（如 Diff 引擎、执行器）
- ✅ 仓储接口定义

**包含**：

```
core/
├── bookmark/          # 书签领域
│   ├── domain/        # 领域模型
│   ├── repositories/  # 仓储接口
│   └── services/      # 领域服务（diff-engine, executor等）
├── query-engine/      # 查询引擎
├── filter/            # 筛选器
└── common/            # 通用工具（Result, Logger接口）
```

**依赖关系**：

- ✅ 可依赖：无（完全独立，不依赖任何层）
- ❌ 禁止依赖：`infrastructure/`（通过接口解耦，如 `ILogger`）
- ❌ 禁止依赖：`application/`（应用层依赖核心层，反之不行）

**核心原则**：

```typescript
// ✅ 正确：使用接口，不依赖具体实现
import type { ILogger } from '@/core/common/logger'
import { noopLogger } from '@/core/common/logger'

class QueryCache {
  constructor(private logger: ILogger = noopLogger) {}
}
```

---

### 4. **Infrastructure Layer（基础设施层）**

**路径**: `frontend/src/infrastructure/`

**定位**：

- 技术实现细节
- 与外部系统交互（Chrome API、IndexedDB、HTTP）
- 提供技术能力给上层使用

**职责**：

- ✅ IndexedDB 管理（唯一数据源）
- ✅ HTTP 客户端
- ✅ 日志系统（实现 `ILogger`）
- ✅ 事件系统
- ✅ Chrome Storage 封装
- ✅ Chrome API 封装

**包含**：

```
infrastructure/
├── indexeddb/         # IndexedDB 管理器（唯一入口）
├── http/              # HTTP 客户端
├── logging/           # 日志系统（实现 ILogger）
├── events/            # 事件总线
├── storage/           # Chrome Storage
├── chrome-api/        # Chrome API 封装
└── i18n/              # 国际化
```

**依赖关系**：

- ✅ 可依赖：`core/`（实现核心层定义的接口）
- ❌ 禁止依赖：`application/`（应用层依赖基础设施层）
- ❌ 禁止依赖：`presentation/`（展示层依赖基础设施层）

**核心原则**：

```typescript
// ✅ 正确：所有 IndexedDB 操作必须通过 manager
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
const bookmarks = await indexedDBManager.getAllBookmarks()

// ❌ 错误：禁止直接使用原生 API
const db = indexedDB.open('AcuityBookmarks', 9) // 错误！
```

---

## 🔄 特殊层（非标准 DDD，但存在于项目中）

### 5. **Services Layer（服务层 - 遗留）**

**路径**: `frontend/src/services/`

**定位**：

- ⚠️ **遗留层，正在迁移到 Application 层**
- Background Script 和 Worker 专用服务
- 某些通用服务（如爬虫、健康扫描）

**职责**：

- ✅ Background Script 专用服务（如 `background-crawler-client.ts`）
- ✅ Worker 专用服务（如 `health-scan-worker-service.ts`）
- ⚠️ 部分应迁移到 `application/` 的服务（如 `bookmark-sync-service.ts`）

**包含**：

```
services/
├── background-crawler-client.ts    # Background Script 专用
├── health-scan-worker-service.ts    # Worker 专用
├── bookmark-sync-service.ts         # ⚠️ 应迁移到 application/
├── bookmark-health-service.ts       # ⚠️ 应迁移到 application/
└── smart-recommendation-engine.ts   # ⚠️ 应迁移到 application/
```

**迁移计划**：

- ✅ `services/` → 仅保留 Background Script 和 Worker 专用服务
- ⏳ 其他服务 → 迁移到 `application/` 对应目录

**依赖关系**：

- ✅ 可依赖：`infrastructure/`、`core/`
- ✅ 可被：`application/`、`background/` 依赖

---

### 6. **Stores Layer（状态管理层）**

**路径**: `frontend/src/stores/`

**定位**：

- Pinia 状态管理
- UI 状态和轻量缓存
- 属于 Presentation 层的一部分

**职责**：

- ✅ 响应式状态管理
- ✅ UI 状态缓存（如展开状态、选中状态）
- ✅ 计算属性
- ✅ 调用应用服务获取数据

**包含**：

```
stores/
├── bookmark/          # 书签状态管理
├── query-store/       # 查询状态
├── cleanup/           # 清理状态
└── ui/                # UI 状态
```

**依赖关系**：

- ✅ 可依赖：`application/`（应用服务层）
- ❌ 禁止依赖：`infrastructure/`（禁止直接访问）
- ❌ 禁止依赖：`core/`（禁止直接访问）

**使用示例**：

```typescript
// ✅ 正确：Store 调用应用服务
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'

export const useBookmarkStore = defineStore('bookmark', () => {
  const bookmarks = ref([])

  const loadBookmarks = async () => {
    const result = await bookmarkAppService.getAllBookmarks()
    if (result.ok) {
      bookmarks.value = result.value
    }
  }

  return { bookmarks, loadBookmarks }
})
```

---

### 7. **Composables Layer（组合式函数层 - 全局）**

**路径**: `frontend/src/composables/`

**定位**：

- Vue 3 组合式函数（全局）
- 与 `presentation/composables/` 的区别：这里是全局的通用 composables
- 提供可复用的 UI 逻辑

**职责**：

- ✅ 键盘快捷键处理
- ✅ 搜索功能封装
- ✅ 性能监控
- ✅ 爬虫功能封装

**包含**：

```
composables/
├── useKeyboard.ts              # 键盘快捷键
├── useBookmarkSearch.ts        # 书签搜索
├── useBookmarkQueries.ts       # 书签查询
├── useCrawler.ts              # 爬虫功能
├── useGlobalSyncProgress.ts   # 全局同步进度
└── useSimplePerformance.ts    # 性能监控
```

**依赖关系**：

- ✅ 可依赖：`application/`、`stores/`、`presentation/`
- ⚠️ 部分可直接依赖 `infrastructure/`（如 `useKeyboard` 监听事件）

**与 `presentation/composables/` 的区别**：

- `composables/`：全局通用 composables（键盘、搜索等）
- `presentation/composables/`：Presentation 层专用 composables（通过适配器访问服务）

---

### 8. **Background Layer（后台脚本层）**

**路径**: `frontend/src/background/`

**定位**：

- Chrome Extension Background Script
- Service Worker 环境
- 监听 Chrome API 事件

**职责**：

- ✅ 监听 Chrome Bookmarks API
- ✅ 监听 Chrome Runtime Messages
- ✅ 数据同步（Chrome API → IndexedDB）
- ✅ 消息路由

**包含**：

```
background/
├── bookmarks.ts          # Chrome Bookmarks 监听
├── messaging.ts          # 消息路由
├── bootstrap.ts          # 初始化
├── crawler-manager.ts    # 爬虫管理
└── data-health-check.ts  # 数据健康检查
```

**核心原则**：

```
Chrome API → Background Script → IndexedDB → Pinia Store → UI
     ↑                                                           ↓
     └─────────────── chrome.runtime.sendMessage ────────────────┘
```

**依赖关系**：

- ✅ 可依赖：`infrastructure/`（IndexedDB、Logger）
- ✅ 可依赖：`services/`（Background Script 专用服务）
- ✅ 可依赖：`core/`（领域逻辑）
- ❌ 禁止依赖：`presentation/`、`application/`（Background Script 是数据源，不是消费者）

**Service Worker 兼容性**：

```typescript
// ✅ 正确：Service Worker 环境
const timer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 1000)

// ❌ 错误：不存在 window
window.setTimeout(() => {}, 1000) // 错误！
```

---

## 📐 完整的依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│              UI Components (Vue Components)            │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer                                    │
│  ├── adapters/                                          │
│  └── composables/                                       │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Stores Layer (Pinia)                                  │
│  └── bookmark-store.ts                                  │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Application Layer                                      │
│  ├── bookmark-app-service.ts                            │
│  ├── query-app-service.ts                               │
│  └── notification-service.ts                            │
└────────────────────┬────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│  Core Layer      │      │  Infrastructure  │
│  ├── domain/     │      │  ├── indexeddb/ │
│  ├── services/   │      │  ├── logging/   │
│  └── repositories│      │  └── http/       │
└──────────────────┘      └──────────────────┘
        │                           │
        └─────────────┬─────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Background Layer (Service Worker)                     │
│  ├── bookmarks.ts (监听 Chrome API)                     │
│  └── messaging.ts (消息路由)                           │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
                Chrome API
```

---

## 🎯 各层职责对比表

| 层                 | 路径              | 职责                              | 可依赖的层                              | 禁止依赖的层                    |
| ------------------ | ----------------- | --------------------------------- | --------------------------------------- | ------------------------------- |
| **Presentation**   | `presentation/`   | UI 适配器、Composables            | `application/`                          | `infrastructure/`, `core/`      |
| **Application**    | `application/`    | 业务流程编排                      | `core/`, `infrastructure/`              | `presentation/`                 |
| **Core**           | `core/`           | 领域模型、业务规则                | 无（完全独立）                          | 所有层                          |
| **Infrastructure** | `infrastructure/` | 技术实现（IndexedDB、HTTP）       | `core/`（实现接口）                     | `application/`, `presentation/` |
| **Services**       | `services/`       | Background Script/Worker 专用服务 | `infrastructure/`, `core/`              | `presentation/`                 |
| **Stores**         | `stores/`         | Pinia 状态管理                    | `application/`                          | `infrastructure/`, `core/`      |
| **Composables**    | `composables/`    | 全局组合式函数                    | `application/`, `stores/`               | -                               |
| **Background**     | `background/`     | Chrome API 监听、数据同步         | `infrastructure/`, `services/`, `core/` | `presentation/`, `application/` |

---

## 🔍 关键原则总结

### 1. **单向数据流**

```
Chrome API → Background → IndexedDB → Store → UI
```

### 2. **分层依赖原则**

- ✅ **上层可以依赖下层**
- ❌ **下层不能依赖上层**
- ✅ **Core 层完全独立**（不依赖任何层）

### 3. **禁止跨层访问**

- ❌ Presentation 不能直接访问 Infrastructure
- ❌ Presentation 不能直接访问 Core
- ✅ Presentation 必须通过 Application 访问业务逻辑

### 4. **IndexedDB 是唯一数据源**

- ✅ 所有数据来自 IndexedDB（通过 Infrastructure）
- ✅ Background Script 是唯一监听 Chrome API 的地方
- ❌ 前端禁止直接调用 `chrome.bookmarks.*`

### 5. **接口解耦**

- ✅ Core 层定义接口（如 `ILogger`）
- ✅ Infrastructure 层实现接口（如 `logger`）
- ✅ 通过依赖注入使用接口

---

## 📚 相关文档

- [Presentation 层说明](./presentation/README.md)
- [Infrastructure 层说明](./infrastructure/README.md)
- [Stores 层说明](./stores/README.md)
- [Services 迁移计划](./services/MIGRATION_PLAN.md)
- [项目架构规范](../../../文档/项目管理/架构规范-快速开始.md)

---

**最后更新**: 2025-10-27  
**架构评分**: ⭐⭐⭐⭐⭐ (5/5)
