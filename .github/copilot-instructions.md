# AcuityBookmarks AI 开发指南

本指南为 AI 代理提供项目结构、开发流程和最佳实践的关键信息。

## 项目架构

### 整体架构
- 前端：Vue 3 + TypeScript 浏览器扩展（`frontend/`目录）
# AcuityBookmarks — AI Agent 指南

目标：让自动化编码代理快速上手本仓库，理解架构、常用命令、约定和关键集成点以产生可编译、可测试的变更。

要点速览
- 前端：Vue 3 + TypeScript 浏览器扩展，代码在 `frontend/`（入口：`popup.html`, `management.html`, `side-panel.html`）。
- 后端：单个 Cloudflare Worker 在 `backend/cloudflare-worker.js`（配置：`backend/wrangler.toml`）。
- 构建与脚本使用 Bun/Vite/vue-tsc；根目录与 `frontend/package.json` 包含实际脚本（参见示例）。

快速命令参考（来自 `frontend/package.json`）
- 一键开发环境：`./scripts/dev-setup.sh`
- 前端热构建（扩展友好）：`cd frontend && bun run build:hot`
- 生产构建（类型检查 + 清理）：`cd frontend && bun run build:prod`
- 类型检查：`cd frontend && bun run type-check`
- Lint 严格修复：`cd frontend && bun run lint:fix`

项目约定与注意事项（仅描述可从代码库确认的规则）
- TypeScript 严格模式：项目依赖 `vue-tsc` 做类型构建（`build`/`build:prod` 在脚本中先运行 `vue-tsc -b`）。
- 组件风格：使用 Composition API 与 `<script setup>`（前端源码遵循此风格）。
- 状态管理：使用 Pinia（`src` 中可找到 store 定义）；避免在 store 中放大型不可序列化对象。
- 构建产物清理：构建后运行 `bun scripts/clean-dist.cjs` 做产物清理，修改构建流程时请保留该步骤或等效逻辑。

关键集成点（可用于定位改动影响面）
- 浏览器扩展 entry points: `frontend/popup.html`, `frontend/management.html`, `frontend/side-panel.html`。
- 后端 API surface: `backend/cloudflare-worker.js` — 修改接口时同时更新 `backend/wrangler.toml` 与文档。
- IndexedDB / 本地缓存：前端实现高性能缓存（参考 `文档/技术修复报告/` 中相关报告），改动需注意事务与空值处理历史问题。

通知与显示策略（开发者调试小贴士）
- ToastBar 为主通道（页面内浮层）：`src/utils/toastbar.ts`，全局 `AB_showToast*` 可直接测试。
- 系统通知为自动镜像的副通道：仅当页面不可见（document.hidden=true）时才发送；后台任务（Service Worker）也可直接发送，用于“页面不在前台”时告知用户。
- 诊断：`AB_checkNotifications()` 查看权限与 SW 路径；快速触发：`AB_notify('hi')` 等。

如何在本仓库生成安全、可验证的更改
1. 先在本地运行类型检查：`cd frontend && bun run type-check`。类型错误必须先修复。
2. 运行 lint：`cd frontend && bun run lint:check`（CI 严格模式会失败于任何警告）。
3. 构建并清理：`cd frontend && bun run build` 或 `bun run build:prod`，确认 `bun scripts/clean-dist.cjs` 没报错。

示例：修改一个 popup 组件
- 文件位置示例：`frontend/src/components/Popup/`。
- 修改后：更新对应的 Pinia store（`frontend/src/stores/*`）以保持状态一致性；运行 `type-check` 和 `lint:fix`，再用 `bun run build:hot` 做热构建验证。

参考文件（快速定位）
- 前端入口/配置：`frontend/vite.config.ts`, `frontend/package.json`, `frontend/tsconfig.*.json`
- 后端：`backend/cloudflare-worker.js`, `backend/wrangler.toml`
- 脚本：`scripts/dev-setup.sh`, `frontend/scripts/clean-dist.cjs`, `frontend/scripts/watch-build.js`
- 文档目录：`文档/`（包含大量实现与修复历史，查阅具体 bug 报告有助于理解陷阱）

如果不确定，请先做这些可验证的动作：
- 运行 `cd frontend && bun run type-check`（必须通过）
- 运行 `cd frontend && bun run lint:check`（CI 严格）
- 运行 `cd frontend && bun run build:hot` 或 `bun run build:prod` 并确认 `clean-dist.cjs` 成功

反馈请求：我已合并并精简现有说明。请告诉我是否需要添加更多文件级示例（例如具体 store、组件或 Cloudflare Worker 路由示例），我会按需迭代。