# IndexedDB Infrastructure Layer

该目录用于承载新版 IndexedDB 实现。

当前阶段（迁移进行中）：

- `manager.ts` 暂时继承 legacy 实现，仅做桥接和类型导出。
- `types/` 下整理了核心 record / options 类型，保持与 legacy 字段一致。
- 后续任务将按连接池、schema、CRUD、搜索等模块逐步迁移，到时将完全替换 legacy 逻辑。

迁移完成后，可删除 `utils-legacy/indexeddb-*` 并在此处记录最终结构。
