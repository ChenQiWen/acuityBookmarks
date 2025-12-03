# 📋 历史包袱清理清单

生成时间：2025-12-02

## ✅ 已清理（完成日期：2025-12-03）

### 1. Toast/ToastBar 组件

- ✅ 删除 `/components/base/Toast/`
- ✅ 删除 `/components/base/ToastBar/`
- ✅ 删除 `TOAST_MIGRATION.md`
- ✅ 更新所有导出和引用

### 2. 迁移文档

- ✅ 删除 `/config/MIGRATION_PLAN.md`
- ✅ 删除 `/services/MIGRATION_PLAN.md`

### 3. loggerCompat

- ✅ 删除 `infrastructure/logging/logger.ts` 中的废弃接口
- ✅ 删除 `infrastructure/index.ts` 中的导出

### 4. searchAppService & filterAppService

- ✅ 替换为 `queryAppService`
- ✅ 更新文档示例（llm/README.md）
- ✅ 更新注释（modern-bookmark-service.ts）
- ✅ 删除废弃导出

### 5. initialExpanded prop

- ✅ 删除 BookmarkTree 组件的 prop 定义
- ✅ 删除类型定义（BookmarkTree.d.ts）
- ✅ 删除默认值
- ✅ 简化相关注释

### 6. injectDynamicFontLink() 函数

- ✅ 迁移 4 个 main.ts 文件到 `fontService.injectDynamicFontLink()`
- ✅ 删除废弃函数定义
- ✅ 清理未使用的导入

---

## ⏸️ 暂不清理（需要更多工作）

### 1. `query-worker-types.ts`

**位置**: `workers/query-worker-types.ts:9`

```typescript
/**
 * @deprecated 使用 import type { WorkerDoc, WorkerHit } from '@/types'
 */
```

**使用情况**:

- `services/query-worker-adapter.ts:19`
- `workers/query-worker.ts:9`
- `offscreen/main.ts:6`

**原因**: Worker 通信类型定义涉及多个文件，需要先在 `@/types/domain/query` 中完善类型定义和导出

**清理步骤**（待类型系统重构时执行）:

1. 在 `@/types/domain/query.d.ts` 中添加完整的 Worker 类型导出
2. 更新所有导入到 `@/types/domain/query`
3. 删除 `query-worker-types.ts` 文件

---

### 2. BookmarkTree initialSelected Props

**位置**: `components/composite/BookmarkTree/BookmarkTree.vue:228-231`

```typescript
/**
 * @deprecated 待重新设计
 */
initialSelected?: string[]
```

**使用情况**:

- 组件内部仍在使用 `initialSelected`（line 360）
- 类型定义中仍然存在（BookmarkTree.d.ts:56）

**清理步骤**:

1. 重新设计为完全受控或完全非受控模式
2. 更新组件API
3. 删除 `initialSelected` prop

---

## 📊 清理统计

| 项目                                | 状态        | 完成日期   |
| ----------------------------------- | ----------- | ---------- |
| Toast/ToastBar 组件                 | ✅ 已完成   | 2025-12-03 |
| MIGRATION_PLAN.md                   | ✅ 已完成   | 2025-12-03 |
| loggerCompat                        | ✅ 已完成   | 2025-12-03 |
| searchAppService & filterAppService | ✅ 已完成   | 2025-12-03 |
| injectDynamicFontLink               | ✅ 已完成   | 2025-12-03 |
| initialExpanded                     | ✅ 已完成   | 2025-12-03 |
| query-worker-types                  | ⏸️ 暂不清理 | -          |
| initialSelected                     | ⏸️ 待设计   | -          |

**完成率**: 75% (6/8)

---

## 🎉 清理成果

### 删除的文件（4个）

- `/components/base/Toast/` 目录
- `/components/base/ToastBar/` 目录
- `/config/MIGRATION_PLAN.md`
- `/services/MIGRATION_PLAN.md`

### 删除的代码（~300行）

- `loggerCompat` 向后兼容接口
- `searchAppService` & `filterAppService` 别名导出
- `injectDynamicFontLink()` 废弃函数
- `initialExpanded` prop 定义和默认值

### 更新的文件（15+个）

- 4 个 main.ts（字体服务调用）
- 2 个文档（README.md）
- 多个组件和服务文件（导入和引用更新）

---

## 📝 清理后续检查

清理完成后运行：

```bash
# 检查 @deprecated 标记
rg "@deprecated" src/

# 检查 TODO 标记
rg "TODO.*废弃|TODO.*删除" src/

# 运行测试
bun test

# 构建检查
bun run build
```
