# 语言选择器修复说明

## 修复历史

### 修复 #2: 语言切换无反应（2025-01-03）

**问题描述**

点击语言选择器切换语言后，没有任何反应，扩展不会重新加载。

**问题原因**

在 `changeLanguage` 函数中，逻辑错误导致函数提前返回：

```typescript
// ❌ 问题代码
async function changeLanguage(newLanguage: string) {
  if (newLanguage === selectedLanguage.value) {
    return // 总是返回，因为 v-model 已经更新了 selectedLanguage
  }
  // ... 永远不会执行到这里
}
```

当用户选择新语言时：
1. `v-model` 立即更新 `selectedLanguage.value` 为新值
2. `@change` 事件触发，调用 `changeLanguage(selectedLanguage)`
3. 此时 `newLanguage === selectedLanguage.value` 总是 `true`
4. 函数直接返回，不执行任何切换逻辑

**解决方案**

引入 `previousLanguage` 来跟踪上一次的语言，并修改事件处理：

```typescript
// ✅ 修复后
const selectedLanguage = ref<string>('zh-CN')
const previousLanguage = ref<string>('zh-CN')

async function changeLanguage() {
  const newLanguage = selectedLanguage.value
  
  // 与上一次的语言比较
  if (newLanguage === previousLanguage.value) {
    return
  }
  
  // 保存并重新加载
  await chrome.storage.local.set({ userLanguage: newLanguage })
  setTimeout(() => {
    chrome.runtime.reload()
  }, 300)
}
```

模板中的事件绑定也简化为：

```vue
<select v-model="selectedLanguage" @change="changeLanguage">
```

**验证**

```bash
✅ TypeScript 类型检查通过
✅ ESLint 检查通过
✅ 功能测试：切换语言后扩展正确重新加载
```

---

### 修复 #1: 显示翻译键而不是语言名称（2025-01-03）

## 问题描述

语言选择器下拉框显示的是翻译键（如 `language.name.zh_CN`）而不是实际的语言名称（如"简体中文"）。

## 问题原因

最初的实现尝试通过 Chrome i18n API 动态翻译语言名称：

```typescript
// ❌ 原实现
const supportedLanguages = [
  { code: 'zh-CN', name: 'zh_CN' },
  // ...
]

const getLanguageName = (code: string) => {
  const lang = supportedLanguages.find(l => l.code === code)
  return lang ? t(`language.name.${lang.name}`) : code
}
```

这种方式存在问题，因为：
1. Chrome i18n API 在某些情况下可能不支持复杂的键名格式
2. 语言名称本身就应该用该语言显示，不需要根据当前界面语言翻译

## 解决方案

直接在组件中硬编码语言的本地化名称：

```typescript
// ✅ 修复后
const supportedLanguages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' }
] as const

const getLanguageName = (code: string) => {
  const lang = supportedLanguages.find(l => l.code === code)
  return lang ? lang.name : code
}
```

## 设计理念

语言名称应该始终用该语言本身显示，这是国际化的最佳实践：

- ✅ 用户可以轻松识别自己的语言，无论当前界面使用什么语言
- ✅ 符合用户期望（例如在任何界面语言下，日语都显示为"日本語"）
- ✅ 避免了翻译键管理的复杂性
- ✅ 性能更好（无需查询翻译）

## 示例

无论当前界面语言是什么，语言选择器都会显示：

```
简体中文
繁體中文
English
日本語
한국어
Deutsch
Español
```

这样用户可以立即找到自己熟悉的语言。

## 修改的文件

1. `frontend/src/components/LanguageSelector.vue` - 修改语言列表和获取名称的逻辑
2. `frontend/src/components/LanguageSelector.README.md` - 更新文档说明
3. `frontend/docs/language-selector-usage.md` - 更新使用指南
4. `frontend/docs/appheader-language-integration.md` - 更新集成说明

## 验证

```bash
✅ TypeScript 类型检查通过
✅ ESLint 检查通过
✅ Stylelint 检查通过
```

## 更新日志

**2025-01-03**
- 🐛 修复语言选择器显示翻译键而不是语言名称的问题
- ✨ 改用硬编码的本地化语言名称
- 📝 更新相关文档

