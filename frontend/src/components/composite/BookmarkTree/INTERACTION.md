# BookmarkTree 交互设计文档

## 📖 概述

BookmarkTree 组件采用统一的交互逻辑，确保在所有场景下行为一致且符合用户直觉。

## 🎯 核心设计原则

1. **点击书签 = 打开书签**：这是最自然、最符合用户预期的行为
2. **选中是独立操作**：通过显式的 UI 元素或快捷键来选中书签
3. **快捷键增强体验**：提供多种打开方式的快捷键

## 🖱️ 交互方式

### 1. 打开书签

#### 默认行为（普通点击）
- **操作**：点击书签
- **效果**：在新标签页打开（后台）
- **原因**：不打断当前浏览，可以批量打开多个书签

#### Side Panel 快捷键
| 快捷键 | 效果 | 使用场景 |
|--------|------|----------|
| `普通点击` | 当前标签页打开 | 立即查看书签内容（默认） |
| `Ctrl/Cmd + 点击` | 新标签页打开（前台） | 在新标签页查看，切换到新标签 |
| `Shift + 点击` | 新标签页打开（后台） | 批量打开书签，不打断当前浏览 |

### 2. 选中书签

#### 方式一：点击选中图标（推荐）
- **操作**：点击书签行左侧的选中图标（复选框）
- **效果**：选中/取消选中该书签
- **优点**：显式操作，不会误触

#### 方式二：Shift + 点击
- **操作**：按住 `Shift` 键，点击书签
- **效果**：选中/取消选中该书签
- **优点**：快捷操作，适合键盘用户

### 3. 文件夹操作

- **点击文件夹**：展开/收起文件夹
- **Shift + 点击文件夹**：选中/取消选中文件夹（如果启用了 selectable）

## ⚙️ 配置选项

### defaultOpenMode

控制点击书签的默认打开方式：

```typescript
type DefaultOpenMode = 
  | 'new-tab-background'  // 新标签页（后台）- 默认
  | 'new-tab-foreground'  // 新标签页（前台）
  | 'current-tab'         // 当前标签页
```

**使用示例**：

```vue
<BookmarkTree
  :nodes="bookmarks"
  default-open-mode="new-tab-background"
/>
```

### selectable

控制是否启用选中功能：

```typescript
type Selectable = boolean | 'single' | 'multiple'
```

- `false`：禁用选中功能
- `true` 或 `'multiple'`：启用多选
- `'single'`：启用单选

## 🎨 UI 反馈

### 悬停状态
- 鼠标悬停在书签上时，显示浅色背景
- 显示操作按钮（收藏、打开新标签页、复制链接等）

### 选中状态
- 选中的书签显示高亮背景
- 选中图标显示为选中状态

### 点击反馈
- 点击时显示短暂的按下效果
- 打开书签后，可选显示"已打开"提示

## 📱 不同场景的应用

### Side Panel（侧边栏）
- **默认打开方式**：当前标签页打开
- **原因**：Side Panel 是辅助浏览工具，用户点击书签通常想立即查看内容
- **快捷键**：
  - `Ctrl/Cmd + 点击`：新标签页打开（前台）
  - `Shift + 点击`：新标签页打开（后台）
- **选中功能**：通常禁用

### Management（管理页面）
- **默认打开方式**：新标签页（前台）
- **原因**：管理页面中，用户通常想立即查看打开的书签
- **选中功能**：必须启用，用于批量编辑、删除等操作

### Popup（弹窗）
- **默认打开方式**：新标签页（后台）
- **原因**：弹窗空间有限，打开书签后弹窗会自动关闭
- **选中功能**：通常禁用

## 🔧 实现细节

### 事件流

```
用户点击书签
    ↓
TreeNode.handleBookmarkClick()
    ↓
检查是否按住 Shift
    ↓
是 → emit('node-select')  // 选中
否 → emit('node-click')   // 打开
    ↓
父组件处理事件
    ↓
根据快捷键和配置决定打开方式
```

### 快捷键检测

```typescript
const navigateToBookmark = (bookmark, event) => {
  const isCtrlOrCmd = event?.ctrlKey || event?.metaKey
  const isAlt = event?.altKey
  
  if (isAlt) {
    // 当前标签页打开
  } else if (isCtrlOrCmd) {
    // 新标签页（前台）
  } else {
    // 新标签页（后台）- 默认
  }
}
```

## 🎯 用户体验优势

1. **符合直觉**：点击 = 打开，这是最自然的行为
2. **灵活性高**：通过快捷键支持多种打开方式
3. **避免误操作**：选中是独立的操作路径，不会误触
4. **键盘友好**：支持 Shift 快捷键选中
5. **一致性强**：所有场景下行为一致

## 📝 最佳实践

### 推荐配置

**Side Panel**：
```vue
<BookmarkTree
  :nodes="bookmarks"
  default-open-mode="current-tab"
  :selectable="false"
/>
```

**Management**：
```vue
<BookmarkTree
  :nodes="bookmarks"
  default-open-mode="new-tab-foreground"
  selectable="multiple"
  :show-selection-checkbox="true"
/>
```

**Popup**：
```vue
<BookmarkTree
  :nodes="bookmarks"
  default-open-mode="new-tab-background"
  :selectable="false"
/>
```

## 🚀 未来扩展

### 可配置的快捷键映射
允许用户自定义快捷键行为：

```typescript
interface ShortcutConfig {
  normalClick: 'new-tab-background' | 'new-tab-foreground' | 'current-tab'
  ctrlClick: 'new-tab-background' | 'new-tab-foreground' | 'current-tab'
  altClick: 'new-tab-background' | 'new-tab-foreground' | 'current-tab'
}
```

### 右键菜单
提供更多操作选项：
- 在新标签页打开（前台/后台）
- 在当前标签页打开
- 在新窗口打开
- 在隐身窗口打开
- 复制链接
- 编辑书签
- 删除书签

---

**最后更新**：2025-12-13  
**版本**：1.0.0
