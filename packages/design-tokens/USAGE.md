# 使用示例

## 🎯 在官网 auth.vue 中使用

### 方式 1: 直接在 `<script>` 中导入使用

```vue
<script setup lang="ts">
import { colors, spacing, fontSize } from '@acuity-bookmarks/design-tokens'

// 可以直接在 computed 或 reactive 中使用
const buttonStyle = computed(() => ({
  backgroundColor: colors.brand.green,
  padding: `${spacing.md} ${spacing.lg}`,
  fontSize: fontSize.base
}))
</script>

<template>
  <button :style="buttonStyle">登录</button>
</template>
```

### 方式 2: 在 CSS 中使用（推荐）

```vue
<script setup lang="ts">
import { generateCSSVars } from '@acuity-bookmarks/design-tokens/css-vars'

// 在组件挂载时注入 CSS 变量
onMounted(() => {
  const vars = generateCSSVars()
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
})
</script>

<style scoped>
.auth-submit-btn--login {
  background-color: var(--color-brand-green);
  color: white;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
}

.auth-submit-btn--login:hover {
  background-color: var(--color-brand-green-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.auth-submit-btn--register {
  background-color: var(--color-brand-yellow);
  color: black;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  border-radius: var(--radius-md);
}
</style>
```

### 方式 3: 在 Nuxt 配置中全局注入

```typescript
// nuxt.config.ts
import { generateCSSString } from '@acuity-bookmarks/design-tokens/css-vars'

export default defineNuxtConfig({
  app: {
    head: {
      style: [
        {
          children: generateCSSString(),
          type: 'text/css'
        }
      ]
    }
  }
})
```

## 🎨 在插件前端中使用

### 在 Chrome Extension 中应用 Material Design 变量

```typescript
// frontend/src/main.ts 或 frontend/src/design-system/material-theme.css
import { generateMaterialCSSString } from '@acuity-bookmarks/design-tokens/css-vars'

// 生成并注入 Material Design 变量
const materialCSS = generateMaterialCSSString()
const style = document.createElement('style')
style.textContent = materialCSS
document.head.appendChild(style)
```

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { colors } from '@acuity-bookmarks/design-tokens'

// 可以直接在组件中使用颜色
const primaryColor = colors.brand.yellow
</script>

<template>
  <button :style="{ backgroundColor: primaryColor }">
    按钮
  </button>
</template>

<style scoped>
/* 或者使用 CSS 变量（如果已经全局注入） */
.button {
  background-color: var(--md-sys-color-primary);
  /* 这会自动映射到 AcuityBookmarks 的金黄色 */
}
</style>
```

## 🔄 迁移现有代码

### 迁移 auth.vue 中的硬编码颜色

**之前:**
```css
.auth-submit-btn--login {
  background-color: #16a085;
}

.auth-submit-btn--login:hover {
  background-color: #138d75;
}

.auth-submit-btn--register {
  background-color: #ffd700;
}
```

**之后:**
```css
.auth-submit-btn--login {
  background-color: var(--color-brand-green);
}

.auth-submit-btn--login:hover {
  background-color: var(--color-brand-green-hover);
}

.auth-submit-btn--register {
  background-color: var(--color-brand-yellow);
}
```

### 迁移装饰区域的渐变

**之前:**
```css
.auth-decorative {
  background: linear-gradient(135deg, #ffd54f 0%, #ffeb3b 50%, #ffc107 100%);
}
```

**之后:**
```css
.auth-decorative {
  background: var(--color-gradient);
}
```

## ✅ 完整示例

见 `website/pages/auth-example.vue`（使用设计令牌重写的认证页面示例）
