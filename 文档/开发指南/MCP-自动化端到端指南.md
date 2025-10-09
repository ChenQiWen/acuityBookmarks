# MCP 自动化端到端指南

本指南帮助你在本地以真实 Chrome 环境对扩展进行端到端（E2E）自动化验证、性能回归与取证。工具为 Chrome DevTools MCP（Model Context Protocol）。

## 目标

- 一键打开扩展页面、填写表单、点击按钮、等待进度、断言成功并留存截图/日志
- 记录性能 trace 与核心指标（LCP、长任务、网络瓶颈），支持弱网/降频回归
- 形成稳定的“选择器契约”：核心元素具备 data-testid，脚本不依赖易变文案

## 前置要求

- Node.js >= 20.19
- Chrome 稳定版或 Canary
- VS Code（或任意支持 MCP 的客户端）
- 已加载本扩展的独立 Chrome 实例（推荐）

## 启动与连接

1. 启动一个独立的 Chrome 测试实例（保留扩展/登录态）
   - macOS 示例：
     - 打开一个 Terminal，执行：
       - `open -na "/Applications/Google Chrome.app" --args --user-data-dir=/tmp/ab-profile --remote-debugging-port=9222`
     - 在该实例的 chrome://extensions 页面，开发者模式 → 加载已解压 → 选择 `dist` 目录
2. 在 VS Code 的 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--browserUrl=http://localhost:9222",
        "--headless=false",
        "--isolated=false",
        "--viewport=1280x800",
        "--channel=stable"
      ]
    }
  }
}
```

3. 若你的客户端启用了沙箱，请按官方文档关闭对该 MCP 的沙箱或使用 `--browserUrl` 连接外部 Chrome。

## 稳定选择器约定（本项目已落地）

- 管理页：
  - 生成：`btn-generate` → 打开对话框 `dlg-generate`，输入框：`gen-*`，确认：`btn-generate-confirm`
  - 删除：`btn-delete` → 打开对话框 `dlg-delete`，输入框：`del-*`，确认：`btn-delete-confirm`
  - 进度：`progress-text`
- 弹出页 Popup：
  - 设置按钮：`btn-open-settings`；侧边栏开关：`btn-toggle-sidepanel`
  - 搜索：`input-search`；结果列表：`list-search-results`，条目：`result-item`
- 侧边栏 SidePanel：
  - 设置按钮：`btn-open-settings`；关闭：`btn-close-sidepanel`
  - 搜索：`input-search`；加载：`search-loading`；空：`search-empty`；结果：`search-items`
- 设置页 Settings：
  - 竖向 tabs：`tabs-vertical`；顶部 tabs：`tabs-horizontal`；标题：`settings-title`
- 认证页 Auth：
  - OAuth 按钮：`btn-oauth-*`；登录输入：`login-email`, `login-password`；登录：`btn-login`；注册：`btn-register`

## 标准用例（示例）

1. 生成 100 条测试数据（快速自检）

- navigate_page 到 `chrome-extension://<id>/management.html`
- click `btn-generate` → 在 `dlg-generate` 中填 `gen-total=100`，其余默认
- click `btn-generate-confirm`
- wait_for `progress-text` 包含“正在刷新本地数据…”出现后消失
- wait_for 页面出现“已创建 100 条” toast 文案（或 evaluate_script 断言）
- take_screenshot 保存到 `artifacts/`

2. 随机删除 100 条并清空空文件夹

- click `btn-delete` → `del-target=100` 勾选 `del-clean-empty`
- click `btn-delete-confirm`
- 进度同上，最后 wait_for toast “已删除 100 条书签”

3. 性能回归（弱网 + 降频）

- emulate_network=Slow 4G，emulate_cpu=4x
- performance_start_trace → 执行“生成 10000” → performance_stop_trace
- performance_analyze_insight 输出摘要与建议；保存 screenshot 与 trace 摘要到 `artifacts/`

## 产物与命名

- 截图：`artifacts/yyyyMMdd-HHmmss_scenario.png`
- 控制台：`artifacts/yyyyMMdd-HHmmss_console.json`
- 网络清单：`artifacts/yyyyMMdd-HHmmss_network.json`
- 性能摘要：`artifacts/yyyyMMdd-HHmmss_perf.json`

## 故障排查

- 连接失败：确认 9222 打开、MCP 无沙箱限制、browserUrl 正确
- 页面元素找不到：确认 data-testid 是否存在；等待时用 wait_for 而非固定 sleep
- 扩展未加载：检查 dist 是否是最新构建，或切换到 headless=false 观察界面

## 隐私与安全

- MCP 会把浏览器内容暴露给客户端：请使用测试 profile，不在其中登录个人账号
- 如需临时环境，使用 `--isolated=true`（会在关闭时自动清理用户目录）

---

如需范例脚本（操作序列）或将以上用例抽象为复用模板，请告诉我，我会一并补充。
