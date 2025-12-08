# Design Document: Comment Cleanup

## Overview

本设计文档描述了 `frontend/src` 目录下代码注释清理和更新的系统化方案。由于项目架构经历了从早期版本到 DDD + 单向数据流 + 现代技术栈 v3.0 的演进，大量注释已过时或具有误导性。

清理工作将采用**人工审查 + 自动化辅助检测**的混合模式：
- **自动化检测**：识别明显的注释问题（如引用不存在的类型、违反架构规范的 API 引用）
- **人工审查**：判断注释语义的准确性和必要性

### 设计目标

1. **准确性**：确保所有注释与当前代码实现一致
2. **架构合规**：确保注释符合 DDD + 单向数据流架构规范
3. **可维护性**：减少冗余注释，降低维护负担
4. **AI 友好**：消除对 AI 工具的误导，提高代码生成质量

## Architecture

### 清理流程架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Comment Cleanup Workflow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Phase 1    │───▶│   Phase 2    │───▶│   Phase 3    │       │
│  │  自动化检测   │    │   人工审查    │    │   验证确认    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ 问题报告生成  │    │  注释修改     │    │ 类型检查     │       │
│  │ - 类型引用    │    │  - 更新      │    │ Lint 检查    │       │
│  │ - API 引用    │    │  - 删除      │    │ 回归测试     │       │
│  │ - 术语检查    │    │  - 添加      │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 目录处理优先级

按照 DDD 分层架构，从核心层向外围层处理：

```
优先级 1 (核心层)
├── core/                 # 领域模型、业务规则
│
优先级 2 (应用层)
├── application/          # 业务流程协调
│
优先级 3 (基础设施层)
├── infrastructure/       # 技术实现
├── background/           # Chrome Extension 后台脚本
│
优先级 4 (状态管理)
├── stores/               # Pinia 状态管理
├── services/             # 跨层服务
│
优先级 5 (表现层)
├── presentation/         # 页面组件
├── components/           # 可复用组件
├── composables/          # Vue Composables
│
优先级 6 (工具层)
├── utils/                # 工具函数
├── types/                # 类型定义
├── config/               # 配置
├── constants/            # 常量
```

## Components and Interfaces

### 注释类型分类

```typescript
/**
 * 注释类型枚举
 */
enum CommentType {
  /** JSDoc 文档注释 */
  JSDOC = 'jsdoc',
  /** 单行注释 // */
  SINGLE_LINE = 'single_line',
  /** 多行注释 /* */ 
  MULTI_LINE = 'multi_line',
  /** TODO/FIXME/HACK 标记 */
  MARKER = 'marker',
  /** 文件头部说明 */
  FILE_HEADER = 'file_header',
  /** 被注释的代码块 */
  COMMENTED_CODE = 'commented_code'
}

/**
 * 注释问题类型
 */
enum CommentIssue {
  /** 引用不存在的类型/接口 */
  INVALID_TYPE_REFERENCE = 'invalid_type_reference',
  /** 违反架构规范的 API 引用 */
  ARCHITECTURE_VIOLATION = 'architecture_violation',
  /** 使用错误的术语（如「搜索」应为「筛选」）*/
  WRONG_TERMINOLOGY = 'wrong_terminology',
  /** Service Worker 环境 API 错误 */
  SERVICE_WORKER_API_ERROR = 'service_worker_api_error',
  /** 已完成的 TODO/FIXME */
  COMPLETED_MARKER = 'completed_marker',
  /** 废弃的代码块 */
  DEPRECATED_CODE_BLOCK = 'deprecated_code_block',
  /** 层级描述与文件位置不符 */
  LAYER_MISMATCH = 'layer_mismatch',
  /** 参数/返回值描述不一致 */
  SIGNATURE_MISMATCH = 'signature_mismatch'
}
```

### 清理规则接口

```typescript
/**
 * 注释清理规则
 */
interface CleanupRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 规则描述 */
  description: string
  /** 适用的文件模式 */
  filePattern: RegExp
  /** 检测函数 */
  detect: (content: string, filePath: string) => CommentIssue[]
  /** 是否可自动修复 */
  autoFixable: boolean
}
```

## Data Models

### 清理报告数据结构

```typescript
/**
 * 单个文件的清理报告
 */
interface FileCleanupReport {
  /** 文件路径 */
  filePath: string
  /** 发现的问题列表 */
  issues: Array<{
    /** 问题类型 */
    type: CommentIssue
    /** 行号 */
    line: number
    /** 原始注释内容 */
    originalComment: string
    /** 建议的修改（如果有）*/
    suggestedFix?: string
    /** 是否已修复 */
    fixed: boolean
  }>
  /** 删除的注释数量 */
  deletedComments: number
  /** 更新的注释数量 */
  updatedComments: number
  /** 添加的注释数量 */
  addedComments: number
}

/**
 * 目录清理报告
 */
interface DirectoryCleanupReport {
  /** 目录路径 */
  directoryPath: string
  /** 文件报告列表 */
  fileReports: FileCleanupReport[]
  /** 类型检查是否通过 */
  typeCheckPassed: boolean
  /** Lint 检查是否通过 */
  lintCheckPassed: boolean
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

由于注释清理是一个以人工审查为主的任务，大部分验收标准需要人工判断语义正确性，无法通过自动化测试验证。以下是可以自动化验证的属性：

### Property 1: 类型/接口引用有效性

*For any* 注释中引用的类型或接口名称，该名称应存在于代码库的类型定义中

**Validates: Requirements 1.5, 7.2**

### Property 2: Background 目录 API 引用合规性

*For any* `background/` 目录下的注释，不应包含对 `window.*`、`document.*`、`localStorage` 的引用，且定时器应使用 `setTimeout`/`setInterval` 而非 `window.setTimeout`，存储应使用 `chrome.storage.*` 而非 `localStorage`

**Validates: Requirements 2.2, 5.1, 5.2, 5.3**

### Property 3: 术语一致性

*For any* 描述本地数据过滤操作的注释，应使用「筛选」而非「搜索」术语

**Validates: Requirements 2.5**

### Property 4: 层级描述一致性

*For any* 文件头部注释中的层级描述（如 presentation、application、infrastructure），应与文件实际所在目录匹配

**Validates: Requirements 6.2**

### Property 5: 文件路径引用有效性

*For any* 注释中引用的文件路径，该路径应存在于代码库中

**Validates: Requirements 6.3**

### Property 6: 处理顺序合规性

*For any* 目录处理操作，应按照预定义的优先级顺序执行（core → application → infrastructure → background → stores → services → presentation → components → composables → utils）

**Validates: Requirements 8.1, 8.2**

## Error Handling

### 清理过程中的错误处理

1. **文件读取错误**
   - 记录错误日志
   - 跳过该文件，继续处理其他文件
   - 在最终报告中标记为「处理失败」

2. **类型检查失败**
   - 立即停止当前目录的清理
   - 回滚该目录的所有修改
   - 提示用户手动检查

3. **注释解析错误**
   - 记录错误位置
   - 保留原始注释不做修改
   - 在报告中标记为「需人工处理」

### 回滚机制

每个目录清理前，创建备份：
- 使用 Git stash 或临时文件备份
- 类型检查失败时自动回滚
- 保留修改日志以便追溯

## Testing Strategy

### 双重测试方法

本项目采用**单元测试 + 属性测试**的双重测试策略：

- **单元测试**：验证具体的检测规则和边界情况
- **属性测试**：验证清理规则在各种输入下的一致性

### 属性测试框架

使用 **fast-check** 作为属性测试库（TypeScript 生态中最成熟的 PBT 库）。

```typescript
import fc from 'fast-check'
```

### 测试覆盖范围

1. **自动化检测规则测试**
   - 类型引用检测
   - API 引用检测
   - 术语检测
   - 层级匹配检测

2. **清理流程测试**
   - 目录处理顺序
   - 文件处理顺序
   - 类型检查集成

### 测试标注格式

每个属性测试必须使用以下格式标注：

```typescript
/**
 * **Feature: comment-cleanup, Property 1: 类型/接口引用有效性**
 * **Validates: Requirements 1.5, 7.2**
 */
```

## Implementation Notes

### 清理检查清单

每个文件清理时，按以下顺序检查：

1. **文件头部注释**
   - [ ] 职责描述是否准确
   - [ ] 层级描述是否与文件位置匹配
   - [ ] 依赖引用是否有效

2. **JSDoc 注释**
   - [ ] @param 参数名称和类型是否一致
   - [ ] @returns 描述是否准确
   - [ ] @throws 异常描述是否完整
   - [ ] 引用的类型是否存在

3. **行内注释**
   - [ ] 是否描述了「为什么」而非「是什么」
   - [ ] 是否使用正确的术语
   - [ ] 是否符合架构规范

4. **TODO/FIXME/HACK**
   - [ ] 是否已完成/修复
   - [ ] 是否有明确的上下文

5. **被注释的代码**
   - [ ] 是否为废弃代码
   - [ ] 是否有保留价值

### 常见过时注释模式

基于项目架构演进历史，以下是常见的过时注释模式：

1. **旧架构引用**
   ```typescript
   // ❌ 过时：直接调用 Chrome API
   // 调用 chrome.bookmarks.create 创建书签
   
   // ✅ 更新：通过消息通信
   // 发送 CREATE_BOOKMARK 消息到 Background Script
   ```

2. **错误的数据流描述**
   ```typescript
   // ❌ 过时：从 Chrome API 读取
   // 从 chrome.bookmarks.getTree 获取书签树
   
   // ✅ 更新：从 IndexedDB 读取
   // 从 IndexedDB 加载书签数据（唯一数据源）
   ```

3. **错误的术语**
   ```typescript
   // ❌ 过时：使用「搜索」
   // 搜索书签
   
   // ✅ 更新：使用「筛选」
   // 筛选书签（本地数据过滤）
   ```

4. **Service Worker 环境错误**
   ```typescript
   // ❌ 过时：引用 window
   // 使用 window.setTimeout 延迟执行
   
   // ✅ 更新：全局函数
   // 使用 setTimeout 延迟执行（Service Worker 环境）
   ```
