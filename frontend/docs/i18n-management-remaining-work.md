# Management 页面 i18n 剩余工作

## 当前状态

Management.vue 页面已经大量使用了 `t()` 函数进行国际化，但仍有少量硬编码的中文文本需要修复。

## 已完成

✅ 大部分界面文本已使用 i18n
✅ 搜索框 placeholder 已修复
✅ 统计信息的标签已使用 i18n（"已选择"、"条书签"、"个文件夹"）
✅ "清除选择"按钮已使用 i18n

## 剩余硬编码文本

### 1. 删除确认对话框（行 669-672）

**当前代码**：
```vue
<div class="confirm-content">
  是否确认删除所选的 {{ selectedCounts.bookmarks }} 条书签、{{
    selectedCounts.folders
  }}
  个文件夹？
</div>
```

**需要修改为**：
```vue
<div class="confirm-content">
  {{ t('management_confirm_delete_selected_message', 
      String(selectedCounts.bookmarks), 
      String(selectedCounts.folders)) }}
</div>
```

**需要添加的翻译键**：
```json
{
  "management_confirm_delete_selected_message": {
    "message": "Are you sure you want to delete $1 bookmark(s) and $2 folder(s)?"
  }
}
```

### 2. 删除确认对话框的按钮（行 676-677）

**当前代码**：
```vue
<Button variant="text" @click="requestClose(false)">
  取消
</Button>
```

**需要修改为**：
```vue
<Button variant="text" @click="requestClose(false)">
  {{ t('common_cancel') }}
</Button>
```

**翻译键**：已存在 `common_cancel`

### 3. 删除文件夹确认对话框（行 751-752）

**当前代码**：
```vue
<div class="confirm-content">
  是否确认删除该目录及其包含的 {{ deleteFolderBookmarkCount }} 条书签？
</div>
```

**需要修改为**：
```vue
<div class="confirm-content">
  {{ t('management_confirm_delete_folder_message', String(deleteFolderBookmarkCount)) }}
</div>
```

**需要添加的翻译键**：
```json
{
  "management_confirm_delete_folder_message": {
    "message": "Are you sure you want to delete this folder and its $1 bookmark(s)?"
  }
}
```

### 4. 代码注释中的中文（不影响界面）

以下是代码注释中的中文，不影响用户界面，可以保留：

- 行 1741: `// 当检测到外部书签变更时（如 Chrome Sync、其他设备、书签管理器）`
- 行 1975: `// 统计右侧树数据中的实际书签和文件夹数量（用于调试和验证）`
- 行 2236: `// 过滤出书签（有 URL 的），排除文件夹和 Chrome 内部链接`
- 行 2251: `// 调用 AI 整理服务（发送标题、URL 和元数据，用于分类判断）`
- 行 2270: `recordIdToCategory.set(result.id, result.category || '其他')`
- 行 2286: `new Set(results.map(r => r.category || '其他'))`
- 行 2358: `const category = recordIdToCategory.get(String(record.id)) || '其他'`
- 行 2361: `// 保留原始记录的所有字段，只更新 parentId、index 和路径相关字段`

**注意**：这些是代码逻辑中的默认值（如 `'其他'` 作为默认分类名），这些应该保留为中文，因为它们是数据值，不是界面文本。

### 5. 代码逻辑中的中文字符串（不需要翻译）

- 行 1031: `parts.join('和')` - 这是用于拼接文本的连接词，应该使用 i18n
- 行 2270, 2286, 2358: `'其他'` - 这是 AI 分类的默认类别名，是数据值，不是界面文本

## 修复优先级

### 高优先级（用户可见）

1. ✅ 统计信息（"已选择 X 条书签 Y 个文件夹"）- 已修复
2. ✅ "清除选择"按钮 - 已修复
3. ⚠️ 删除确认对话框的消息
4. ⚠️ 删除确认对话框的按钮

### 中优先级（代码逻辑）

5. `parts.join('和')` - 应该使用 i18n 的连接词

### 低优先级（不影响界面）

6. 代码注释中的中文 - 可以保留
7. 数据值中的中文（如 `'其他'`）- 应该保留

## 需要添加的翻译键

### 英文（en/messages.json）

```json
{
  "management_confirm_delete_selected_message": {
    "message": "Are you sure you want to delete $1 bookmark(s) and $2 folder(s)?"
  },
  "management_confirm_delete_folder_message": {
    "message": "Are you sure you want to delete this folder and its $1 bookmark(s)?"
  },
  "management_and": {
    "message": " and "
  }
}
```

### 中文（zh_CN/messages.json）

```json
{
  "management_confirm_delete_selected_message": {
    "message": "是否确认删除所选的 $1 条书签和 $2 个文件夹？"
  },
  "management_confirm_delete_folder_message": {
    "message": "是否确认删除该目录及其包含的 $1 条书签？"
  },
  "management_and": {
    "message": "和"
  }
}
```

## 下一步行动

1. **添加缺失的翻译键**到所有 8 种语言
2. **修复 Management.vue** 中的硬编码文本
3. **测试验证**：重新构建并测试删除功能
4. **运行验证**：`bun run i18n:validate`

## 预计工作量

- 添加翻译键：10 分钟
- 修复代码：5 分钟
- 测试验证：5 分钟
- **总计**：约 20 分钟

## 相关文档

- [i18n-placeholder-fix.md](./i18n-placeholder-fix.md) - Placeholder 修复
- [i18n-complete-fix-summary.md](./i18n-complete-fix-summary.md) - 完整修复总结

## 创建时间

2025-01-04 23:00

## 创建人员

Kiro AI Assistant
