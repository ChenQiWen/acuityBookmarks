# 🔄 Utils 目录重构迁移指南

## 📋 迁移概览

本次重构将 `frontend/src/utils/` 目录重新组织为分层架构，提高代码的可维护性和可测试性。

## 🗂️ 新目录结构

```
frontend/src/
├── core/                    # 核心业务逻辑（不依赖框架）
│   ├── bookmark/
│   │   ├── domain/         # 领域模型
│   │   ├── services/       # 领域服务
│   │   └── repositories/   # 数据访问
│   └── common/             # 通用类型和工具
├── infrastructure/          # 基础设施层
│   ├── indexeddb/          # 数据库相关
│   ├── chrome-api/         # Chrome扩展API
│   ├── http/               # HTTP客户端
│   ├── logging/            # 日志系统
│   └── events/             # 事件处理
├── application/            # 应用服务层
│   ├── auth/               # 认证服务
│   ├── notification/       # 通知服务
│   ├── font/               # 字体服务
│   └── scheduler/          # 任务调度
├── presentation/           # 表现层
│   ├── ui/                 # UI组件
│   └── stores/             # 状态管理
├── utils/                  # 纯工具函数（保留）
└── types/                  # 类型定义
```

## 📦 文件迁移映射

### 核心业务逻辑 (core/)

| 原路径                         | 新路径                                               | 说明           |
| ------------------------------ | ---------------------------------------------------- | -------------- |
| `utils/cleanup-scanner.ts`     | `core/bookmark/services/cleanup-scanner.ts`          | 书签清理扫描器 |
| `utils/bookmark-converters.ts` | `core/bookmark/services/bookmark-converter.ts`       | 书签转换器     |
| `utils/indexeddb-manager.ts`   | `core/bookmark/repositories/indexeddb-repository.ts` | 书签数据仓库   |
| `utils/indexeddb-schema.ts`    | `infrastructure/indexeddb/schema.ts`                 | 数据库模式     |

### 基础设施 (infrastructure/)

| 原路径                     | 新路径                                        | 说明           |
| -------------------------- | --------------------------------------------- | -------------- |
| `utils/api-client.ts`      | `infrastructure/http/api-client.ts`           | HTTP客户端     |
| `utils/message.ts`         | `infrastructure/chrome-api/message-client.ts` | Chrome消息通信 |
| `utils/logger.ts`          | `infrastructure/logging/logger.ts`            | 日志系统       |
| `utils/error-handling.ts`  | `infrastructure/logging/error-handler.ts`     | 错误处理       |
| `utils/safe-json-fetch.ts` | `infrastructure/http/safe-fetch.ts`           | 安全请求       |
| `utils/eventStream.ts`     | `infrastructure/events/event-stream.ts`       | 事件流处理     |

### 应用服务 (application/)

| 原路径                        | 新路径                                             | 说明     |
| ----------------------------- | -------------------------------------------------- | -------- |
| `utils/auth-gate.ts`          | `application/auth/auth-service.ts`                 | 认证服务 |
| `utils/notifications.ts`      | `application/notification/notification-service.ts` | 通知服务 |
| `utils/smart-font-manager.ts` | `application/font/font-service.ts`                 | 字体服务 |
| `utils/scheduler.ts`          | `application/scheduler/scheduler-service.ts`       | 任务调度 |

### 表现层 (presentation/)

| 原路径                       | 新路径                             | 说明      |
| ---------------------------- | ---------------------------------- | --------- |
| `utils/toastbar.ts`          | `presentation/ui/toast-manager.ts` | Toast管理 |
| `utils/dynamic-font-link.ts` | `presentation/ui/font-loader.ts`   | 字体加载  |

### 保留在 utils/

| 原路径          | 新路径          | 说明                 |
| --------------- | --------------- | -------------------- |
| `utils/i18n.ts` | `utils/i18n.ts` | 国际化工具（纯函数） |

## 🔄 Import 路径更新

### 1. 核心层导入

```typescript
// 旧导入
import { CleanupScanner } from '@/utils/cleanup-scanner'
import { BookmarkConverter } from '@/utils/bookmark-converters'
import { IndexedDBManager } from '@/utils/indexeddb-manager'

// 新导入
import { CleanupScanner } from '@/core/bookmark/services/cleanup-scanner'
import { BookmarkConverter } from '@/core/bookmark/services/bookmark-converter'
import { IndexedDBBookmarkRepository } from '@/core/bookmark/repositories/indexeddb-repository'

// 或者使用统一导出
import {
  CleanupScanner,
  BookmarkConverter,
  IndexedDBBookmarkRepository
} from '@/core'
```

### 2. 基础设施层导入

```typescript
// 旧导入
import { apiClient } from '@/utils/api-client'
import { sendMessageToBackend } from '@/utils/message'
import { logger } from '@/utils/logger'
import { AppError } from '@/utils/error-handling'

// 新导入
import { apiClient } from '@/infrastructure/http/api-client'
import { messageClient } from '@/infrastructure/chrome-api/message-client'
import { logger } from '@/infrastructure/logging/logger'
import { AppError } from '@/infrastructure/logging/error-handler'

// 或者使用统一导出
import { apiClient, messageClient, logger, AppError } from '@/infrastructure'
```

### 3. 应用服务层导入

```typescript
// 旧导入
import { getEntitlement } from '@/utils/auth-gate'
import { notify } from '@/utils/notifications'
import { smartFontManager } from '@/utils/smart-font-manager'
import { scheduleUIUpdate } from '@/utils/scheduler'

// 新导入
import { authService } from '@/application/auth/auth-service'
import { notificationService } from '@/application/notification/notification-service'
import { fontService } from '@/application/font/font-service'
import { schedulerService } from '@/application/scheduler/scheduler-service'

// 或者使用统一导出
import {
  authService,
  notificationService,
  fontService,
  schedulerService
} from '@/application'
```

### 4. 便捷函数导入（保持向后兼容）

```typescript
// 这些函数仍然可用，但建议使用新的服务类
import { getEntitlement, notify, scheduleUIUpdate } from '@/application'
```

## 🛠️ 代码迁移步骤

### 步骤 1: 更新导入路径

1. 搜索所有使用旧路径的文件
2. 批量替换导入路径
3. 验证导入是否正确

### 步骤 2: 更新函数调用

```typescript
// 旧方式
const result = await getEntitlement()
notify('操作成功', { level: 'success' })

// 新方式（推荐）
const result = await authService.getEntitlement()
await notificationService.notifySuccess('操作成功')

// 或者继续使用便捷函数（向后兼容）
const result = await getEntitlement()
notify('操作成功', { level: 'success' })
```

### 步骤 3: 更新类型导入

```typescript
// 旧导入
import type { BookmarkNode } from '@/types'
import type { CleanupProblem } from '@/types/cleanup'

// 新导入
import type { BookmarkNode } from '@/core/bookmark/domain/bookmark'
import type { CleanupProblem } from '@/core/bookmark/domain/cleanup-problem'

// 或者使用统一导出
import type { BookmarkNode, CleanupProblem } from '@/core'
```

## ⚠️ 注意事项

### 1. 向后兼容性

- 所有便捷函数仍然可用
- 旧的导入路径会逐步废弃
- 建议尽快迁移到新的服务类

### 2. 类型安全

- 新的服务类使用 `Result<T, E>` 模式
- 提供更好的错误处理
- 支持链式调用

### 3. 性能优化

- 新的架构支持依赖注入
- 更好的测试隔离
- 减少循环依赖

## 🧪 测试迁移

### 1. 单元测试

```typescript
// 旧测试
import { CleanupScanner } from '@/utils/cleanup-scanner'

// 新测试
import { CleanupScanner } from '@/core/bookmark/services/cleanup-scanner'
```

### 2. 集成测试

- 更新测试中的导入路径
- 验证服务间的依赖关系
- 确保错误处理正确

## 📊 迁移检查清单

- [ ] 更新所有导入路径
- [ ] 验证类型定义正确
- [ ] 更新测试文件
- [ ] 检查构建是否成功
- [ ] 运行所有测试
- [ ] 验证功能正常
- [ ] 更新文档

## 🚀 迁移工具

可以使用以下命令批量替换导入路径：

```bash
# 替换核心层导入
find src -name "*.ts" -o -name "*.vue" | xargs sed -i 's|@/utils/cleanup-scanner|@/core/bookmark/services/cleanup-scanner|g'

# 替换基础设施层导入
find src -name "*.ts" -o -name "*.vue" | xargs sed -i 's|@/utils/api-client|@/infrastructure/http/api-client|g'

# 替换应用服务层导入
find src -name "*.ts" -o -name "*.vue" | xargs sed -i 's|@/utils/auth-gate|@/application/auth/auth-service|g'
```

## 📞 支持

如果在迁移过程中遇到问题，请：

1. 查看本文档的常见问题部分
2. 检查新的服务类文档
3. 联系开发团队获取支持

---

**注意**: 这是一个渐进式迁移，旧的代码仍然可以工作，但建议尽快迁移到新的架构以获得更好的维护性和可测试性。
