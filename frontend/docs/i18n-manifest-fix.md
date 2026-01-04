# Manifest.json i18n 配置修复

## 📋 问题

用户在 macOS 上设置了英语作为 Chrome 语言，但扩展仍然显示中文。

## 🔍 根本原因

`manifest.json` 中**缺少 `default_locale` 字段**，这是 Chrome Extensions i18n 的必需配置。

根据 [Chrome Extensions i18n 官方文档](https://developer.chrome.com/docs/extensions/reference/api/i18n)：

> 如果扩展使用了 `_locales` 目录，**必须**在 manifest.json 中指定 `default_locale` 字段。

## ✅ 修复内容

### 1. 添加 `default_locale` 字段

```json
{
  "manifest_version": 3,
  "name": "__MSG_app_name__",
  "description": "__MSG_app_description__",
  "default_locale": "en",
  ...
}
```

**关键点**：
- `default_locale` 设置为 `"en"`（英语）
- `name` 和 `description` 改为使用 i18n 消息引用（`__MSG_xxx__`）
- 这样 Chrome 会根据用户的浏览器语言自动选择对应的翻译

### 2. 添加 `app_description` 翻译

为所有 7 种语言添加了 `app_description` 翻译键：

| 语言 | app_description |
|-----|----------------|
| en | Unlock the knowledge in your bookmarks. AI-powered organization, content-aware search. |
| zh-CN | 解锁书签中的知识。AI 驱动的组织管理，内容感知搜索。 |
| zh-TW | 解鎖書籤中的知識。AI 驅動的組織管理，內容感知搜尋。 |
| ja | ブックマークの知識を解き放つ。AI駆動の整理、コンテンツ認識検索。 |
| ko | 북마크의 지식을 잠금 해제하세요. AI 기반 정리, 콘텐츠 인식 검색. |
| de | Erschließen Sie das Wissen in Ihren Lesezeichen. KI-gestützte Organisation, inhaltsbewusste Suche. |
| es | Desbloquea el conocimiento en tus marcadores. Organización impulsada por IA, búsqueda consciente del contenido. |

## 🎯 工作原理

### 修复前

```json
{
  "name": "AcuityBookmarks",
  "description": "Unlock the knowledge...",
  // ❌ 缺少 default_locale
}
```

**问题**：
- Chrome 不知道如何处理 `_locales` 目录
- 可能使用错误的语言或忽略用户的语言设置

### 修复后

```json
{
  "name": "__MSG_app_name__",
  "description": "__MSG_app_description__",
  "default_locale": "en"
}
```

**工作流程**：
1. Chrome 检测到 `default_locale: "en"`
2. Chrome 读取用户的浏览器语言（如 `zh-CN`）
3. Chrome 尝试加载 `_locales/zh_CN/messages.json`
4. 如果找到，使用中文翻译
5. 如果没找到，回退到 `_locales/en/messages.json`（默认语言）
6. 替换 `__MSG_app_name__` 为对应语言的 `app_name` 值

## 📝 修改的文件

1. **manifest.json**
   - 添加 `default_locale: "en"`
   - 修改 `name` 为 `__MSG_app_name__`
   - 修改 `description` 为 `__MSG_app_description__`

2. **所有语言的 messages.json**
   - 添加 `app_description` 翻译键

## 🧪 测试步骤

### 1. 重新构建扩展

```bash
cd frontend
bun run build
```

### 2. 重新加载扩展

1. 访问 `chrome://extensions/`
2. 找到 AcuityBookmarks
3. 点击"重新加载"按钮

### 3. 验证语言

在扩展的 Console 中运行：

```javascript
chrome.i18n.getUILanguage()
// 应该返回你的浏览器语言，如 'en', 'zh-CN' 等
```

### 4. 检查扩展名称

在 `chrome://extensions/` 页面，扩展的名称应该显示为对应语言：
- 英语：AcuityBookmarks
- 简体中文：Acuity书签
- 繁体中文：Acuity書籤
- 日语：Acuityブックマーク
- 韩语：Acuity북마크

## 🔧 macOS 特殊说明

在 macOS 上，Chrome 的界面语言由以下方式决定（按优先级）：

1. **应用特定语言设置**（如果设置了）
   ```bash
   defaults write com.google.Chrome AppleLanguages '("en")'
   ```

2. **系统语言设置**
   系统设置 → 通用 → 语言与地区 → 首选语言

3. **default_locale**（如果以上都没有匹配的语言）

### 如果仍然显示中文

请尝试以下步骤：

1. **完全退出 Chrome**（Command + Q）
2. **清除 Chrome 的语言缓存**：
   ```bash
   defaults delete com.google.Chrome AppleLanguages
   ```
3. **重新设置为英语**：
   ```bash
   defaults write com.google.Chrome AppleLanguages '("en")'
   ```
4. **重新打开 Chrome**
5. **重新加载扩展**

## ✅ 验证结果

```bash
✅ i18n 验证通过（543 个翻译键，7 种语言）
✅ TypeScript 类型检查通过
✅ ESLint 检查通过
```

## 📚 相关资源

- [Chrome Extensions i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [Manifest V3 国际化](https://developer.chrome.com/docs/extensions/mv3/i18n/)
- [default_locale 文档](https://developer.chrome.com/docs/extensions/mv3/manifest/default_locale/)

## 🎉 总结

通过添加 `default_locale` 字段和使用 `__MSG_xxx__` 引用，我们的扩展现在完全符合 Chrome Extensions i18n 规范：

1. ✅ Chrome 可以正确识别和加载语言文件
2. ✅ 扩展名称和描述会根据用户语言自动翻译
3. ✅ 扩展界面会根据浏览器语言自动切换
4. ✅ 如果用户语言不在支持列表中，会回退到英语（default_locale）

---

**修复日期**: 2025-01-03  
**影响**: 所有用户  
**状态**: ✅ 已完成

