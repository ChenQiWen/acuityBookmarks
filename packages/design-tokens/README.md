# @acuity-bookmarks/design-tokens

AcuityBookmarks 设计令牌包 - 基于 Material Design 3 的统一设计系统。

## 📦 包含内容

- **Material Design 3 主题** - 薄荷绿色系（种子色 #89EAD7）
- **颜色系统** - 完整的 MD3 颜色方案 + 语义色
- **间距系统** - Material Design spacing tokens
- **形状系统** - Material Design shape tokens
- **字体系统** - 字体家族、大小、字重
- **CSS 变量** - 完整的 MD3 CSS 自定义属性

## 🎨 设计理念

### Material Design 3 主题

AcuityBookmarks 完全采用 **Material Design 3** 设计系统：

- **种子色**: `#89EAD7` (薄荷绿)
- **Primary**: `#83d5c5` (亮色) / `#016b5d` (暗色)
- **Secondary**: `#b1ccc5` (亮色) / `#4f5b58` (暗色)
- **完整色系**: MD3 自动生成的完整颜色方案

### 设计原则

1. **遵循 Material Design 3 规范** - 不覆盖任何 MD3 自动生成的颜色
2. **统一的设计语言** - 插件和官网使用相同的设计系统
3. **深色主题优先** - 为专业用户设计的深色界面
4. **可访问性** - 符合 WCAG 对比度要求

## 📖 使用方法

### 1. 在 TypeScript/JavaScript 中使用

```typescript
import { colors, spacing, fontSize } from '@acuity-bookmarks/design-tokens'

// 使用 Material Design 主题色
const buttonStyle = {
  backgroundColor: colors.brand.primary,
  padding: spacing.md,
  fontSize: fontSize.base
}
```

### 2. 在 CSS 中使用 Material Design tokens

推荐直接导入 CSS 文件：

```typescript
// 在你的入口文件中
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'

// 然后在 CSS 中使用
.button {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);
}
```

### 3. 在 Vue/Nuxt 中使用

```vue
<script setup>
// CSS tokens 通过 CSS 变量自动可用
</script>

<template>
  <button class="btn-primary">
    登录
  </button>
</template>

<style scoped>
.btn-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
</style>
```

### 4. Chrome Extension 中使用

```typescript
// Material Design tokens 已经在 material-theme.css 中定义
// 只需要导入 CSS 文件即可
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
```

## 🎯 设计令牌列表

### Material Design 颜色 tokens

```css
/* 主题色 */
var(--md-sys-color-primary)              /* 主色 - 薄荷绿 */
var(--md-sys-color-on-primary)           /* 主色上的文本 */
var(--md-sys-color-secondary)            /* 次要色 - 蓝绿色 */
var(--md-sys-color-on-secondary)         /* 次要色上的文本 */

/* 表面色 */
var(--md-sys-color-surface)              /* 表面背景 */
var(--md-sys-color-on-surface)           /* 表面上的文本 */
var(--md-sys-color-background)           /* 页面背景 */
var(--md-sys-color-on-background)        /* 背景上的文本 */
```

### 语义化颜色（TypeScript）

```typescript
colors.semantic.success     // #22c55e - 成功
colors.semantic.error       // #ef4444 - 错误
colors.semantic.warning     // #f59e0b - 警告
colors.semantic.info        // #3b82f6 - 信息
```

### 间距

```typescript
spacing.xs      // 4px
spacing.sm      // 8px
spacing.md      // 12px
spacing.base    // 16px
spacing.lg      // 24px
spacing.xl      // 32px
```

### 字体

```typescript
fontSize.sm     // 12px
fontSize.base   // 14px
fontSize.md     // 16px
fontSize.lg     // 18px
```

## 🔄 跨平台使用

### 插件前端 (Chrome Extension)

```typescript
import { materialTheme } from '@acuity-bookmarks/design-tokens'
// 自动映射到 Chrome Material Design
```

### 官网 (Nuxt)

```typescript
import { colors, spacing } from '@acuity-bookmarks/design-tokens'
// 直接使用设计令牌
```

## 📝 维护指南

### 修改 Material Design 主题色

1. 访问 [Material Design Theme Builder](https://m3.material.io/theme-builder)
2. 调整种子色（当前为 #89EAD7）
3. 导出 CSS 文件
4. 替换 `css/material-theme.css`
5. 更新 `src/colors.ts` 中的颜色值

### 修改其他 tokens

- **语义色**: 编辑 `src/colors.ts` 的 `semantic` 部分
- **间距**: 编辑 `css/variables.css` 的 spacing tokens
- **字体**: 编辑 `src/typography.ts`
- **形状**: 编辑 `css/variables.css` 的 shape tokens

### ⚠️ 不要做的事情

- ❌ 不要手动覆盖 Material Design 自动生成的颜色
- ❌ 不要使用 `brand-override.css`（已废弃）
- ❌ 不要在 `variables.css` 中定义品牌色（应使用 MD3 颜色）

## 🎯 设计原则

1. **一致性优先**: 所有产品使用相同的设计令牌
2. **简单实用**: 只提供真正需要的令牌
3. **平台适配**: 支持 Web 和 Chrome Extension
4. **类型安全**: 完整的 TypeScript 类型支持

## 📜 License

MIT
