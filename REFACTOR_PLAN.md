# 🔄 Utils 目录重构计划

## 📊 当前问题分析

### 当前 utils 目录问题

- **职责混乱**: 24个文件混合了业务逻辑、基础设施、工具函数
- **边界不清**: 工具层、服务层、API层界限模糊
- **难以维护**: 新人难以理解代码组织
- **测试困难**: 依赖关系复杂

### 文件职责分析

#### 核心业务逻辑 (应移至 core/)

- `cleanup-scanner.ts` - 书签清理扫描器 (1473行)
- `bookmark-converters.ts` - 书签数据转换器
- `indexeddb-manager.ts` - 书签数据管理器 (1558行)
- `indexeddb-schema.ts` - 数据库模式定义

#### 基础设施 (应移至 infrastructure/)

- `api-client.ts` - HTTP客户端
- `message.ts` - Chrome扩展消息通信
- `logger.ts` - 日志系统
- `error-handling.ts` - 错误处理
- `safe-json-fetch.ts` - 安全JSON请求
- `eventStream.ts` - 事件流处理

#### 应用服务 (应移至 application/)

- `auth-gate.ts` - 认证门控
- `notifications.ts` - 通知服务
- `scheduler.ts` - 任务调度器
- `smart-font-manager.ts` - 智能字体管理

#### 表现层 (应移至 presentation/)

- `toastbar.ts` - Toast提示管理
- `dynamic-font-link.ts` - 动态字体加载

#### 纯工具函数 (保留在 utils/)

- `i18n.ts` - 国际化工具

## 🎯 新架构设计

```
frontend/src/
├── core/                    # 核心业务逻辑（不依赖框架）
│   ├── bookmark/
│   │   ├── domain/         # 领域模型
│   │   │   ├── bookmark.ts
│   │   │   ├── folder.ts
│   │   │   └── cleanup-problem.ts
│   │   ├── services/       # 领域服务
│   │   │   ├── bookmark-service.ts
│   │   │   ├── cleanup-scanner.ts
│   │   │   └── bookmark-converter.ts
│   │   └── repositories/   # 数据访问
│   │       ├── bookmark-repository.ts
│   │       └── indexeddb-repository.ts
│   └── common/
│       ├── result.ts       # Result类型
│       └── types.ts        # 通用类型
├── infrastructure/          # 基础设施层
│   ├── indexeddb/
│   │   ├── connection-pool.ts
│   │   ├── transaction-manager.ts
│   │   ├── schema.ts
│   │   └── manager.ts
│   ├── chrome-api/
│   │   ├── message-client.ts
│   │   └── chrome-wrapper.ts
│   ├── http/
│   │   ├── api-client.ts
│   │   └── safe-fetch.ts
│   ├── logging/
│   │   └── logger.ts
│   └── events/
│       └── event-stream.ts
├── application/            # 应用服务层
│   ├── auth/
│   │   └── auth-service.ts
│   ├── notification/
│   │   └── notification-service.ts
│   ├── font/
│   │   └── font-service.ts
│   └── scheduler/
│       └── scheduler-service.ts
├── presentation/           # 表现层
│   ├── ui/
│   │   ├── toast-manager.ts
│   │   └── font-loader.ts
│   └── stores/            # 只负责UI状态
├── utils/                 # 纯工具函数（无状态）
│   ├── i18n.ts
│   ├── validators.ts
│   └── formatters.ts
└── types/                 # 类型定义
    ├── bookmark.ts
    ├── cleanup.ts
    └── index.ts
```

## 📋 迁移计划

### 第一阶段：创建新目录结构

1. 创建所有新目录
2. 定义核心类型和接口

### 第二阶段：迁移核心业务逻辑

1. 迁移 `cleanup-scanner.ts` → `core/bookmark/services/cleanup-scanner.ts`
2. 迁移 `bookmark-converters.ts` → `core/bookmark/services/bookmark-converter.ts`
3. 迁移 `indexeddb-manager.ts` → `core/bookmark/repositories/indexeddb-repository.ts`
4. 迁移 `indexeddb-schema.ts` → `infrastructure/indexeddb/schema.ts`

### 第三阶段：迁移基础设施

1. 迁移 `api-client.ts` → `infrastructure/http/api-client.ts`
2. 迁移 `message.ts` → `infrastructure/chrome-api/message-client.ts`
3. 迁移 `logger.ts` → `infrastructure/logging/logger.ts`
4. 迁移 `error-handling.ts` → `infrastructure/logging/error-handler.ts`
5. 迁移 `safe-json-fetch.ts` → `infrastructure/http/safe-fetch.ts`
6. 迁移 `eventStream.ts` → `infrastructure/events/event-stream.ts`

### 第四阶段：迁移应用服务

1. 迁移 `auth-gate.ts` → `application/auth/auth-service.ts`
2. 迁移 `notifications.ts` → `application/notification/notification-service.ts`
3. 迁移 `scheduler.ts` → `application/scheduler/scheduler-service.ts`
4. 迁移 `smart-font-manager.ts` → `application/font/font-service.ts`

### 第五阶段：迁移表现层

1. 迁移 `toastbar.ts` → `presentation/ui/toast-manager.ts`
2. 迁移 `dynamic-font-link.ts` → `presentation/ui/font-loader.ts`

### 第六阶段：更新导入路径

1. 更新所有文件的 import 路径
2. 更新 Store 中的依赖
3. 更新组件中的依赖

### 第七阶段：验证和测试

1. 验证所有功能正常
2. 运行测试确保无破坏性变更
3. 更新文档

## 🎯 重构收益

### 可维护性提升

- ✅ 清晰的职责边界
- ✅ 新人容易理解代码组织
- ✅ 修改影响范围明确

### 可测试性提升

- ✅ 业务逻辑独立，易于单元测试
- ✅ 依赖关系清晰，易于 mock
- ✅ 分层测试策略

### 开发效率提升

- ✅ 减少重复代码
- ✅ 代码搜索更容易
- ✅ 功能扩展更简单

## ⚠️ 风险控制

### 重构风险

- **中等风险**: 需要大量 import 路径更新
- **测试覆盖**: 当前缺乏测试，需要补充
- **时间成本**: 预计 2-3 周完成

### 缓解措施

1. **分阶段进行**: 逐步迁移，降低风险
2. **保持兼容**: 临时保留旧路径，逐步切换
3. **充分测试**: 每个阶段完成后进行验证
4. **文档更新**: 及时更新相关文档

## 📅 时间计划

- **Week 1**: 创建新结构 + 迁移核心业务逻辑
- **Week 2**: 迁移基础设施 + 应用服务
- **Week 3**: 迁移表现层 + 更新导入路径 + 验证测试

总计：3周完成重构
