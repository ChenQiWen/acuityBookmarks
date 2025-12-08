# Requirements Document

## Introduction

本规范旨在系统性地清理和更新 `frontend/src` 目录下所有代码文件中的注释。由于项目架构经历了多次调整（从早期架构演进到 DDD + 单向数据流 + 现代技术栈 v3.0），许多代码注释已经过时、不准确甚至具有误导性。这些过时注释会对 AI IDE 工具（如 Cursor、Copilot、Kiro）造成严重误判，影响代码生成质量和开发效率。

清理范围包括：
- JSDoc 注释
- 行内注释（`//` 和 `/* */`）
- TODO/FIXME/HACK 等标记注释
- 文件头部说明注释
- 废弃的代码块注释

## Glossary

- **DDD（Domain-Driven Design）**：领域驱动设计，本项目采用的分层架构模式
- **单向数据流**：数据从 Chrome API → Background Script → IndexedDB → Pinia Store → Vue Components 的单向流动模式
- **IndexedDB**：浏览器本地数据库，本项目的唯一数据源
- **Background Script**：Chrome 扩展的后台脚本，运行在 Service Worker 环境
- **Pinia Store**：Vue 3 的状态管理库
- **JSDoc**：JavaScript 文档注释标准
- **过时注释**：与当前代码实现不符或描述已废弃功能的注释
- **误导性注释**：描述错误的架构关系、数据流或 API 用法的注释

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望所有 JSDoc 注释都准确反映当前函数/类的实际行为，以便 AI 工具能正确理解代码意图。

#### Acceptance Criteria

1. WHEN 审查 JSDoc 注释 THEN Comment_Cleanup_System SHALL 验证 `@param` 参数名称和类型与实际函数签名一致
2. WHEN 审查 JSDoc 注释 THEN Comment_Cleanup_System SHALL 验证 `@returns` 描述与实际返回值类型和含义一致
3. WHEN 发现 JSDoc 描述与函数实际行为不符 THEN Comment_Cleanup_System SHALL 更新注释以反映当前实现
4. WHEN 函数已被重构但 JSDoc 未更新 THEN Comment_Cleanup_System SHALL 重写 JSDoc 以匹配新的函数职责
5. WHEN JSDoc 引用了已废弃的类型或接口 THEN Comment_Cleanup_System SHALL 更新为当前使用的类型

### Requirement 2

**User Story:** 作为开发者，我希望所有架构相关注释都符合当前 DDD + 单向数据流架构，以避免 AI 工具生成违反架构的代码。

#### Acceptance Criteria

1. WHEN 注释描述数据流方向 THEN Comment_Cleanup_System SHALL 确保描述符合「Chrome API → Background → IndexedDB → Pinia → Vue」的单向流
2. WHEN 注释提及直接调用 Chrome Bookmarks API THEN Comment_Cleanup_System SHALL 验证该代码位于 `background/` 目录，否则标记为需修正
3. WHEN 注释描述组件直接访问 IndexedDB THEN Comment_Cleanup_System SHALL 验证是否通过 `indexedDBManager` 统一入口
4. WHEN 注释描述跨层调用（如 presentation 直接访问 infrastructure）THEN Comment_Cleanup_System SHALL 标记为架构违规并更新注释
5. WHEN 注释使用「搜索」术语描述本地数据过滤 THEN Comment_Cleanup_System SHALL 更新为「筛选」以符合产品术语规范

### Requirement 3

**User Story:** 作为开发者，我希望清除所有已完成或过时的 TODO/FIXME/HACK 注释，以保持代码库整洁。

#### Acceptance Criteria

1. WHEN 发现 TODO 注释且对应功能已实现 THEN Comment_Cleanup_System SHALL 删除该 TODO 注释
2. WHEN 发现 FIXME 注释且对应问题已修复 THEN Comment_Cleanup_System SHALL 删除该 FIXME 注释
3. WHEN 发现 HACK 注释且代码已被重构为正规实现 THEN Comment_Cleanup_System SHALL 删除该 HACK 注释
4. WHEN TODO/FIXME 注释仍然有效 THEN Comment_Cleanup_System SHALL 保留并确保描述清晰、可操作
5. WHEN 发现无日期或无责任人的 TODO 注释 THEN Comment_Cleanup_System SHALL 评估其有效性并决定保留或删除

### Requirement 4

**User Story:** 作为开发者，我希望删除所有被注释掉的废弃代码块，以减少代码噪音和 AI 工具的混淆。

#### Acceptance Criteria

1. WHEN 发现被注释掉的代码块超过 3 行 THEN Comment_Cleanup_System SHALL 评估是否为废弃代码
2. WHEN 被注释代码使用了已废弃的 API 或架构模式 THEN Comment_Cleanup_System SHALL 删除该注释代码块
3. WHEN 被注释代码有明确的「临时禁用」说明且仍有价值 THEN Comment_Cleanup_System SHALL 保留并添加清晰的上下文说明
4. WHEN 被注释代码与当前实现完全重复 THEN Comment_Cleanup_System SHALL 删除该注释代码块
5. IF 被注释代码块无法确定是否应删除 THEN Comment_Cleanup_System SHALL 标记为待确认并记录位置

### Requirement 5

**User Story:** 作为开发者，我希望所有 Service Worker 环境相关的注释都准确描述 API 可用性，以避免运行时错误。

#### Acceptance Criteria

1. WHEN 审查 `background/` 目录下的注释 THEN Comment_Cleanup_System SHALL 验证不包含对 `window.*`、`document.*`、`localStorage` 的引用
2. WHEN 注释描述定时器使用 THEN Comment_Cleanup_System SHALL 确保使用 `setTimeout`/`setInterval` 而非 `window.setTimeout`
3. WHEN 注释描述存储操作 THEN Comment_Cleanup_System SHALL 确保引用 `chrome.storage.*` 而非 `localStorage`
4. WHEN 发现注释错误描述 Service Worker 环境能力 THEN Comment_Cleanup_System SHALL 更新为准确的 API 描述

### Requirement 6

**User Story:** 作为开发者，我希望所有文件头部注释都准确描述文件的当前职责和所属层级，以便快速理解代码组织。

#### Acceptance Criteria

1. WHEN 审查文件头部注释 THEN Comment_Cleanup_System SHALL 验证描述的模块职责与实际代码一致
2. WHEN 文件头部注释描述的层级与文件实际位置不符 THEN Comment_Cleanup_System SHALL 更新层级描述
3. WHEN 文件头部注释引用了已重命名或移动的依赖 THEN Comment_Cleanup_System SHALL 更新引用路径
4. WHEN 文件缺少头部注释但职责复杂 THEN Comment_Cleanup_System SHALL 添加简洁的职责说明注释

### Requirement 7

**User Story:** 作为开发者，我希望所有类型相关注释都与 TypeScript 类型定义保持同步，以避免类型混淆。

#### Acceptance Criteria

1. WHEN 注释描述的类型与 TypeScript 类型定义不一致 THEN Comment_Cleanup_System SHALL 更新注释以匹配类型定义
2. WHEN 注释引用了已废弃的接口名称 THEN Comment_Cleanup_System SHALL 更新为当前接口名称
3. WHEN 注释描述可选参数但类型定义已改为必填 THEN Comment_Cleanup_System SHALL 更新注释
4. WHEN 发现冗余的类型注释（TypeScript 已明确声明）THEN Comment_Cleanup_System SHALL 评估是否删除以减少维护负担

### Requirement 8

**User Story:** 作为开发者，我希望清理过程按目录优先级进行，优先处理核心业务代码。

#### Acceptance Criteria

1. WHEN 开始清理工作 THEN Comment_Cleanup_System SHALL 按以下优先级顺序处理目录：core → application → infrastructure → background → stores → services → presentation → components → composables → utils
2. WHEN 处理每个目录 THEN Comment_Cleanup_System SHALL 先处理 `.ts` 文件再处理 `.vue` 文件
3. WHEN 完成一个目录的清理 THEN Comment_Cleanup_System SHALL 运行类型检查确保无破坏性更改
4. WHEN 发现注释修改可能影响其他文件 THEN Comment_Cleanup_System SHALL 记录依赖关系以便后续验证
