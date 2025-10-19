# Base 组件基线盘点（2025-10-18）

## 组件数量概览

- 目录总数：29
- 每个组件基本包含 `*.vue` + `*.d.ts` + `README.md`，但存在以下例外：
  - `ConfirmableDialog`、`ToastBar` 缺少 README
  - 多数组件缺少 Story/单测文件

## 文档现状

- README 大多仅含占位说明，缺乏属性/事件/插槽描述
- `ConfirmableDialog`、`ToastBar` 未提供任何文档

## 测试覆盖

- 未发现与 Base 组件对应的单元测试或 Story 配置

## 初步整改建议

1. 建立组件元数据表
   - 列出 props/slots/events，存入 `docs/` 或自动生成
2. 最低文档要求
   - 每个组件 README 需包含用途、基本示例、交互说明
3. Story/单测补齐
   - 优先对高复用组件（Button/Input/List 等）补充 Story 与 Vitest 测试
4. 引入健康检查脚本
   - 基于 `scripts/create-*` 产物定义，校验目录中文档/类型/测试是否齐备
5. 收敛样式模式
   - 结合 `design-system` 调研，识别冗余样式或可复用 Token

后续可在上述基础上输出详细整改计划与排期。
