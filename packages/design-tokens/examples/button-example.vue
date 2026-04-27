<template>
  <div class="example-container">
    <h2>按钮示例 - 使用新的 Design Tokens</h2>
    
    <!-- 基础按钮 -->
    <section>
      <h3>基础按钮</h3>
      <button class="btn btn-primary">主要按钮</button>
      <button class="btn btn-secondary">次要按钮</button>
    </section>
    
    <!-- 玻璃态按钮 -->
    <section>
      <h3>玻璃态按钮</h3>
      <button class="btn btn-glass">玻璃态按钮</button>
    </section>
    
    <!-- 渐变按钮 -->
    <section>
      <h3>渐变按钮</h3>
      <button class="btn btn-gradient">渐变按钮</button>
    </section>
    
    <!-- 带阴影的按钮 -->
    <section>
      <h3>带彩色阴影的按钮</h3>
      <button class="btn btn-shadow-primary">主色阴影</button>
      <button class="btn btn-shadow-secondary">次色阴影</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { 
  colors, 
  spacing, 
  shadows, 
  duration, 
  easing,
  glassmorphism,
  gradients 
} from '@acuity-bookmarks/design-tokens'
</script>

<style scoped>
.example-container {
  padding: v-bind('spacing.xl');
  background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%);
  min-height: 100vh;
}

h2 {
  margin-bottom: v-bind('spacing.xl');
  color: v-bind('colors.primary[700]');
}

h3 {
  margin-bottom: v-bind('spacing.md');
  color: v-bind('colors.primary[600]');
}

section {
  margin-bottom: v-bind('spacing.xl');
  display: flex;
  gap: v-bind('spacing.md');
  flex-wrap: wrap;
}

/* 基础按钮样式 */
.btn {
  padding: v-bind('spacing.md') v-bind('spacing.lg');
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all v-bind('duration.fast') v-bind('easing.standard');
}

/* 主要按钮 */
.btn-primary {
  background: v-bind('colors.primary[500]');
  color: white;
  box-shadow: v-bind('shadows.md');
}

.btn-primary:hover {
  background: v-bind('colors.primary[600]');
  box-shadow: v-bind('shadows.lg');
  transform: translateY(-2px);
}

.btn-primary:active {
  background: v-bind('colors.primary[700]');
  box-shadow: v-bind('shadows.sm');
  transform: translateY(0);
}

/* 次要按钮 */
.btn-secondary {
  background: v-bind('colors.secondary[600]');
  color: white;
  box-shadow: v-bind('shadows.md');
}

.btn-secondary:hover {
  background: v-bind('colors.secondary[700]');
  box-shadow: v-bind('shadows.lg');
  transform: translateY(-2px);
}

/* 玻璃态按钮 */
.btn-glass {
  background: v-bind('glassmorphism.light.background');
  backdrop-filter: v-bind('glassmorphism.light.backdropFilter');
  border: v-bind('glassmorphism.light.border');
  box-shadow: v-bind('glassmorphism.light.boxShadow');
  color: v-bind('colors.primary[700]');
}

.btn-glass:hover {
  background: v-bind('glassmorphism.medium.background');
  backdrop-filter: v-bind('glassmorphism.medium.backdropFilter');
  transform: translateY(-2px);
}

/* 渐变按钮 */
.btn-gradient {
  background: v-bind('gradients.brand');
  color: white;
  box-shadow: v-bind('shadows.md');
}

.btn-gradient:hover {
  box-shadow: v-bind('shadows.xl');
  transform: translateY(-2px);
  filter: brightness(1.1);
}

/* 带彩色阴影的按钮 */
.btn-shadow-primary {
  background: v-bind('colors.primary[500]');
  color: white;
  box-shadow: v-bind('shadows.coloredPrimary');
}

.btn-shadow-primary:hover {
  background: v-bind('colors.primary[600]');
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.btn-shadow-secondary {
  background: v-bind('colors.secondary[600]');
  color: white;
  box-shadow: v-bind('shadows.coloredSecondary');
}

.btn-shadow-secondary:hover {
  background: v-bind('colors.secondary[700]');
  box-shadow: 0 8px 24px rgba(192, 38, 211, 0.3), 0 4px 12px rgba(192, 38, 211, 0.15);
  transform: translateY(-2px);
}
</style>
