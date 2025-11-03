# Services 与 Application 层职责划分方案

## 当前问题

`services/` 和 `application/` 目录职责重叠，造成混淆。

## 职责划分原则

### Services/ - Background Script 和 Worker 专用服务

**职责**：仅在 Background Script 或 Worker 环境中运行的服务

**包含**：

- `background-crawler-client.ts` - Background Script 爬虫客户端
- `crawl-task-scheduler.ts` - Background Script 任务调度器
- `data-health-client.ts` - Background Script 健康检查客户端
- `health-scan-worker-service.ts` - Worker 专用服务
- `local-bookmark-crawler.ts` - Background Script 爬虫
- `local-crawler-worker.ts` - Worker 专用爬虫
- `navigation-service.ts` - Background Script 导航服务
- `query-worker-adapter.ts` - Worker 适配器

### Application/ - 前端应用服务层

**职责**：供前端 UI 层调用的应用服务

**应该包含**：

- `bookmark-health-service.ts` → `application/health/bookmark-health-service.ts`
- `bookmark-sync-service.ts` → `application/bookmark/bookmark-sync-service.ts`
- `favicon-service.ts` → `application/bookmark/favicon-service.ts`
- `modern-bookmark-service.ts` → `application/bookmark/modern-bookmark-service.ts`
- `query-performance-monitor.ts` → `application/query/query-performance-monitor.ts`
- `smart-recommendation-engine.ts` → `application/bookmark/recommendation-service.ts`

## 迁移计划

### 阶段一：分析依赖关系（已完成）

- ✅ 识别所有 `services/` 文件的用途
- ✅ 分析调用关系

### 阶段二：创建迁移计划（待执行）

- ⏳ 创建迁移文档
- ⏳ 更新所有导入路径
- ⏳ 运行测试验证

### 阶段三：逐步迁移（待执行）

- ⏳ 迁移 `bookmark-health-service.ts`
- ⏳ 迁移 `bookmark-sync-service.ts`
- ⏳ 迁移其他服务
- ⏳ 更新文档

## 注意事项

1. **向后兼容**：迁移时保持 API 不变，通过重新导出保持兼容
2. **测试验证**：每次迁移后运行完整测试
3. **文档更新**：更新所有相关文档和注释
