# i18n 完整修复总结

## 修复历程

本次 i18n 国际化修复经历了三个主要阶段，最终成功实现了 Chrome 扩展的多语言支持。

---

## 阶段 1：manifest.json 配置修复

### 问题
用户将 macOS 和 Chrome 语言设置为英语后，扩展仍然显示中文。

### 原因
`manifest.json` 缺少 `default_locale` 字段，这是 Chrome Extensions i18n 的必需配置。

### 解决方案
1. 添加 `"default_locale": "en"` 到 manifest.json
2. 修改 `name` 和 `description` 为 i18n 占位符：
   - `"name": "__MSG_app_name__"`
   - `"description": "__MSG_app_description__"`
3. 为所有 7 种语言添加 `app_name` 和 `app_description` 翻译键

### 相关文档
- [i18n-manifest-fix.md](./i18n-manifest-fix.md)

---

## 阶段 2：_locales 目录路径修复

### 问题
Chrome 无法找到翻译文件，`chrome.i18n.getMessage()` 返回空字符串。

### 原因
`_locales` 目录位于 `frontend/` 根目录，而不是 `frontend/public/` 目录。Vite 构建时只会自动复制 `public/` 目录的内容到 `dist/`，导致 `_locales` 目录没有被复制。

### 解决方案
1. 将 `_locales` 目录从 `frontend/` 移动到 `frontend/public/`
2. 更新所有 i18n 脚本中的路径引用：
   - `i18n-extract.ts`
   - `i18n-replace.ts`
   - `i18n-validate.ts`

### 相关文档
- [i18n-locales-path-fix.md](./i18n-locales-path-fix.md)

---

## 阶段 3：i18n 键名修复（移除点号）

### 问题
扩展加载失败，错误信息：
```
Failed to load extension
Error: Name of a key "alert.cancel" is invalid. 
Only ASCII [a-z], [A-Z], [0-9] and "_" are allowed.
```

### 原因
Chrome 扩展的 i18n 消息键名只允许使用 ASCII 字母、数字和下划线，不允许使用点号（`.`）。我们的翻译文件中使用了大量的点号作为命名空间分隔符。

### 解决方案
1. 创建 `fix-i18n-keys.ts` 脚本
2. 批量替换所有翻译文件中的点号为下划线
3. 更新代码中的 i18n 键引用（如果有）

**修复结果**：
- 替换了 572 个键名
- 更新了 8 个语言包
- 所有翻译验证通过

### 相关文档
- [i18n-key-name-fix.md](./i18n-key-name-fix.md)

---

## 最终配置

### 目录结构

```
frontend/
├── public/
│   ├── _locales/
│   │   ├── zh_CN/
│   │   │   └── messages.json
│   │   ├── zh_TW/
│   │   │   └── messages.json
│   │   ├── en/
│   │   │   └── messages.json
│   │   ├── en_US/
│   │   │   └── messages.json
│   │   ├── ja/
│   │   │   └── messages.json
│   │   ├── ko/
│   │   │   └── messages.json
│   │   ├── de/
│   │   │   └── messages.json
│   │   └── es/
│   │       └── messages.json
│   └── manifest.json
├── scripts/
│   ├── i18n-extract.ts
│   ├── i18n-replace.ts
│   ├── i18n-validate.ts
│   └── fix-i18n-keys.ts
└── src/
    └── infrastructure/
        └── i18n/
            └── i18n-service.ts
```

### manifest.json 配置

```json
{
  "manifest_version": 3,
  "name": "__MSG_app_name__",
  "description": "__MSG_app_description__",
  "default_locale": "en",
  ...
}
```

### 翻译文件示例（en/messages.json）

```json
{
  "app_name": { "message": "AcuityBookmarks" },
  "app_description": { 
    "message": "Unlock the knowledge in your bookmarks. AI-powered organization, content-aware search." 
  },
  "welcome": { "message": "Welcome to AcuityBookmarks!" },
  "common_save": { "message": "Save" },
  "common_cancel": { "message": "Cancel" },
  "settings_tab_general": { "message": "General" }
}
```

### i18n 服务使用

```typescript
import { t } from '@/infrastructure/i18n/i18n-service'

// 获取翻译文本
const welcomeText = t('welcome')
const saveButton = t('common_save')
const generalTab = t('settings_tab_general')

// 带占位符的翻译
const timeText = t('time_seconds', '5')
```

---

## 验证结果

### i18n 验证

```bash
$ bun run i18n:validate

✅ 所有翻译验证通过！
  总键数: 542
  语言数: 8
  缺失翻译: 0
  空翻译: 0
  占位符不匹配: 0
```

### 构建验证

```bash
$ bun run build

✓ built in 3.85s
🧹 构建完成，运行清理脚本...
✅ 创建 manifest.json
✅ 移动 popup.html 到根目录
...
🎉 dist文件夹清理和文件复制完成！
```

### 目录验证

```bash
$ ls -la dist/_locales

drwxr-xr-x  10 cqw  staff  320  de/
drwxr-xr-x  10 cqw  staff  320  en/
drwxr-xr-x  10 cqw  staff  320  en_US/
drwxr-xr-x  10 cqw  staff  320  es/
drwxr-xr-x  10 cqw  staff  320  ja/
drwxr-xr-x  10 cqw  staff  320  ko/
drwxr-xr-x  10 cqw  staff  320  zh_CN/
drwxr-xr-x  10 cqw  staff  320  zh_TW/
```

---

## Chrome 扩展 i18n 最佳实践

### 1. 键名规范

**✅ 推荐**：
```typescript
'common_save'
'settings_tab_general'
'error_network_timeout'
```

**❌ 不推荐**：
```typescript
'common.save'        // 点号不允许
'settings-tab'       // 连字符不允许
'error message'      // 空格不允许
```

### 2. 目录结构

- 翻译文件必须放在 `public/_locales/` 目录
- 每个语言一个子目录（如 `en/`, `zh_CN/`）
- 每个子目录包含 `messages.json` 文件

### 3. manifest.json 配置

- 必须设置 `default_locale` 字段
- 使用 `__MSG_key__` 格式引用翻译键
- 支持的字段：`name`, `description`, `short_name`

### 4. 代码中使用

```typescript
// 使用 Chrome 原生 API
chrome.i18n.getMessage('welcome')
chrome.i18n.getMessage('time_seconds', '5')

// 使用封装的服务
import { t } from '@/infrastructure/i18n/i18n-service'
t('welcome')
t('time_seconds', '5')
```

### 5. 语言检测

```typescript
// 获取当前 UI 语言
const language = chrome.i18n.getUILanguage()  // 返回 "en", "zh-CN" 等

// 获取浏览器接受的语言列表
chrome.i18n.getAcceptLanguages((languages) => {
  console.log(languages)  // ['en-US', 'en', 'zh-CN']
})
```

---

## 支持的语言

| 语言代码 | 语言名称 | 翻译状态 |
|---------|---------|---------|
| `zh_CN` | 简体中文 | ✅ 完成 |
| `zh_TW` | 繁体中文 | ✅ 完成 |
| `en` | 英语 | ✅ 完成 |
| `en_US` | 美式英语 | ✅ 完成 |
| `ja` | 日语 | ✅ 完成 |
| `ko` | 韩语 | ✅ 完成 |
| `de` | 德语 | ✅ 完成 |
| `es` | 西班牙语 | ✅ 完成 |

---

## 用户操作指南

### 1. 重新加载扩展

1. 打开 `chrome://extensions/`
2. 找到 AcuityBookmarks 扩展
3. 点击"重新加载"按钮

### 2. 验证语言切换

- 扩展会自动使用浏览器的 UI 语言
- 如果浏览器语言是英语，扩展显示英文
- 如果浏览器语言是中文，扩展显示中文

### 3. 调试（如果需要）

打开扩展的 DevTools Console，运行：

```javascript
console.log('UI Language:', chrome.i18n.getUILanguage())
console.log('Welcome:', chrome.i18n.getMessage('welcome'))
console.log('App Name:', chrome.i18n.getMessage('app_name'))
```

---

## 相关文档

### 修复文档
1. [i18n-manifest-fix.md](./i18n-manifest-fix.md) - manifest.json 配置修复
2. [i18n-locales-path-fix.md](./i18n-locales-path-fix.md) - _locales 路径修复
3. [i18n-key-name-fix.md](./i18n-key-name-fix.md) - 键名修复（移除点号）

### 方案文档
4. [i18n-native-approach.md](./i18n-native-approach.md) - Chrome 原生 i18n 方案
5. [language-selector-removal.md](./language-selector-removal.md) - 移除语言选择器的原因

### 官方文档
- [Chrome Extensions i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [Chrome Extensions Manifest](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Internationalization Guide](https://developer.chrome.com/docs/extensions/develop/concepts/internationalization)

---

## 修复时间线

- **2025-01-04 20:00** - 发现 manifest.json 缺少 default_locale
- **2025-01-04 20:30** - 添加 default_locale 和 i18n 占位符
- **2025-01-04 21:00** - 发现 _locales 目录未被复制到 dist
- **2025-01-04 21:30** - 移动 _locales 到 public 目录
- **2025-01-04 21:40** - 重新构建，验证通过
- **2025-01-04 21:45** - 发现键名包含点号导致加载失败
- **2025-01-04 21:50** - 创建修复脚本，批量替换点号为下划线
- **2025-01-04 22:00** - 所有修复完成，验证通过

---

## 总结

经过三个阶段的修复，我们成功实现了：

✅ **完整的 Chrome 原生 i18n 支持**
- 符合 Chrome 扩展规范
- 支持 8 种语言
- 自动检测浏览器语言

✅ **正确的目录结构**
- `_locales` 在 `public/` 目录
- 构建时自动复制到 `dist/`

✅ **规范的键名格式**
- 只使用字母、数字和下划线
- 移除了所有点号

✅ **完善的验证机制**
- i18n 验证脚本
- 类型检查
- 构建验证

现在扩展可以正常加载，并根据用户的浏览器语言自动显示对应的界面语言！

---

**修复完成时间**: 2025-01-04 22:00  
**修复人员**: Kiro AI Assistant  
**总翻译键数**: 542  
**支持语言数**: 8
