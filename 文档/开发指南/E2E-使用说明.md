# E2E 使用说明（管理页）

## 前置

- 用 Dev 版 Chrome 启动远程调试端口（9222），并仅加载本扩展（减少干扰）
- 获取扩展 ID（如：gdjcmpenmogdikhnnaebmddhmdgbfcgl）

## 命令

- 功能回归（本地）：
  - EXT_ID=你的扩展ID npm run e2e:management
- 性能回归（Slow4G + CPU x4）：
  - EXT_ID=你的扩展ID npm run e2e:management:perf
- 全量两轮：
  - EXT_ID=你的扩展ID npm run e2e:management:all

也可直接使用 Node：

- node scripts/e2e-management.mjs --ext <EXT_ID>
- node scripts/e2e-management.mjs --ext <EXT_ID> --perf --cpu 4 --net slow4g

## 产物

- artifacts/screenshots/\*.png：关键步骤截图
- artifacts/console/\*\_console.json：注入的控制台日志缓冲
- artifacts/logs/\*\_management.json：步骤与结果元数据
- artifacts/performance/\*\_trace.json：性能 trace（仅性能模式）
- artifacts/performance/\*\_summary.json：Performance.getMetrics 摘要与步骤耗时（仅性能模式）

## 常见问题

- 无法导航或被拦截：关闭其他扩展，或使用干净的 Profile
- 选择器找不到：等待时间不足或 UI 变更，脚本会尝试文本回退并在必要时标记 skipped
- 远程调试未开启：确保以 --remote-debugging-port=9222 启动
