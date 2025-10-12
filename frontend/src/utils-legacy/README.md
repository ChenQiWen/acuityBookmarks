# ⚠️ IndexedDB 遗留模块 (Utils-Legacy)

## 📋 说明

这个目录**仅包含IndexedDB相关的遗留代码**。所有其他工具代码已成功迁移到新的分层架构。

**当前保留原因**：

- IndexedDB模块规模大（2000+行代码）
- 涉及复杂的数据库操作和迁移逻辑
- 通过 `infrastructure/indexeddb/manager.ts` 实现了良好的桥接隔离
- 不影响其他模块使用

## 📊 迁移完成状态

### ✅ 已成功迁移（9个文件）

| 原文件                   | 新位置                                             | 状态            |
| ------------------------ | -------------------------------------------------- | --------------- |
| `auth-gate.ts`           | `application/auth/auth-service.ts`                 | ✅ 已迁移并删除 |
| `bookmark-converters.ts` | `core/bookmark/services/bookmark-converters.ts`    | ✅ 已迁移并删除 |
| `cleanup-scanner.ts`     | `core/bookmark/services/cleanup-scanner.ts`        | ✅ 已迁移并删除 |
| `logger.ts`              | `infrastructure/logging/logger.ts`                 | ✅ 已迁移并删除 |
| `notifications.ts`       | `application/notification/notification-service.ts` | ✅ 已迁移并删除 |
| `safe-json-fetch.ts`     | `infrastructure/http/api-client.ts`                | ✅ 已迁移并删除 |
| `scheduler.ts`           | `application/scheduler/scheduler-service.ts`       | ✅ 已迁移并删除 |
| `smart-font-manager.ts`  | `application/font/font-service.ts`                 | ✅ 已迁移并删除 |
| `toastbar.ts`            | `application/notification/notification-service.ts` | ✅ 已迁移并删除 |

### ⚠️ 保留文件（技术债务）

| 文件                   | 行数  | 说明               |
| ---------------------- | ----- | ------------------ |
| `indexeddb-manager.ts` | ~1556 | 核心数据库管理逻辑 |
| `indexeddb-schema.ts`  | ~536  | 数据库类型定义     |
| `indexeddb/`           | -     | 相关辅助模块       |

## 🏗️ 当前架构

### 桥接模式

```
应用代码
    ↓
infrastructure/indexeddb/manager.ts (桥接层)
    ↓
utils-legacy/indexeddb-manager.ts (实现层)
```

**桥接层职责**：

- 统一类型导出
- 稳定API接口
- 隔离实现细节

**使用示例**：

```typescript
// ✅ 推荐：通过桥接层访问
import {
  indexedDBManager,
  BookmarkRecord
} from '@/infrastructure/indexeddb/manager'

// ❌ 避免：直接访问遗留代码
import { indexedDBManager } from '@/utils-legacy/indexeddb-manager'
```

## 🎯 使用建议

### 对于新功能开发

- **✅ 使用桥接层**：`@/infrastructure/indexeddb/manager`
- **❌ 避免直接引用**：`@/utils-legacy/...`

### 对于维护现有代码

- 保持通过桥接层访问
- 如需修改，在 `utils-legacy/indexeddb-manager.ts` 中进行
- 确保桥接层API不变

## 📈 未来重构建议

### 目标架构（长期）

```
infrastructure/indexeddb/
├── connection.ts          # 数据库连接管理
├── migrations.ts          # 版本迁移逻辑
├── repositories/          # 仓储模式实现
│   ├── bookmark-repository.ts
│   ├── search-history-repository.ts
│   └── metadata-repository.ts
├── schema.ts              # 类型定义
└── manager.ts             # 统一管理器
```

### 重构优先级

**优先级：低** - 当前架构已通过桥接层实现良好隔离

**触发条件**：

- 需要大规模修改数据库结构
- 性能瓶颈需要优化
- 添加新的存储需求

### 重构步骤建议

1. **第一步**：提取类型定义
   - 移动 `indexeddb-schema.ts` 到 `infrastructure/indexeddb/schema.ts`
   - 确保向后兼容

2. **第二步**：拆分仓储模式
   - 为每个数据表创建独立的仓储类
   - 实现统一的仓储接口

3. **第三步**：重构管理器
   - 简化 `indexeddb-manager.ts`
   - 使用仓储模式替代直接操作

4. **第四步**：删除遗留代码
   - 完全移除 `utils-legacy/` 目录
   - 更新所有文档

## 📚 相关文档

- [分层架构标准](../../ARCHITECTURE.md)
- [迁移完成报告](../../../UTILS_MIGRATION_COMPLETE.md)
- [重构总结](../../REFACTOR_SUMMARY.md)

---

## 🎉 迁移成果

**已完成**：

- ✅ 完全移除了 `utils/` 目录
- ✅ 迁移了 9个工具文件到新架构
- ✅ 更新了所有代码引用
- ✅ 建立了完整的架构文档
- ✅ 所有TypeScript和ESLint检查通过

**当前状态**：

- ⚠️ 仅保留IndexedDB模块（受控技术债务）
- ✅ 通过桥接层实现良好隔离
- ✅ 不影响其他模块开发

---

**最后更新**: 2025-10-13  
**下次审查**: 当需要重构IndexedDB模块时
