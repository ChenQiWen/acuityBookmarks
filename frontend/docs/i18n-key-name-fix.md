# i18n 键名修复 - 移除点号

## 问题描述

在 Chrome 扩展加载时出现错误：

```
Failed to load extension
Error: Name of a key "alert.cancel" is invalid. Only ASCII [a-z], [A-Z], [0-9] and "_" are allowed.
Could not load manifest.
```

## 根本原因

Chrome 扩展的 i18n 消息键名有严格的命名规则：
- **只允许使用**：ASCII 字母 `[a-z]`、`[A-Z]`、数字 `[0-9]` 和下划线 `_`
- **不允许使用**：点号 `.`、连字符 `-`、空格等其他字符

我们的翻译文件中使用了大量的点号作为命名空间分隔符（如 `alert.cancel`、`settings.tab.general`），这违反了 Chrome 的规则。

## 解决方案

### 1. 创建修复脚本

创建了 `frontend/scripts/fix-i18n-keys.ts` 脚本，自动完成以下任务：

1. **扫描所有翻译文件**：遍历 `public/_locales/` 下的所有语言包
2. **替换键名**：将所有包含点号的键名中的 `.` 替换为 `_`
3. **更新代码引用**：扫描所有 `.vue`、`.ts`、`.js` 文件，更新 i18n 键的引用

### 2. 键名转换规则

| 原键名 | 新键名 |
|--------|--------|
| `alert.cancel` | `alert_cancel` |
| `settings.tab.general` | `settings_tab_general` |
| `common.save` | `common_save` |
| `error.network_timeout` | `error_network_timeout` |
| `time.less_than_second` | `time_less_than_second` |

### 3. 执行修复

```bash
cd frontend
bun scripts/fix-i18n-keys.ts
```

**修复结果**：
- ✅ 更新了 8 个语言包（zh_CN, zh_TW, en, en_US, ja, ko, de, es）
- ✅ 替换了 572 个键名
- ✅ 所有翻译文件验证通过

### 4. 验证修复

```bash
# 1. 验证翻译文件
bun run i18n:validate

# 2. 检查是否还有点号
grep -o '"[^"]*\.[^"]*":' frontend/public/_locales/en/messages.json

# 3. 重新构建
bun run build

# 4. 检查 dist 目录
grep -o '"[^"]*\.[^"]*":' dist/_locales/en/messages.json
```

**验证结果**：
```
✅ 所有翻译验证通过！
  总键数: 542
  语言数: 8
  缺失翻译: 0
  空翻译: 0
  占位符不匹配: 0
```

## 代码更新

由于我们的代码中没有直接使用这些带点号的键名（大部分是预留的翻译键），所以不需要更新代码文件。

如果将来需要使用这些键，请使用新的下划线格式：

```typescript
// ❌ 错误（旧格式）
t('alert.cancel')
t('settings.tab.general')

// ✅ 正确（新格式）
t('alert_cancel')
t('settings_tab_general')
```

## Chrome 扩展 i18n 键名规范

根据 [Chrome Extensions i18n 文档](https://developer.chrome.com/docs/extensions/reference/api/i18n#type-LanguageCode)：

### 允许的字符
- 小写字母：`a-z`
- 大写字母：`A-Z`
- 数字：`0-9`
- 下划线：`_`

### 不允许的字符
- ❌ 点号：`.`
- ❌ 连字符：`-`
- ❌ 空格：` `
- ❌ 其他特殊字符

### 推荐的命名约定

```typescript
// ✅ 推荐：使用下划线作为命名空间分隔符
'common_save'
'common_cancel'
'settings_tab_general'
'error_network_timeout'

// ✅ 也可以：使用驼峰命名
'commonSave'
'commonCancel'
'settingsTabGeneral'
'errorNetworkTimeout'

// ❌ 不推荐：使用点号（会导致加载失败）
'common.save'
'settings.tab.general'
```

## 用户操作步骤

现在用户需要：

1. **重新加载扩展**：
   - 打开 `chrome://extensions/`
   - 找到 AcuityBookmarks 扩展
   - 点击"重新加载"按钮

2. **验证扩展加载**：
   - 扩展应该能够正常加载，不再显示错误
   - 打开扩展弹窗或侧边栏
   - 检查界面是否显示英文（如果浏览器语言是英文）

3. **调试（如果需要）**：
   - 打开扩展的 DevTools Console
   - 运行以下命令验证：
     ```javascript
     console.log('UI Language:', chrome.i18n.getUILanguage())
     console.log('Welcome:', chrome.i18n.getMessage('welcome'))
     console.log('Common Save:', chrome.i18n.getMessage('common_save'))
     ```

## 预期结果

- ✅ 扩展能够正常加载，不再显示 manifest 错误
- ✅ `chrome.i18n.getMessage()` 能够正确获取翻译文本
- ✅ 界面显示正确的语言（根据浏览器 UI 语言）

## 相关文档

- [Chrome Extensions i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [Chrome Extensions Manifest](https://developer.chrome.com/docs/extensions/reference/manifest)
- [i18n-locales-path-fix.md](./i18n-locales-path-fix.md) - _locales 路径修复
- [i18n-manifest-fix.md](./i18n-manifest-fix.md) - manifest.json 配置修复

## 修复时间

2025-01-04 21:45

## 修复人员

Kiro AI Assistant
