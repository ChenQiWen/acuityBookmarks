# MCP 最小 E2E 验收（AcuityBookmarks）

目标：自动化验证 Popup 打开→输入搜索→出现结果→无控制台错误→截图归档。

## 前置

- 构建扩展：在 `frontend/` 运行 `bun run build:prod`
- 本地静态服务（可选）：`bun run serve:dist`（默认端口 5174）
- Cloudflare Worker（可选，用于联调接口）：在 `backend/` 运行 `bunx wrangler dev --port 8787`

## MCP 操作序列（示意）

1. 新开页面并导航到 Popup：
   - URL: `http://localhost:5174/popup.html`（或通过未打包扩展方式加载）
2. 等待输入框出现：
   - 选择器：`[data-testid="bookmark-search-input"]`
3. 输入关键词并回车：
   - 文本：例如 `vite`
4. 观察控制台：
   - 读取 console messages，应无 error 级别日志
5. 截图保存：
   - 全页截图 `screenshots/popup-after-search.png`
6. 可选：性能 trace（30s 内）并保存报告。

> 关键选择器（已在组件中加入 data-testid）：

- `data-testid="bookmark-search-box"`
- `data-testid="bookmark-search-input"`
- `data-testid="semantic-search-button"`
- `data-testid="bookmark-search-error"`

## 预期

- 页面可打开，输入框可用
- 控制台无 error -（可选）网络请求到 `http://127.0.0.1:8787/api/health` 200 OK

## 常见问题

- 未构建 dist：请先运行 `bun run build:prod`
- 端口占用：修改 `serve:dist` 的端口或结束占用进程
- 选择器变化：若组件结构变动，请同步更新 data-testid
