# AcuityBookmarks 设计系统

## 概述

本设计系统基于项目logo的视觉风格，为整个AcuityBookmarks项目提供统一的设计规范。设计风格以薄荷绿和深蓝色调为主，使用美丽的渐变背景和玻璃态效果，营造现代、清新、专业的用户体验。

## 设计原则

1. **视觉一致性** - 所有页面保持完全一致的视觉风格
2. **品牌化设计** - 以logo为设计基础，强化品牌识别
3. **现代美学** - 使用渐变、玻璃态效果和柔和阴影
4. **用户体验** - 清晰的信息层次和直观的交互
5. **响应式设计** - 适配不同屏幕尺寸

## 使用方法

### 1. 应用主题变量

在Vue组件中应用统一的主题变量：

```vue
<style scoped>
/* 应用统一的主题变量 */
.ab-app {
  --ab-mint: #86ead4;
  --ab-mint-deep: #0f766e;
  --ab-navy: #14213d;
  --ab-muted: #6b7280;
  --ab-card: rgba(255,255,255,0.96);
  --ab-border: rgba(255,255,255,0.45);
  --ab-shadow: rgba(24, 120, 192, 0.18);
}
</style>
```

### 2. 应用渐变背景

```vue
<template>
  <div class="app-container">
    <!-- 内容 -->
  </div>
</template>

<style scoped>
.app-container {
  /* 统一的渐变背景 */
  background: radial-gradient(120% 140% at 0% 0%, #fef3f5 0%, #ffe3ec 18%, #fbd6ec 28%, #d2f6f2 58%, #bff0ea 75%, #cdf0ff 100%);
  min-height: 100vh;
}
</style>
```

### 3. 使用统一的卡片样式

```vue
<template>
  <div class="hero-card">
    <h3 class="card-title">卡片标题</h3>
    <p class="body-text">正文内容</p>
  </div>
</template>

<style scoped>
.hero-card {
  /* 统一的玻璃态卡片样式 */
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%);
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ab-border);
  padding: 16px;
}
</style>
```

### 4. 使用统一的按钮样式

```vue
<template>
  <button class="btn-primary-gradient">主要操作</button>
</template>

<style scoped>
.btn-primary-gradient {
  /* 统一的渐变按钮样式 */
  background: linear-gradient(135deg, #4fc3f7 0%, var(--ab-mint) 100%);
  color: #083344;
  border: none;
  border-radius: 14px;
  height: 44px;
  padding: 0 18px;
  box-shadow: 0 10px 20px var(--ab-shadow);
  font-weight: 500;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary-gradient:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
}
</style>
```

### 5. 使用统一的品牌样式

```vue
<template>
  <div class="brand">
    <img src="/logo.png" alt="AcuityBookmarks" class="logo" />
    <div class="brand-text">
      <div class="brand-title">AcuityBookmarks</div>
      <div class="brand-subtitle">智能书签管理</div>
    </div>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: contain;
}

.brand-title {
  /* 统一的渐变文字效果 */
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.2px;
  background-image: linear-gradient(90deg, #14213d 0%, #0f766e 65%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-top: 8px;
}

.brand-subtitle {
  font-size: 13px;
  color: var(--ab-mint-deep);
  font-weight: 400;
}
</style>
```

## 核心设计元素

### 颜色系统

基于项目logo的薄荷绿和深蓝色调：

- **--ab-navy**: #14213d (深蓝色) - 主要文字和标题
- **--ab-mint**: #86ead4 (薄荷绿) - 主要强调色和按钮
- **--ab-mint-deep**: #0f766e (深薄荷绿) - 副标题和次要元素
- **--ab-muted**: #6b7280 (中性灰) - 辅助文字
- **--ab-card**: rgba(255,255,255,0.96) - 卡片背景
- **--ab-border**: rgba(255,255,255,0.45) - 边框颜色
- **--ab-shadow**: rgba(24, 120, 192, 0.18) - 阴影颜色

### 渐变背景

**主背景渐变**：
```css
background: radial-gradient(120% 140% at 0% 0%, #fef3f5 0%, #ffe3ec 18%, #fbd6ec 28%, #d2f6f2 58%, #bff0ea 75%, #cdf0ff 100%);
```

灵感来自logo的薄荷绿+粉色+天空蓝，营造柔和梦幻的视觉效果。

### 卡片系统

**玻璃态效果**：
- 半透明白色背景
- 柔和的边框
- 微妙的阴影
- 16px圆角

### 按钮系统

**主要按钮**：
- 蓝绿渐变背景
- 深色文字 (#083344)
- 14px圆角
- 44px高度
- 悬浮效果

### 字体系统

- **品牌标题**: 20px, 800 weight, 渐变文字效果
- **副标题**: 13px, 400 weight, 深薄荷绿
- **正文**: 14px, 400 weight, 深蓝色
- **辅助文字**: 12px, 400 weight, 中性灰

### 阴影系统

- **卡片阴影**: 0 12px 30px rgba(0, 0, 0, 0.06)
- **按钮阴影**: 0 10px 20px rgba(24, 120, 192, 0.18)
- **悬浮阴影**: 0 4px 16px rgba(76, 175, 80, 0.4)

### 圆角系统

- **卡片**: 16px
- **按钮**: 14px
- **Logo**: 12px
- **输入框**: 12px

## 已应用页面

- ✅ **Popup页面** - 设计风格基准，包含完整的渐变背景和玻璃态效果
- ✅ **Management页面** - 已完全改造，与Popup页面保持100%一致的视觉风格

## 设计一致性要求

1. **渐变背景**: 所有页面必须使用相同的径向渐变背景
2. **卡片样式**: 统一使用玻璃态效果的hero-card样式
3. **按钮样式**: 统一使用btn-primary-gradient渐变按钮
4. **品牌元素**: Logo尺寸、品牌标题渐变文字效果保持一致
5. **颜色变量**: 严格使用定义的CSS变量
6. **阴影效果**: 统一的卡片和按钮阴影
7. **圆角规范**: 16px卡片圆角，14px按钮圆角
8. **字体规范**: 统一的字体大小、粗细和颜色

## 组件使用指南

### 主要组件

1. **渐变背景容器**
   ```css
   .app-container {
     background: radial-gradient(120% 140% at 0% 0%, #fef3f5 0%, #ffe3ec 18%, #fbd6ec 28%, #d2f6f2 58%, #bff0ea 75%, #cdf0ff 100%);
   }
   ```

2. **玻璃态卡片**
   ```css
   .hero-card {
     background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%);
     border-radius: 16px;
     box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
     border: 1px solid var(--ab-border);
   }
   ```

3. **渐变按钮**
   ```css
   .btn-primary-gradient {
     background: linear-gradient(135deg, #4fc3f7 0%, var(--ab-mint) 100%);
     color: #083344;
     border-radius: 14px;
     height: 44px;
   }
   ```

4. **品牌标题**
   ```css
   .brand-title {
     background-image: linear-gradient(90deg, #14213d 0%, #0f766e 65%);
     -webkit-background-clip: text;
     color: transparent;
   }
   ```

## 维护指南

当需要更新设计时：

1. **以Popup页面为基准** - 所有设计变更都应该先在Popup页面实现
2. **同步到其他页面** - 确保Management页面等其他页面保持一致
3. **更新设计文档** - 及时更新本文档和design-tokens.ts
4. **测试视觉一致性** - 验证所有页面的视觉效果完全一致
5. **保持品牌识别** - 确保logo和品牌元素的一致性使用
