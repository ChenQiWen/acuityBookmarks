# AcuityBookmarks — AI Agent 快速上手

面向自动化编码代理的精炼说明，覆盖架构、开发命令、项目约定与关键集成点，仅包含本仓库中已可验证的模式与规则。

## 架构总览（大图景）
- 前端：Vue 3 + TypeScript 浏览器扩展（目录：`frontend/`；入口：`popup.html`、`management.html`、`side-panel.html`、`settings.html`、`auth.html`）。
- 后端：单个 Cloudflare Worker（`backend/cloudflare-worker.js`），配置与绑定见 `backend/wrangler.toml`（含 [ai] 与 [[vectorize]] 绑定，`workers_dev` 默认 8787 端口本地开发）。
- 构建：Vite + vue-tsc + Bun。输出目录为 `dist/`（由 `frontend/vite.config.ts` 指向仓库根的 `dist`）。

## 开发与构建（命令来自 package.json）
- 前端类型检查/构建：
	- 类型：`cd frontend && bun run type-check`
	- 热构建（扩展友好）：`cd frontend && bun run build:hot`（若配合 Worker，请用 `build:hot:cloudflare`）
	- 生产：`cd frontend && bun run build:prod`（包含 `vue-tsc -b` 与 `bun scripts/clean-dist.cjs`）
	- Lint：`cd frontend && bun run lint:check`｜修复：`lint:fix`；样式：`stylelint`｜`stylelint:fix`
- 后端 Worker：
	- 本地：`cd backend && bunx wrangler dev`（默认 http://localhost:8787）
	- 部署：`cd backend && bunx wrangler deploy`
	- 健康检查：`cd backend && bun run health-check`

## 项目约定与模式（与通用实践的差异点）
- 组件与状态：统一使用 Vue Composition API + `<script setup>`；状态用 Pinia（见 `frontend/src/stores/*`），避免在 store 内保存大型不可序列化对象。
- 构建产物清理：任何构建流程需保留 `bun scripts/clean-dist.cjs` 步骤（dist 精简依赖扩展加载）。
- 字体与打包：`vite.config.ts` 内置 `mdi-optimizer` 仅保留 MDI 的 woff2 与 CSS 注入；新增图标时请不要引入 ttf/woff（否则会被清理或导致样式错配）。
- 通知/诊断：ToastBar 与系统通知已统一封装（`frontend/src/utils/toastbar.ts`），可使用全局 `AB_showToast*`、`AB_checkNotifications()`、`AB_notify()` 做快速验证。
- 统一搜索：参见 `frontend/src/services/README.md` 与 `frontend/src/composables/README.md`；优先通过 `useBookmarkSearch`/`createBookmarkSearchPresets` 接入，而非分散实现。
- 本地缓存与 IndexedDB：涉及事务/空值处理请先查阅 `文档/技术修复报告/*`（历史坑较多：空值、事务边界、性能）。

## 关键文件/目录（改动前先看）
- 前端配置：`frontend/vite.config.ts`、`frontend/tsconfig*.json`、`frontend/package.json`
- 入口页面：`frontend/popup.html`、`frontend/management.html`、`frontend/side-panel.html`、`frontend/settings.html`、`frontend/auth.html`
- 公共逻辑：`frontend/src/stores/*`、`frontend/src/composables/*`、`frontend/src/utils/toastbar.ts`
- 构建脚本：`frontend/scripts/watch-build.js`、`frontend/scripts/clean-dist.cjs`
- 后端接口：`backend/cloudflare-worker.js` 与 `backend/wrangler.toml`（新增路由/绑定需同步更新此文件与文档）

## 推荐工作流（小步快跑，可复现）
1) `cd frontend && bun run type-check` → 2) `bun run lint:check` → 3) `bun run build:hot`（或 `build:prod`）→ 4) 确认 `clean-dist.cjs` 执行无误。
修改 Popup/Side Panel 组件后，若涉及状态，同步更新相应 Pinia store 并重复上述流程验证。

## 集成提示（常见易错点）
- 前端热构建默认假定本地后端为 127.0.0.1:8787（wrangler dev）；如需切换到线上 Worker，请配置 VITE_API_BASE_URL/VITE_CLOUDFLARE_WORKER_URL。
- 若调整后端路由/鉴权/AI 提供商，需检视 `wrangler.toml` 的 `[vars]`、`[ai]`、`[[vectorize]]` 与 `routes`，并在前端统一 API 调用处对齐协议与路径。

需要更具体的文件级示例（如某个 store、组件或 Worker 路由的修改模版）吗？请告诉我，我会在本指南中补充对应片段。

## 常用文件级示例片段（可复制替换）

- Management 执行路径（planAndExecute + 进度回调）
	- 文件：`frontend/src/stores/management-store.ts`
	- 片段要点：
		- 引入 `bookmarkChangeAppService` 与 `ProgressCallback`
		- 进度桥接到 `executionProgress`：`{ total, completed, failed, currentOperation, etaMs }`
		- 执行：`bookmarkChangeAppService.planAndExecute(original, target, { onProgress })`

- 统一书签树数据源（组件自拉取 + 构建）
	- 文件：`frontend/src/components/SimpleBookmarkTree.vue`
	- 片段要点：
		- 拉取：`const res = await bookmarkAppService.getAllBookmarks()`
		- 构建：`internalNodes.value = treeAppService.buildViewTreeFromFlat(res.ok ? res.value : [])`
		- 查找：`findNodeByIdCore` 来自 `core/bookmark/services/tree-utils`

- 大数据映射（分片构建）
	- 文件：`frontend/src/application/bookmark/tree-app-service.ts` 暴露 `treeAppService.buildBookmarkMappingChunked`
	- Store 用法：
		- `const mapping = await treeAppService.buildBookmarkMappingChunked(original, proposed, { chunkSize: 4000, onProgress })`
		- 小数据：`treeAppService.buildBookmarkMapping(original, proposed)` 同步返回

- IndexedDB 事务包裹（只读/读写 + 重试）
	- 文件：`frontend/src/infrastructure/indexeddb/transaction-manager.ts`
	- 用法：
		- `await withTransaction(['StoreA','StoreB'], 'readonly', (tx, stores) => { /*...*/ }, { retries: 2 })`
		- 解耦连接：见 `connection-pool.ts`，通过 `getDB()`/`setDB()` 复用单连接

- Cloudflare Worker 路由模板
	- 文件：`backend/cloudflare-worker.js`
	- 要点：
		- 新增路由后同步更新 `backend/wrangler.toml`
		- 若用向量检索/AI，确认 `[ai]` 与 `[[vectorize]]` 绑定存在

以上片段与现有实现保持一致，可直接作为增量修改的参考骨架。