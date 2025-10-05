# 前端分层架构（进行中）

本项目前端已开始落实分层架构，目标：职责单一、依赖方向清晰、便于测试。

目录结构（新增部分）：

```
src/
├─ core/                  # 核心领域逻辑（框架无关）
│  ├─ common/             # 通用类型（如 Result）
│  ├─ bookmark/
│  │  └─ repositories/    # 数据访问接口（示例：BookmarkRepository）
│  └─ search/
│     ├─ engine.ts        # 统一搜索引擎入口
│     └─ strategies/      # 搜索策略（示例：Fuse）
├─ infrastructure/        # 基础设施实现（可替换）
│  ├─ indexeddb/          # IndexedDB 管理桥接
│  ├─ chrome-api/         # Chrome API 包装
│  └─ logging/            # 日志包装
└─ application/           # 应用服务（用例编排）
   ├─ bookmark/           # 书签应用服务入口
   └─ search/             # 搜索应用服务入口
```

依赖方向：UI → application → core → infrastructure（只能向下依赖）。

当前状态：
- 已添加 Result 类型、BookmarkRepository、BookmarkAppService。
- 已添加 SearchEngine 与 Fuse 策略的最小骨架，以及 SearchAppService。
- 已添加基础设施桥接层（indexedDB/chrome-api/logger）对原 utils 进行透传，保证兼容。

后续增量迁移：
- 将 `utils/unified-bookmark-api.ts` 中的数据访问逻辑逐步下沉至 repository；
- Store 仅保留 UI 状态，业务逻辑迁移至 application/core；
- 合并多套搜索实现为统一入口（SearchEngine + 策略）。

---

质量门槛：
- 类型检查与构建通过；
- Lint 零警告；
- 功能等价，逐步替换调用方后再清理旧代码。
