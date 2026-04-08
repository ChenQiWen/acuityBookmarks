# 命名规范文档

## 🎯 目标

统一项目中的命名规范，消除 `smart-*`、`unified-*`、`modern-*` 等前缀的混用，提高代码可读性和可维护性。

## 📋 命名原则

### 1. 按职责分层命名

```
infrastructure/  → 基础设施层，使用描述性名称
core/           → 核心业务层，使用领域术语
application/    → 应用层，使用 *-service 后缀
services/       → 服务层，使用 *-service 后缀
```

### 2. 禁止使用的前缀

❌ **禁止使用**：

- `smart-*` - 含义模糊，不表达具体职责
- `unified-*` - 过于宽泛，不明确统一了什么
- `modern-*` - 相对概念，会过时
- `enhanced-*` - 主观评价，不表达功能
- `advanced-*` - 主观评价，不表达功能

✅ **推荐使用**：

- 描述性名称：`query-service`、`bookmark-api`
- 领域术语：`diff-engine`、`executor`
- 功能名称：`cache-manager`、`event-bus`

### 3. 服务命名规范

| 旧名称                         | 新名称                    | 原因                              |
| ------------------------------ | ------------------------- | --------------------------------- |
| `UnifiedQueryService`          | `QueryService`            | 去掉冗余的 unified 前缀           |
| `ModernBookmarkService`        | `BookmarkAPIGateway`      | 更准确地描述职责（API 网关）      |
| `SmartBookmarkRecommendations` | `BookmarkRecommendations` | 去掉主观的 smart 前缀             |
| `modernStorage`                | `chromeStorage`           | 更明确地表示是 Chrome Storage API |

## 🔄 重命名计划

### Phase 1: 核心服务（已完成 ✅）

#### 1.1 查询服务 ✅

```typescript
// ✅ 已完成
UnifiedQueryService → QueryService
unifiedQueryService → queryService

// 文件路径
core/query-engine/unified-query-service.ts → core/query-engine/query-service.ts
core/query-engine/unified-query-types.ts → core/query-engine/query-types.ts
```

#### 1.2 存储服务 ✅

```typescript
// ✅ 已完成
modernStorage → chromeStorage

// 文件路径
infrastructure/storage/modern-storage.ts → infrastructure/storage/chrome-storage.ts
```

#### 1.3 书签服务 ✅

```typescript
// ✅ 已完成
ModernBookmarkService → BookmarkAPIGateway
modernBookmarkService → bookmarkAPIGateway
ModernBookmarkNode → EnhancedBookmarkNode

// 文件路径
services/modern-bookmark-service.ts → infrastructure/chrome-api/bookmark-gateway.ts
```

### Phase 2: 组件和类型（下一次）

#### 2.1 组件

```typescript
// ❌ 旧名称
SmartBookmarkRecommendations → BookmarkRecommendations
```

#### 2.2 类型

```typescript
// ❌ 旧名称
ModernBookmarkNode → BookmarkNode (或 EnhancedBookmarkNode)
```

### Phase 3: 方法名（下一次）

```typescript
// ❌ 旧名称
getSmartRecommendations() → getRecommendations()
```

## 📝 重命名检查清单

每次重命名时，必须检查：

- [ ] 更新所有 import 语句
- [ ] 更新所有类型引用
- [ ] 更新所有函数调用
- [ ] 更新相关文档
- [ ] 运行 `bun run typecheck`
- [ ] 运行 `bun run lint:check`
- [ ] 运行 `bun run stylelint:check`

## 🎯 预期收益

1. **可读性提升**：名称更清晰，一眼就能看出职责
2. **维护性提升**：新人更容易理解代码结构
3. **一致性提升**：统一的命名风格
4. **减少困惑**：不再有"这个 smart 和那个 smart 有什么区别"的问题

---

**创建日期**: 2025-01-06  
**最后更新**: 2025-01-06  
**状态**: Phase 1 已完成 ✅
