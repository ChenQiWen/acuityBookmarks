# i18n Placeholder 快速修复

## 问题描述

虽然 Chrome i18n API 工作正常，但界面上的搜索框 placeholder 仍然显示中文"筛选书签..."。

## 根本原因

Vue 组件中硬编码了中文 placeholder 文本，没有使用 i18n 服务。

## 修复内容

### 1. 修复的组件

1. **BookmarkSearchInput.vue**
   - 修改前：`placeholder="筛选书签..."`
   - 修改后：`:placeholder="t('search_placeholder')"`
   - 添加导入：`import { t } from '@/utils/i18n-helpers'`

2. **BookmarkTree.vue**
   - 修改前：`placeholder="筛选书签..."`
   - 修改后：`:placeholder="t('search_placeholder')"`
   - 添加导入：`import { t } from '@/utils/i18n-helpers'`

### 2. 使用的翻译键

`search_placeholder` 已经在所有语言包中定义：

```json
{
  "search_placeholder": { "message": "Search bookmarks..." }  // en
  "search_placeholder": { "message": "筛选书签..." }          // zh-CN
  "search_placeholder": { "message": "篩選書籤..." }          // zh-TW
  "search_placeholder": { "message": "ブックマークを検索..." }  // ja
  "search_placeholder": { "message": "북마크 검색..." }        // ko
  "search_placeholder": { "message": "Lesezeichen suchen..." } // de
  "search_placeholder": { "message": "Buscar marcadores..." }  // es
}
```

## 验证步骤

1. **重新加载扩展**：
   ```
   chrome://extensions/ → 重新加载 AcuityBookmarks
   ```

2. **检查搜索框**：
   - 打开扩展弹窗或侧边栏
   - 搜索框的 placeholder 应该显示英文 "Search bookmarks..."

3. **调试验证**：
   ```javascript
   console.log('UI Language:', chrome.i18n.getUILanguage())
   console.log('Search Placeholder:', chrome.i18n.getMessage('search_placeholder'))
   ```

## 预期结果

- ✅ 搜索框 placeholder 显示英文 "Search bookmarks..."
- ✅ 根据浏览器语言自动切换
- ✅ 支持 8 种语言

## 剩余问题

以下界面元素仍然显示中文，需要后续修复：

1. **Chrome 默认书签文件夹名称**
   - "书签栏" 应该显示为 "Bookmarks Bar"
   - "其他书签" 应该显示为 "Other Bookmarks"
   - 原因：这些名称来自 IndexedDB，需要在显示时进行翻译

2. **其他硬编码文本**
   - 按钮文本（"删除"、"取消"等）
   - 统计信息
   - 提示文本
   - 需要批量替换为 i18n 调用

## 下一步计划

### 短期（立即执行）

1. **修复 Chrome 默认文件夹名称**
   - 创建 `getLocalizedFolderName()` 函数
   - 在显示文件夹名称时调用

### 中期（本周内）

2. **修复常用按钮文本**
   - "删除"、"取消"、"确认"等
   - 使用已有的翻译键：`common_delete`, `common_cancel`, `common_confirm`

### 长期（后续迭代）

3. **全面国际化**
   - 创建自动化脚本扫描所有硬编码中文
   - 批量替换为 i18n 调用
   - 确保所有用户可见文本都国际化

## 相关文档

- [i18n-hardcoded-text-issue.md](./i18n-hardcoded-text-issue.md) - 硬编码文本问题分析
- [i18n-complete-fix-summary.md](./i18n-complete-fix-summary.md) - i18n 完整修复总结

## 修复时间

2025-01-04 22:45

## 修复人员

Kiro AI Assistant
