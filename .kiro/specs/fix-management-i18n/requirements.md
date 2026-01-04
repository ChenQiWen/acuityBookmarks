# Requirements Document

## Introduction

Management 界面的国际化功能未生效，界面显示的是翻译键（key）而不是翻译后的中文文本。需要诊断并修复这个问题，确保 management 页面能够正确显示中文翻译。

## Glossary

- **I18n Service**: 国际化服务，负责从 Chrome i18n API 获取翻译文本
- **Translation Key**: 翻译键，用于在语言包中查找对应的翻译文本
- **Messages.json**: Chrome 扩展的语言包文件，存储在 `_locales/{locale}/messages.json`
- **Management Page**: 书签管理页面，位于 `frontend/src/pages/management/Management.vue`
- **Chrome i18n API**: Chrome 扩展提供的国际化 API，通过 `chrome.i18n.getMessage()` 获取翻译

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望 Management 页面显示中文文本而不是翻译键，以便我能够理解界面内容。

#### Acceptance Criteria

1. WHEN 用户打开 Management 页面 THEN 系统 SHALL 显示中文翻译文本而不是 key
2. WHEN 系统调用 `t()` 函数 THEN 系统 SHALL 正确从 Chrome i18n API 获取翻译
3. WHEN 语言包文件存在对应的 key THEN 系统 SHALL 返回对应的中文翻译
4. WHEN 语言包文件不存在对应的 key THEN 系统 SHALL 返回 key 本身作为回退
5. WHEN 系统在非扩展环境运行 THEN 系统 SHALL 优雅降级并返回 key

### Requirement 2

**User Story:** 作为开发者，我希望能够诊断国际化问题，以便快速定位和修复错误。

#### Acceptance Criteria

1. WHEN 国际化服务初始化 THEN 系统 SHALL 记录调试日志
2. WHEN `t()` 函数被调用 THEN 系统 SHALL 记录 key、substitutions 和返回结果
3. WHEN Chrome i18n API 调用失败 THEN 系统 SHALL 记录错误日志
4. WHEN 在开发模式下 THEN 系统 SHALL 启用详细的调试日志
5. WHEN 语言包文件路径错误 THEN 系统 SHALL 提供清晰的错误信息

### Requirement 3

**User Story:** 作为开发者，我希望确保语言包文件正确加载，以便国际化功能正常工作。

#### Acceptance Criteria

1. WHEN 扩展加载时 THEN 系统 SHALL 从 `_locales/zh_CN/messages.json` 加载中文语言包
2. WHEN manifest.json 配置正确 THEN 系统 SHALL 识别默认语言为 zh_CN
3. WHEN 语言包文件格式正确 THEN 系统 SHALL 成功解析所有翻译条目
4. WHEN 语言包文件包含所有必需的 key THEN 系统 SHALL 能够获取所有翻译
5. WHEN 构建过程完成 THEN 系统 SHALL 将语言包文件复制到 dist 目录

### Requirement 4

**User Story:** 作为开发者，我希望验证 Management 页面的所有翻译 key 都存在于语言包中，以便避免显示 key 的情况。

#### Acceptance Criteria

1. WHEN 检查 Management.vue 中的翻译 key THEN 系统 SHALL 验证所有 key 都存在于 messages.json
2. WHEN 发现缺失的翻译 key THEN 系统 SHALL 报告缺失的 key 列表
3. WHEN 翻译 key 拼写错误 THEN 系统 SHALL 提供最接近的正确 key 建议
4. WHEN 添加新的翻译 key THEN 系统 SHALL 确保在所有语言包中都添加
5. WHEN 删除翻译 key THEN 系统 SHALL 确保代码中不再使用该 key
