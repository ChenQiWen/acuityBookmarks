# @acuity-bookmarks/design-tokens

AcuityBookmarks 设计令牌包 - 提供统一的设计系统基础。

## 📦 包含内容

- **颜色系统** - 品牌色、语义色、灰度
- **间距系统** - 基于 8px 网格
- **字体系统** - 字体家族、大小、字重
- **CSS 变量** - 自动生成 CSS 自定义属性

## 🎨 设计理念

### 品牌色

- **金黄色 (#ffd700)**: 代表"精选"、"高价值"、"智能发现"
- **深绿色 (#16a085)**: 代表"稳定"、"专业"、"可信赖"
- **黄色渐变**: 品牌视觉识别的核心元素

## 📖 使用方法

### 1. 在 TypeScript/JavaScript 中使用

```typescript
import { colors, spacing, fontSize } from '@acuity-bookmarks/design-tokens'

// 使用品牌色
const buttonStyle = {
  backgroundColor: colors.brand.green,
  padding: spacing.md,
  fontSize: fontSize.base
}
```

### 2. 在 CSS 中使用

```typescript
import { generateCSSString } from '@acuity-bookmarks/design-tokens/css-vars'

// 生成 CSS 变量
const cssVars = generateCSSString()
// 注入到页面中
document.head.insertAdjacentHTML('beforeend', `<style>${cssVars}</style>`)
```

### 3. 在 Vue/Nuxt 中使用

```vue
<script setup>
import { colors } from '@acuity-bookmarks/design-tokens'
</script>

<template>
  <button :style="{ backgroundColor: colors.brand.green }">
    登录
  </button>
</template>
```

### 4. Chrome Extension 中使用（Material Design 兼容）

```typescript
import { materialTheme } from '@acuity-bookmarks/design-tokens'

// 将品牌色映射到 Material Design 变量
Object.entries(materialTheme).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value)
})
```

## 🎯 设计令牌列表

### 颜色

```typescript
colors.brand.yellow         // #ffd700 - 金黄色
colors.brand.green          // #16a085 - 深绿色
colors.brand.gradient.css   // 品牌渐变
colors.semantic.success     // #22c55e - 成功
colors.semantic.error       // #ef4444 - 错误
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

- **修改颜色**: 编辑 `src/colors.ts`
- **修改间距**: 编辑 `src/spacing.ts`
- **修改字体**: 编辑 `src/typography.ts`
- **添加 CSS 变量**: 编辑 `src/css-vars.ts`

## 🎯 设计原则

1. **一致性优先**: 所有产品使用相同的设计令牌
2. **简单实用**: 只提供真正需要的令牌
3. **平台适配**: 支持 Web 和 Chrome Extension
4. **类型安全**: 完整的 TypeScript 类型支持

## 📜 License

MIT
