# AcuityBookmarks AI 开发指南

本指南为 AI 代理提供项目结构、开发流程和最佳实践的关键信息。

## 项目架构

### 整体架构
- 前端：Vue 3 + TypeScript 浏览器扩展（`frontend/`目录）
- 后端：Cloudflare Worker（`backend/`目录）
- 共享：跨组件通信和数据模型

### 关键组件
- 弹出窗口（`popup.html`）：主要用户界面
- 管理页面（`management.html`）：书签管理界面
- 侧边面板（`side-panel.html`）：浏览器侧边栏集成
- 后台服务（`cloudflare-worker.js`）：高性能云处理

## 开发工作流

### 环境设置
```bash
# 一键设置开发环境
./scripts/dev-setup.sh
```

### 开发命令
前端开发：
```bash
cd frontend
bun run build:hot        # 热更新开发模式
bun run build:prod       # 生产构建
bun run lint:fix         # 自动修复代码格式
```

后端开发：
```bash
cd backend
bun run dev             # 本地开发服务器
bun run deploy          # 部署到 Cloudflare
```

### 关键配置文件
- `frontend/vite.config.ts`：构建和优化配置
- `backend/wrangler.toml`：Cloudflare Worker 配置
- `.vscode/settings.json`：编辑器配置

## 技术规范

### 前端开发
1. 使用 TypeScript 严格模式，避免 `any` 类型
2. 组件采用 Composition API 和 `<script setup>` 语法
3. 使用自定义组件库（AcuityUI）替代 Vuetify
4. 状态管理使用 Pinia，确保正确的状态隔离

### 性能考虑
1. MDI 字体优化只保留 woff2 格式
2. 使用代码分割优化加载性能
3. 实现高效的缓存策略（IndexedDB）
4. 资源按需加载和预加载

### 书签处理
1. 实现智能书签差异引擎
2. 使用高性能缓存系统
3. 确保正确的错误处理和空值检查

## 测试和质量保证

### 自动化测试
- 提交前运行类型检查：`bun run type-check`
- 运行单元测试：`bun run test:run`
- 复杂度测试指南位于 `文档/开发指南/复杂度测试指南.md`

### Git 工作流
- 使用预提交钩子进行代码质量检查
- 推送前确保构建成功
- 遵循语义化版本控制

## 集成要点

### 浏览器扩展 API
1. 使用最新的 Chrome Extension Manifest V3
2. 实现正确的跨组件通信模式
3. 遵循最小权限原则

### 云服务集成
1. 使用 Cloudflare Worker 进行后端处理
2. 实现高效的 API 缓存策略
3. 确保安全的跨域请求处理

## 文档参考

### 关键文档
- 前端开发文档：`文档/开发指南/前端开发指南.md`
- 后端开发文档：`文档/开发指南/后端开发指南.md`
- UI组件文档：`文档/开发指南/UI组件库说明.md`
- 设计系统文档：`文档/开发指南/设计系统说明.md`

### 性能优化
- 参考 `文档/项目管理/前端优化计划.md`
- 遵循 `文档/技术修复报告/` 中的最佳实践