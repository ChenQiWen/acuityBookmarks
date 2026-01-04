# i18n 硬编码文本问题

## 问题描述

虽然 Chrome i18n API 工作正常（`chrome.i18n.getUILanguage()` 返回 `"en-US"`，`chrome.i18n.getMessage()` 能正确获取英文翻译），但界面仍然显示中文。

## 根本原因

代码中存在大量硬编码的中文文本，这些文本没有使用 i18n 服务，而是直接写在 Vue 组件的模板中。

### 硬编码文本位置

1. **Placeholder 文本**：
   - `BookmarkSearchInput.vue`: `placeholder="筛选书签..."`
   - `BookmarkTree.vue`: `placeholder="筛选书签..."`
   - `SidePanel.vue`: `placeholder="书签名称或者URL"`
   - `QuickAddBookmarkDialog.vue`: `placeholder="书签名称"`
   - `EmbeddingSettings.vue`: `placeholder="默认300"`, `placeholder="默认150"`
   - `AccountSettings.vue`: `placeholder="输入 6 位验证码"`, `placeholder="至少8位，包含字母和数字"`

2. **按钮文本**：
   - 各种组件中的"删除"、"取消"、"确认"等按钮文本

3. **标签文本**：
   - 各种组件中的标签、提示文本

4. **日志文本**：
   - Service 和 Store 中的中文日志（这些不影响界面，但应该保持中文以便调试）

## 解决方案

### 方案 1：批量替换硬编码文本（推荐）

创建一个脚本，自动完成以下任务：

1. **扫描所有 Vue 组件**，找出硬编码的中文文本
2. **生成翻译键**，添加到所有语言包
3. **替换组件代码**，使用 `t()` 函数或 `v-t` 指令

**优点**：
- 一次性解决所有问题
- 确保所有文本都国际化
- 符合最佳实践

**缺点**：
- 工作量较大
- 需要仔细测试

### 方案 2：手动修复关键界面（快速修复）

只修复用户可见的关键界面文本：

1. **搜索框 placeholder**
2. **按钮文本**
3. **统计信息**

**优点**：
- 快速见效
- 工作量小

**缺点**：
- 不彻底
- 后续还需要继续修复

## 特殊情况：Chrome 书签文件夹名称

用户看到的"自由书签"（应该是"Bookmarks Bar"）和"Other Bookmarks"是 Chrome 浏览器提供的默认书签文件夹名称。

### 问题分析

Chrome API 返回的书签文件夹名称会根据浏览器语言自动本地化：
- 英文浏览器：`"Bookmarks Bar"`, `"Other Bookmarks"`
- 中文浏览器：`"书签栏"`, `"其他书签"`

但如果这些名称是从 IndexedDB 读取的，可能会出现以下情况：
1. 用户之前使用中文浏览器，书签同步到 IndexedDB 时保存了中文名称
2. 用户切换到英文浏览器后，从 IndexedDB 读取的仍然是中文名称

### 解决方案

在显示书签文件夹名称时，检测是否为 Chrome 默认文件夹，如果是，则根据当前语言进行翻译：

```typescript
function getLocalizedFolderName(folderName: string): string {
  const language = chrome.i18n.getUILanguage()
  
  // Chrome 默认文件夹名称映射
  const folderNameMap: Record<string, Record<string, string>> = {
    '书签栏': {
      'en': 'Bookmarks Bar',
      'en-US': 'Bookmarks Bar',
      'zh-CN': '书签栏',
      'zh-TW': '書籤列'
    },
    'Bookmarks Bar': {
      'en': 'Bookmarks Bar',
      'en-US': 'Bookmarks Bar',
      'zh-CN': '书签栏',
      'zh-TW': '書籤列'
    },
    '其他书签': {
      'en': 'Other Bookmarks',
      'en-US': 'Other Bookmarks',
      'zh-CN': '其他书签',
      'zh-TW': '其他書籤'
    },
    'Other Bookmarks': {
      'en': 'Other Bookmarks',
      'en-US': 'Other Bookmarks',
      'zh-CN': '其他书签',
      'zh-TW': '其他書籤'
    }
  }
  
  // 如果是 Chrome 默认文件夹，返回本地化名称
  if (folderNameMap[folderName]) {
    return folderNameMap[folderName][language] || folderName
  }
  
  // 否则返回原名称
  return folderName
}
```

## 推荐行动计划

### 阶段 1：快速修复（立即执行）

1. **修复搜索框 placeholder**
   - 添加翻译键：`search_placeholder: "Search bookmarks..."`
   - 修改组件：`placeholder="筛选书签..."` → `:placeholder="t('search_placeholder')"`

2. **修复 Chrome 默认文件夹名称**
   - 创建 `getLocalizedFolderName()` 函数
   - 在显示文件夹名称时调用此函数

### 阶段 2：全面国际化（后续执行）

1. **创建自动化脚本**
   - 扫描所有硬编码中文
   - 生成翻译键
   - 自动替换代码

2. **添加翻译**
   - 为所有硬编码文本添加翻译
   - 支持 8 种语言

3. **测试验证**
   - 切换不同语言测试
   - 确保所有文本正确显示

## 相关文档

- [i18n-complete-fix-summary.md](./i18n-complete-fix-summary.md) - i18n 完整修复总结
- [Chrome Extensions i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)

## 创建时间

2025-01-04 22:30

## 创建人员

Kiro AI Assistant
