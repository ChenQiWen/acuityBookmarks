# 自动化产物（artifacts）规范

本文约定自动化测试与取证过程中产出的文件结构、命名与清理策略，配合《MCP 自动化端到端指南》使用。

## 目录结构

- `artifacts/`：根目录（建议置于仓库根，默认不提交）
  - `screenshots/`：截图
  - `console/`：浏览器控制台导出
  - `network/`：网络请求清单
  - `performance/`：性能摘要/trace 导出
  - `logs/`：脚本运行日志（可选）

> 如在 CI 中运行，可将上述目录打包为构件（artifact），上传到 CI 平台便于回溯。

## 命名约定

- 统一前缀：`yyyyMMdd-HHmmss`（本地时间）
- 建议场景标识：`_<scenario>`（例如 `_gen100_del100`）
- 示例：
  - `screenshots/20250101-093000_gen100.png`
  - `console/20250101-093000_gen100.json`
  - `network/20250101-093000_gen100.json`
  - `performance/20250101-093000_gen100.json`

## 提交策略

- 推荐将 `artifacts/` 整体加入 `.gitignore`（仅在需要时挑选性提交少量代表样例）
- CI：将 `artifacts/` 作为构件上传，保留最近 N 次构建；失败用例保留更长时间

## 清理策略

- 本地：保留近 7 天产物，超出按目录删除（可用简单 Node 脚本或 shell）
- CI：按流水线策略清理，优先保留失败样本

## MCP 工具映射

- 截图：`take_screenshot` → `artifacts/screenshots/`
- 控制台：`list_console_messages` → JSON 序列化到 `artifacts/console/`
- 网络：`list_network_requests` → JSON 序列化到 `artifacts/network/`
- 性能：`performance_stop_trace` 结果摘要 → `artifacts/performance/`

## 示例实现要点

- 统一一个 `nowTag()` 生成时间戳与场景名
- 产物写入前确保子目录存在
- 注意隐私：产物可能含 URL/Headers/Cookies，请在测试 profile 内运行

---

如需我提供一个最小化 Node 脚本，完成 artifacts 目录的创建与清理，请告诉我。
