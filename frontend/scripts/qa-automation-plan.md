# 自动化质量门禁规划（草案）

## 现状分析

- `bun run lint:all` 与 `bun run type-check` 已常规运行，但 CI 未强制覆盖率或端到端测试
- Lighthouse (LHCI) 与 E2E 脚本存在：`audit:lhci`, `scripts/e2e-management.mjs`
- 缺乏统一的覆盖率报告与阈值，测试框架（Vitest）未整合

## 目标

1. 将单元测试覆盖率纳入 PR 门禁（阈值建议：语句/分支 70% 起步）
2. 在 CI 中执行 LHCI（采集 + assert）并输出报表
3. 对关键流程运行管理页 E2E 脚本，至少覆盖烟雾/回归场景

## 阶段计划

| 阶段 | 内容                                                            | 产出                                   |
| ---- | --------------------------------------------------------------- | -------------------------------------- |
| P1   | 搭建 Vitest + 覆盖率收集，配置 `vitest.config.ts` 输出 LCOV     | `bun run test:coverage` 脚本、示例测试 |
| P2   | GitHub Actions / Bun CI 管线：执行 lint、type-check、test、LHCI | CI workflow、阈值设定                  |
| P3   | 集成 E2E 脚本（管理页）和报告汇总（`scripts/e2e-summary.mjs`）  | 更新 CI、Slack/Markdown 报告           |

## 具体任务

1. **单测覆盖率**
   - 引入 `vitest` + `@vitest/coverage-v8`
   - 新增 `bun run test`、`bun run test:coverage`
   - 更新 `package.json` Scripts

2. **CI 管线**
   - 使用 GitHub Actions（或 Bun CI）执行如下步骤：
     ```
     bun install
     bun run lint:all
     bun run type-check
     bun run test:coverage -- --run
     bun run audit:lhci:collect
     bun run audit:lhci:assert
     ```
   - 将覆盖率失败/LHCI assert 失败视为门禁

3. **E2E 集成**
   - 在 CI 中增加 `bun run e2e:management`（需提供 `EXT_ID` 或 mock）
   - 使用 `scripts/e2e-summary.mjs` 生成可读报告并上传 Artifact

4. **本地开发支持**
   - 文档化各脚本的运行方式，新增 `docs/QA-Automation.md`
   - 提供 `bun run qa:smoke` 聚合命令（lint + type-check + test:coverage + LHCI Collect）

5. **后续优化**
   - 接入 `lint-staged` 在 commit 前跑快速测试
   - 使用 `depcheck` 或 `madge` 监控依赖风险
