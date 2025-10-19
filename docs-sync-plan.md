# 文档与类型同步评估（草案）

## 已同步内容

- IndexedDB：`infrastructure/indexeddb/README.md`、`文档/项目管理/src目录架构说明.md` 已更新迁移状态
- 背景脚本：新增 `services/navigation-service.ts`，文档补充解耦说明

## 待更新条目

1. `frontend/ARCHITECTURE.md`
   - 需要反映新版 IndexedDB 架构和 background 服务化
2. `文档/项目管理/架构规范-快速开始.md`
   - 新增 DDD 跨层依赖检查、QA 门禁计划链接
3. `docs/QA-Automation.md`（新文档）
   - 记录 LHCI/E2E/覆盖率门禁执行方式
4. 类型声明
   - 确认 `types/` 与 `validation/` 是否一致，考虑生成脚本

## 下一步

- [ ] 撰写 `docs/QA-Automation.md`
- [ ] 更新 `frontend/ARCHITECTURE.md`
- [ ] 在根 README 或开发指引中附上自动化与 lint 规则
