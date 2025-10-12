# 🏗️ AcuityBookmarks 分层架构标准

## 📋 概述

AcuityBookmarks 项目采用经典的分层架构设计，将复杂的浏览器扩展逻辑组织为清晰、职责单一的层次。这种架构提高了代码的可维护性、可测试性和可扩展性。

## 🎯 架构目标

- **清晰的职责分离**：每个层级都有明确的职责边界
- **依赖方向控制**：严格的上层依赖下层，下层不依赖上层
- **高内聚低耦合**：同一层级的模块高度相关，不同层级松散耦合
- **易于测试**：业务逻辑与框架解耦，便于单元测试
- **便于扩展**：新功能可以按层添加，影响范围可控

## 🏛️ 分层结构

```
┌─────────────────────────────────────────────────────────────┐
│                    🎨 Presentation Layer                    │
│                    (UI Components & Stores)                 │
├─────────────────────────────────────────────────────────────┤
│                    🔧 Application Layer                     │
│               (Use Cases & Application Services)           │
├─────────────────────────────────────────────────────────────┤
│                    🏭 Domain Layer                          │
│              (Business Logic & Domain Services)             │
├─────────────────────────────────────────────────────────────┤
│                    🏗️ Infrastructure Layer                  │
│         (External Services & Technical Details)             │
└─────────────────────────────────────────────────────────────┘
```

### 1. 🎨 表示层 (Presentation Layer)

**位置**: `src/components/`, `src/stores/`, `src/views/`

**职责**:

- 用户界面展示和交互
- 状态管理和用户操作响应
- 路由和导航管理

**依赖关系**:

- 可以依赖应用层和领域层
- 不应直接依赖基础设施层

**示例文件**:

```
src/components/
├── ui/                    # 通用UI组件
├── management/            # 管理页面组件
└── popup/                 # 弹窗组件

src/stores/                # Pinia状态管理
src/views/                 # 页面级组件
```

### 2. 🔧 应用层 (Application Layer)

**位置**: `src/application/`

**职责**:

- 编排领域服务完成业务用例
- 协调多个领域对象的工作
- 处理跨领域的业务规则
- 提供高层API供表示层调用

**依赖关系**:

- 可以依赖领域层和基础设施层
- 不应直接操作外部资源

**示例文件**:

```
src/application/
├── auth/                  # 认证服务
├── bookmark/              # 书签应用服务
├── search/                # 搜索应用服务
├── notification/          # 通知服务
└── font/                  # 字体服务
```

### 3. 🏭 领域层 (Domain Layer)

**位置**: `src/core/`

**职责**:

- 核心业务逻辑和规则
- 领域模型和业务实体
- 不依赖任何外部框架或库
- 纯业务逻辑，无技术细节

**依赖关系**:

- 只依赖其他领域模块
- 不依赖应用层或基础设施层

**示例文件**:

```
src/core/
├── bookmark/              # 书签领域
│   ├── domain/           # 领域模型
│   ├── services/         # 领域服务
│   └── repositories/     # 仓储接口
├── search/                # 搜索领域
└── common/               # 通用领域工具
```

### 4. 🏗️ 基础设施层 (Infrastructure Layer)

**位置**: `src/infrastructure/`

**职责**:

- 外部资源访问（数据库、网络、文件系统等）
- 框架和库的适配
- 技术细节的实现
- 第三方服务的集成

**依赖关系**:

- 可以依赖领域层（仓储实现）
- 不被其他层依赖

**示例文件**:

```
src/infrastructure/
├── indexeddb/            # IndexedDB实现
├── http/                 # HTTP客户端
├── logging/              # 日志系统
├── events/               # 事件系统
└── chrome-api/           # Chrome扩展API封装
```

## 📁 目录结构规范

### 文件组织原则

1. **按功能域组织**：相关功能放在同一目录下
2. **单一职责**：每个文件专注一个职责
3. **清晰命名**：文件名应反映其用途
4. **合理拆分**：大文件应拆分为多个小文件

### 标准文件结构

每个功能模块的标准结构：

```
module-name/
├── domain/               # 领域模型和类型定义
│   ├── entity.ts        # 实体定义
│   ├── value-object.ts  # 值对象
│   └── events.ts        # 领域事件
├── services/            # 领域服务和业务逻辑
│   ├── domain-service.ts
│   └── business-rule.ts
├── repositories/        # 数据访问接口和实现
│   ├── interface.ts     # 仓储接口
│   └── implementation.ts # 仓储实现
└── index.ts             # 模块统一导出
```

## 🔗 依赖关系规则

### ✅ 允许的依赖

```
🎨 表示层 → 🔧 应用层 → 🏭 领域层 → 🏗️ 基础设施层
```

### ❌ 禁止的依赖

```
🏗️ 基础设施层 ↛ 🔧 应用层
🏭 领域层 ↛ 🎨 表示层
🏗️ 基础设施层 ↛ 🎨 表示层（直接依赖）
```

### 依赖注入原则

- 高层模块不应依赖低层模块的具体实现
- 通过依赖注入或抽象接口实现解耦
- 优先使用构造函数注入或工厂模式

## 🧪 测试策略

### 分层测试

1. **领域层测试**：纯单元测试，测试业务逻辑
2. **应用层测试**：集成测试，测试用例编排
3. **基础设施层测试**：集成测试，测试外部资源访问
4. **表示层测试**：组件测试和E2E测试

### 测试数据流

```
测试数据 → 模拟层 → 业务逻辑 → 断言结果
```

## 🚀 新功能开发流程

### 1. 需求分析

- 确定功能所属的层级
- 识别依赖关系
- 设计接口契约

### 2. 领域建模

- 定义领域实体和值对象
- 建立业务规则和不变量
- 设计仓储接口

### 3. 基础设施实现

- 实现仓储的具体细节
- 集成外部服务和API
- 处理技术异常

### 4. 应用服务编排

- 实现业务用例
- 协调领域服务
- 处理应用级异常

### 5. 表示层集成

- 设计用户界面
- 连接应用服务
- 处理用户交互

## 📋 代码规范

### 文件命名

- **类和接口**: PascalCase（`UserService`）
- **函数和方法**: camelCase（`getUserById`）
- **常量**: SCREAMING_SNAKE_CASE（`API_BASE_URL`）
- **文件**: kebab-case（`user-service.ts`）

### 导入顺序

```typescript
// 1. 外部库
import { ref } from 'vue'

// 2. 项目内部模块（按层级顺序）
import { UserService } from '@/application/user/user-service'
import { User } from '@/core/user/domain/user'
import { logger } from '@/infrastructure/logging/logger'

// 3. 类型定义
import type { UserDto } from '@/types'

// 4. 相对路径导入
import { helper } from '../utils/helper'
```

### 错误处理

- 使用 `Result<T, E>` 模式替代异常抛出
- 在应用层捕获和转换基础设施层的异常
- 提供用户友好的错误消息
- 支持错误恢复和重试机制

## 🎯 最佳实践

### 1. 保持函数纯净

```typescript
// ✅ 好：纯函数，便于测试
export function calculateScore(bookmark: Bookmark): number {
  return bookmark.title.length + bookmark.url.length
}

// ❌ 坏：副作用，难以测试
export function saveBookmark(bookmark: Bookmark): void {
  // 副作用：写入数据库
  database.save(bookmark)
}
```

### 2. 使用依赖注入

```typescript
// ✅ 好：依赖注入，便于测试
export class BookmarkService {
  constructor(private repository: BookmarkRepository) {}

  async getBookmarks(): Promise<Bookmark[]> {
    return this.repository.findAll()
  }
}

// ❌ 坏：硬编码依赖，难以测试
export class BookmarkService {
  async getBookmarks(): Promise<Bookmark[]> {
    const repo = new IndexedDBBookmarkRepository()
    return repo.findAll()
  }
}
```

### 3. 单一职责原则

```typescript
// ✅ 好：单一职责
export class BookmarkValidator {
  validate(bookmark: Bookmark): ValidationResult {
    // 只负责验证逻辑
  }
}

export class BookmarkPersister {
  save(bookmark: Bookmark): Promise<void> {
    // 只负责持久化逻辑
  }
}

// ❌ 坏：多个职责
export class BookmarkManager {
  validate(bookmark: Bookmark): ValidationResult {
    // 验证逻辑
  }

  save(bookmark: Bookmark): Promise<void> {
    // 持久化逻辑
  }

  search(query: string): Promise<Bookmark[]> {
    // 搜索逻辑
  }
}
```

## 🔄 演进策略

### 渐进式重构

1. **新功能优先**：新功能严格按照分层架构开发
2. **旧代码迁移**：逐步将旧代码迁移到新架构
3. **接口保持**：保持公共API的向后兼容
4. **测试覆盖**：确保迁移过程中测试覆盖不降低

### 架构守护

- 定期审查依赖关系图
- 监控架构退化迹象
- 及时修复违反架构原则的代码
- 持续改进架构文档

## 📚 相关文档

- [重构计划](./REFACTOR_PLAN.md)
- [迁移指南](./REFACTOR_MIGRATION_GUIDE.md)
- [重构总结](./REFACTOR_SUMMARY.md)

---

_本架构文档旨在建立长期的代码组织标准，确保项目的技术债务可控，开发效率持续提升。_
