# Base 组件基线盘点（2025-10-19）

## 审计概览

- 目录总数：31（含入口 README）
- 快速审计脚本：`bun scripts/audit-base-components.ts`
- 最近审计输出：

```28:62:frontend/src/components/base/README.md
| 组件 | Vue | TS | 文档 | Story | 单测 |
| --- | --- | --- | --- | --- | --- |
| Tabs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dropdown | ✅ | ✅ | ❌ | ❌ | ❌ |
| Notification | ✅ | ✅ | ✅ | ❌ | ✅ |
| Tooltip | ✅ | ✅ | ❌ | ❌ | ❌ |
| Card | ✅ | ✅ | ❌ | ❌ | ❌ |
| UrlInput | ✅ | ✅ | ❌ | ❌ | ❌ |
| ThemeToggle | ❌ | ✅ | ❌ | ❌ | ❌ |
| Input | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chip | ✅ | ✅ | ❌ | ❌ | ❌ |
| Checkbox | ✅ | ✅ | ❌ | ❌ | ❌ |
| SvgIcon | ✅ | ✅ | ❌ | ❌ | ❌ |
| Spinner | ✅ | ✅ | ❌ | ❌ | ❌ |
| ProgressBar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Spacer | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dialog | ✅ | ✅ | ❌ | ❌ | ❌ |
| Button | ✅ | ✅ | ✅ | ✅ | ✅ |
| List | ✅ | ✅ | ❌ | ❌ | ❌ |
| Divider | ✅ | ✅ | ❌ | ❌ | ❌ |
| EmojiIcon | ✅ | ✅ | ❌ | ❌ | ❌ |
| Avatar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Switch | ✅ | ✅ | ❌ | ❌ | ❌ |
| Icon | ✅ | ✅ | ❌ | ❌ | ❌ |
| ConfirmableDialog | ❌ | ✅ | ❌ | ❌ | ❌ |
| PerformanceMonitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Main | ✅ | ✅ | ❌ | ❌ | ❌ |
| Overlay | ✅ | ✅ | ❌ | ❌ | ❌ |
| Grid | ✅ | ✅ | ❌ | ❌ | ❌ |
| Badge | ✅ | ✅ | ❌ | ❌ | ❌ |

共扫描组件：31 个。
Story 缺失：29 个。
```

## 行动进展

- ✅ 引入 `scripts/audit-base-components.ts`，统一输出缺口清单
- ✅ 为 `Button` 组件新增 `Button.stories.ts`，作为整改模板
- ✅ 在 `package.json` 添加 `audit:base-components` 等命令

## 下一步计划

1. **Story 覆盖**：按优先级补齐常用组件 Story，复用 `Button.stories.ts` 结构
2. **脚本扩展**：审计脚本后续加入 Props/Slots 元数据导出（计划写入 `docs/components-base-report.md`）
3. **文档同步**：缺少 README 的组件（如 `ConfirmableDialog`、`ThemeToggle`）需补文档和使用示例
