# 语言选择器移除说明

## 📋 概述

我们移除了语言选择器组件，改为完全使用 Chrome Extensions 原生的浏览器语言机制。

## 🎯 移除原因

### 1. 不符合 Chrome 原生标准

根据 [Chrome Extensions i18n 官方文档](https://developer.chrome.com/docs/extensions/reference/api/i18n)：

- Chrome 扩展的语言是在**加载时**由浏览器的 UI 语言决定的
- **没有官方 API** 可以让扩展在运行时切换语言
- 语言由 `chrome.i18n.getUILanguage()` 返回，无法修改

### 2. 之前的实现存在问题

我们之前的语言选择器实现：

```typescript
// ❌ 问题实现
// 1. 保存用户偏好到 chrome.storage.local
await chrome.storage.local.set({ userLanguage: 'ja' })

// 2. 重新加载扩展
chrome.runtime.reload()

// 3. 但是...
// Chrome 仍然根据浏览器 UI 语言加载 _locales
// 我们保存的 userLanguage 不会被 Chrome 使用
```

**问题**：
- ❌ `chrome.storage.local` 中的 `userLanguage` 不会影响 Chrome 的语言选择
- ❌ Chrome 仍然使用 `chrome.i18n.getUILanguage()` 返回的浏览器语言
- ❌ 即使重新加载扩展，语言也不会改变（除非浏览器语言改变了）

### 3. 违反设计原则

Chrome Extensions 的设计哲学：

- ✅ 扩展应该与浏览器保持一致
- ✅ 扩展的语言应该跟随浏览器的语言
- ❌ 扩展不应该有独立于浏览器的语言设置

**如果扩展语言与浏览器语言不一致**：
- 用户会感到困惑
- 违反用户期望
- 增加维护成本

## 🔄 新的语言切换方式

### 用户如何切换语言？

1. 打开 Chrome 设置：`chrome://settings/languages`
2. 在"首选语言"部分，点击"添加语言"
3. 选择想要的语言并添加
4. 点击语言旁边的三个点，选择"以这种语言显示 Google Chrome"
5. 重启浏览器
6. 扩展会自动使用新语言

### 工作流程

```
用户更改浏览器语言
    ↓
重启浏览器
    ↓
chrome.i18n.getUILanguage() 返回新语言
    ↓
Chrome 自动加载对应的 _locales 文件夹
    ↓
扩展显示新语言
```

## 📝 移除的内容

### 删除的文件

1. **组件**
   - `frontend/src/components/LanguageSelector.vue`
   - `frontend/src/components/LanguageSelector.README.md`

2. **文档**
   - `frontend/docs/language-selector-usage.md`
   - `frontend/docs/appheader-language-integration.md`
   - `frontend/docs/language-selector-test.md`
   - `frontend/docs/language-selector-summary.md`
   - `frontend/docs/language-selector-fix.md`

### 修改的文件

1. **AppHeader.vue**
   - 移除 `LanguageSelector` 组件的导入
   - 移除 `showLanguage` prop
   - 移除语言选择器相关的样式

2. **i18n-service.ts**
   - 移除 `getUserLanguage()` 方法
   - 移除 `setUserLanguage()` 方法
   - 简化 `getCurrentLanguage()` 方法的注释

### 保留的内容

- ✅ `chrome.i18n.getMessage()` 的封装
- ✅ `chrome.i18n.getUILanguage()` 的封装
- ✅ Vue Composable (`useI18n()`)
- ✅ 所有 7 种语言的翻译文件
- ✅ i18n 验证脚本

## ✅ 优势

### 1. 完全符合 Chrome 标准

- ✅ 使用 Chrome 原生 i18n API
- ✅ 遵循 Chrome Extensions 最佳实践
- ✅ 不需要 hack 或 workaround

### 2. 代码更简单

**之前**：
- 语言选择器组件（~150 行）
- 用户语言存储逻辑
- 扩展重新加载逻辑
- 语言同步逻辑
- 相关文档（~1000 行）

**现在**：
- 只需要 `chrome.i18n.getMessage()`
- 只需要 `chrome.i18n.getUILanguage()`
- 代码减少 ~90%

### 3. 用户体验更一致

- ✅ 扩展语言与浏览器语言保持一致
- ✅ 符合用户期望
- ✅ 避免混淆

### 4. 维护成本更低

- ✅ 不需要维护语言选择器组件
- ✅ 不需要处理语言切换的边缘情况
- ✅ 不需要测试语言切换功能

## 📚 相关文档

- [Chrome Extensions i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [AcuityBookmarks 国际化方案说明](./i18n-native-approach.md)

## 🎓 给用户的说明

如果用户询问如何切换语言，可以这样回答：

> AcuityBookmarks 的界面语言会自动跟随您的浏览器语言。
> 
> 如需更改语言，请：
> 1. 打开 Chrome 设置：chrome://settings/languages
> 2. 在"首选语言"中添加或选择您想要的语言
> 3. 点击"以这种语言显示 Google Chrome"
> 4. 重启浏览器
> 
> 扩展会自动使用新的语言显示。

## 📊 影响评估

### 对用户的影响

- ✅ 大多数用户不会注意到变化（因为扩展语言本来就跟随浏览器）
- ✅ 想要切换语言的用户需要通过浏览器设置（更标准的方式）
- ⚠️ 少数想要扩展语言与浏览器语言不同的用户无法实现（但这本来就不是 Chrome 支持的用例）

### 对开发的影响

- ✅ 代码更简单，更易维护
- ✅ 完全符合 Chrome 标准
- ✅ 减少了潜在的 bug
- ✅ 减少了文档维护工作

## ✅ 验证

```bash
# 类型检查
bun run typecheck
✅ 通过

# 代码规范
bun run lint
✅ 通过

# 样式检查
bun run stylelint
✅ 通过

# i18n 验证
bun run i18n:validate
✅ 通过（542 个翻译键，7 种语言）
```

## 🎯 总结

移除语言选择器是正确的决定，因为：

1. ✅ **符合标准**：完全遵循 Chrome Extensions i18n 规范
2. ✅ **代码简化**：减少了 90% 的相关代码
3. ✅ **用户体验**：扩展语言与浏览器语言保持一致
4. ✅ **易于维护**：不需要维护复杂的语言切换逻辑

Chrome Extensions 的设计哲学就是让扩展与浏览器保持一致，我们现在完全遵循了这个原则。

---

**日期**: 2025-01-03  
**版本**: 2.0.0  
**状态**: ✅ 已完成

