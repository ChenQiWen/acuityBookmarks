# 使用 Lighthouse/LHCI 审计（Bun 环境）

本仓库采用 Bun 作为包管理与脚本执行工具，无需 npm/yarn。通过 `bunx` 直接运行 `@lhci/cli`，对 `dist/` 中的扩展静态页面进行审计，并在 CI 中做阈值断言。

## 目录

- 快速开始
- 审计对象与限制
- 本地运行
- CI 接入
- 阈值与常见修复指南

## 快速开始

1. 构建扩展：会产出到仓库根的 `dist/`
2. 运行 LHCI：会基于 `lighthouserc.json` 读取 `dist/` 并对多页面进行评测

```bash
# 在仓库根执行（无需 npm）
bun install
bun run audit:lhci
```

> 脚本等价于：`bun run build:frontend && bunx -y @lhci/cli autorun --config ./lighthouserc.json`

## 审计对象与限制

- 当前配置采用 `collect.staticDistDir=./dist`，意味着 Lighthouse 会启动本地静态服务器去加载以下页面：
  - `/index.html`、`/popup.html`、`/management.html`、`/settings.html`、`/side-panel.html`、`/auth.html`
- Chrome 扩展的运行时 API（如 `chrome.*`）在纯静态审计中不可用，可能导致部分脚本分支未被执行。这是正常的，建议：
  - 关键逻辑尽量解耦 DOM 与扩展 API，便于静态页面也能渲染基础视图
  - 对需要扩展权限的逻辑加守卫（特征检测），避免报错阻塞渲染

## 本地运行

- 仅采集（手动查看报告目录 `.lighthouseci/`）：

```bash
bun run audit:lhci:collect
```

- 仅断言（对上次采集数据做阈值校验）：

```bash
bun run audit:lhci:assert
```

如需自定义端口或打开调试日志，请参见 `@lhci/cli` 文档；静态模式下一般不需要额外配置。

## CI 接入

- 在 CI 中执行同样的脚本即可（Bun 环境）：
  - 安装依赖 → 构建前端 → 运行 `bunx @lhci/cli autorun`
- 如果需要将结果上传到 LHCI Server，可在 `lighthouserc.json` 添加 `upload` 段：

```json
{
  "ci": {
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

或改为企业自建的 `lhci` 服务器地址。

## 阈值与常见修复指南

- 当前默认阈值（详见 `lighthouserc.json`）：
  - performance ≥ 0.8（warn）
  - accessibility ≥ 0.9（error）
  - best-practices ≥ 0.9（error）
  - seo ≥ 0.9（warn）
- 常见提升手段：
  - 性能：减少首屏 JS（code-split）、压缩图片、移除未使用代码、恰当的预加载/延迟加载
  - 可访问性：为交互元素提供可见焦点与 aria 标签，确保对比度与语义化结构
  - 最佳实践：使用 HTTPS 资源、避免不安全的第三方、确保图片尺寸与类型正确
  - SEO（对扩展页面意义有限）：提供有效的标题/描述/语言属性，避免阻塞渲染

## 与本项目构建的协同

- 我们通过 `frontend/scripts/clean-dist.cjs` 精简 `dist/`；Lighthouse 直接对该目录进行静态分析，避免与 Vite dev server 互相干扰。
- 如需模拟 Worker 后端数据，请在页面中引入 mock 数据或降级策略，避免因接口报错拖慢首屏指标。
