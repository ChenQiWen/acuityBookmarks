# Badge 徽章组件

一个轻量级的徽章组件，用于显示状态、计数或标签。

## ✨ 特性

- 🎨 **多种样式** - 支持 filled、outlined、soft 三种样式
- 🌈 **丰富颜色** - 6 种语义化颜色（primary、secondary、success、warning、error、info）
- 📏 **三种尺寸** - sm、md、lg 满足不同场景
- 🎯 **无障碍** - 符合 WCAG 标准
- 🔧 **完全可定制** - 支持插槽自定义内容
- 📦 **零依赖** - 纯原子组件，不依赖其他组件

## 📦 安装

```typescript
import { Badge } from '@/components'
```

## 🎯 基础用法

### 默认徽章

```vue
<template>
  <Badge>New</Badge>
  <Badge color="success">5</Badge>
  <Badge color="warning">Hot</Badge>
</template>
```

### 不同样式

```vue
<template>
  <!-- Filled 样式（默认） -->
  <Badge variant="filled" color="primary">Filled</Badge>
  
  <!-- Outlined 样式 -->
  <Badge variant="outlined" color="primary">Outlined</Badge>
  
  <!-- Soft 样式 -->
  <Badge variant="soft" color="primary">Soft</Badge>
</template>
```

### 不同颜色

```vue
<template>
  <Badge color="primary">Primary</Badge>
  <Badge color="secondary">Secondary</Badge>
  <Badge color="success">Success</Badge>
  <Badge color="warning">Warning</Badge>
  <Badge color="error">Error</Badge>
  <Badge color="info">Info</Badge>
</template>
```

### 不同尺寸

```vue
<template>
  <Badge size="sm">Small</Badge>
  <Badge size="md">Medium</Badge>
  <Badge size="lg">Large</Badge>
</template>
```

### 数字徽章

```vue
<template>
  <Badge color="error">99+</Badge>
  <Badge color="primary">5</Badge>
  <Badge color="success">1</Badge>
</template>
```

## 📋 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'filled' \| 'outlined' \| 'soft'` | `'filled'` | 徽章样式 |
| `color` | `'primary' \| 'secondary' \| 'success' \| 'warning' \| 'error' \| 'info'` | `'primary'` | 徽章颜色 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 徽章大小 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 徽章内容 |

## 🎨 样式变量

组件使用 CSS 变量，可以通过覆盖变量来自定义样式：

```css
.acuity-badge {
  /* 尺寸 */
  --badge-sm-height: 20px;
  --badge-md-height: 24px;
  --badge-lg-height: 32px;
  
  /* 圆角 */
  border-radius: var(--radius-full);
  
  /* 字重 */
  font-weight: var(--font-medium);
}
```

## 💡 使用场景

### 状态标识

```vue
<template>
  <div class="user-status">
    <span>用户状态：</span>
    <Badge color="success">在线</Badge>
  </div>
</template>
```

### 消息计数

```vue
<template>
  <button class="notification-btn">
    <Icon name="icon-bell" />
    <Badge color="error" size="sm">5</Badge>
  </button>
</template>
```

### 标签分类

```vue
<template>
  <div class="tags">
    <Badge variant="soft" color="primary">Vue</Badge>
    <Badge variant="soft" color="secondary">TypeScript</Badge>
    <Badge variant="soft" color="success">Vite</Badge>
  </div>
</template>
```

## ⚠️ 注意事项

1. **内容简洁** - 徽章内容应该简短，通常是 1-3 个字符或数字
2. **语义化颜色** - 使用语义化的颜色来传达信息（如 error 表示错误、success 表示成功）
3. **无障碍** - 确保徽章内容对屏幕阅读器友好
4. **不要过度使用** - 避免在页面上使用过多徽章，会分散用户注意力

## 🔗 相关组件

- [Chip](../Chip/README.md) - 可交互的标签组件
- [CountIndicator](../CountIndicator/README.md) - 计数指示器

## 📝 更新日志

- **v1.0.0** - 初始版本，支持基础功能

---

**组件类型**: 基础组件（原子级）  
**最后更新**: 2025-01-05
