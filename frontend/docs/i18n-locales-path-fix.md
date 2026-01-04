# i18n _locales 路径修复

## 问题描述

用户将 macOS 系统语言和 Chrome 浏览器语言设置为英语后，扩展仍然显示中文。

## 根本原因

`_locales` 目录位于 `frontend/` 根目录，而不是 `frontend/public/` 目录中。Vite 构建时只会自动复制 `public/` 目录的内容到 `dist/`，导致 `_locales` 目录没有被复制到 `dist/`，Chrome 无法找到翻译文件。

## 解决方案

### 1. 移动 _locales 目录

将 `_locales` 目录从 `frontend/` 移动到 `frontend/public/`：

```bash
mv frontend/_locales frontend/public/
```

**原因**：
- Vite 会自动将 `public/` 目录的内容复制到 `dist/`
- Chrome 扩展的 `_locales` 应该在扩展根目录（即 `dist/`）
- 这样更符合 Chrome 扩展的标准结构

### 2. 更新脚本路径

更新所有引用 `_locales` 路径的脚本文件：

**修改的文件**：
1. `frontend/scripts/i18n-extract.ts`
   - `_locales/${locale}/messages.json` → `public/_locales/${locale}/messages.json`

2. `frontend/scripts/i18n-replace.ts`
   - `_locales/${locale}/messages.json` → `public/_locales/${locale}/messages.json`

3. `frontend/scripts/i18n-validate.ts`
   - `_locales` → `public/_locales`

### 3. 验证修复

```bash
# 1. 验证 i18n 配置
cd frontend
bun run i18n:validate

# 2. 重新构建扩展
bun run build

# 3. 检查 dist 目录
ls -la dist/_locales

# 4. 验证 manifest.json
cat dist/manifest.json | grep -A 2 "default_locale\|name\|description"

# 5. 检查翻译文件
cat dist/_locales/en/messages.json | head -5
```

## 验证结果

### i18n 验证通过

```
✅ 所有翻译验证通过！
  总键数: 543
  语言数: 8
  缺失翻译: 0
  空翻译: 0
  占位符不匹配: 0
```

### dist 目录结构正确

```
dist/
├── _locales/
│   ├── de/
│   ├── en/
│   ├── en_US/
│   ├── es/
│   ├── ja/
│   ├── ko/
│   ├── zh_CN/
│   └── zh_TW/
├── manifest.json
└── ...
```

### manifest.json 配置正确

```json
{
  "name": "__MSG_app_name__",
  "description": "__MSG_app_description__",
  "default_locale": "en"
}
```

### 翻译文件存在

```json
{
  "app_name": { "message": "AcuityBookmarks" },
  "app_description": { "message": "Unlock the knowledge in your bookmarks. AI-powered organization, content-aware search." }
}
```

## 用户操作步骤

现在用户需要：

1. **重新加载扩展**：
   - 打开 `chrome://extensions/`
   - 找到 AcuityBookmarks 扩展
   - 点击"重新加载"按钮

2. **验证语言切换**：
   - 打开扩展弹窗或侧边栏
   - 检查界面是否显示英文

3. **调试（如果仍然不工作）**：
   - 打开扩展的 DevTools Console
   - 运行以下命令验证：
     ```javascript
     console.log('UI Language:', chrome.i18n.getUILanguage())
     console.log('Welcome:', chrome.i18n.getMessage('welcome'))
     console.log('Settings:', chrome.i18n.getMessage('settings'))
     console.log('App Name:', chrome.i18n.getMessage('app_name'))
     ```

## 预期结果

- `chrome.i18n.getUILanguage()` 应该返回 `"en"` 或 `"en-US"`
- `chrome.i18n.getMessage('welcome')` 应该返回 `"Welcome to AcuityBookmarks!"`
- `chrome.i18n.getMessage('app_name')` 应该返回 `"AcuityBookmarks"`
- 扩展界面应该显示英文

## 相关文档

- [Chrome Extensions i18n 官方文档](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [i18n-manifest-fix.md](./i18n-manifest-fix.md) - manifest.json 配置修复
- [i18n-native-approach.md](./i18n-native-approach.md) - Chrome 原生 i18n 方案说明

## 修复时间

2025-01-04 21:40

## 修复人员

Kiro AI Assistant
