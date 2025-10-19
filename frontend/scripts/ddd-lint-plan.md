# Pinia / DDD 依赖边界静态检查方案

## 目标

- 保证 `presentation` 层（组件、store）仅依赖 `application` 层公开的服务
- 禁止跨层直接访问 `core`/`infrastructure`/`background`
- 提供可持续运行的自动化检查，纳入 `lint:check`

## 现状

- Store、组件可直接 `import '@/services/...` 或 `@/infrastructure/...`
- 缺乏统一 lint 规则或脚本限制
- `tsconfig` 未针对层级设置 path 限制

## 实施思路

1. **目录分层映射**
   - `presentation`: `src/components`, `src/pages`, `src/stores`
   - `application`: `src/application`
   - `core`: `src/core`
   - `infrastructure`: `src/infrastructure`

2. **ESLint 插件策略**
   - 使用 `eslint-plugin-boundaries` 或自定义规则，定义允许的依赖关系图
   - 在 `eslint.config.js` 中增加：
     - `presentation` → 允访问 `application`、同层
     - `application` → 允访问 `core`、`infrastructure`
     - `core` → 禁止访问 `presentation`
     - `infrastructure` → 禁止访问 `presentation`

3. **额外静态检查脚本**
   - 通过 `ts-morph` 或 `madge` 生成依赖图，输出违规边
   - 集成到 `bun run lint:all` 或新增 `bun run lint:ddd`

4. **落地步骤**
   - [ ] 评估 `eslint-plugin-boundaries` 与现有 ESLint 冲突情况
   - [ ] 在试验分支配置规则，运行 `eslint --print-config` 验证
   - [ ] 编写自定义 wrapper 脚本，生成易读报表
   - [ ] 更新项目文档 (`docs/DDD-dependency-check.md`)
   - [ ] CI 集成（配置 lint 阶段执行）

5. **阶段目标**

| 阶段 | 内容                   | 产出               |
| ---- | ---------------------- | ------------------ |
| P1   | 规则 PoC、提取违规样例 | PoC 脚本 + 报告    |
| P2   | 修复现有违规           | 重构 PR            |
| P3   | CI 集成、文档          | README + lint 流程 |

6. **后续扩展**

- 针对 store → application 进一步细化：仅允许 `import '@/application/**/index'` 或明确服务
- 结合 TypeScript `solution style` 项目，使用 `references` 完成物理隔离
