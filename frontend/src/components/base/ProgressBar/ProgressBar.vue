<template>
  <div
    class="acuity-progress-bar"
    :class="{
      'acuity-progress-bar--circular': isCircular,
      'acuity-progress-bar--with-label': showLabel
    }"
    :style="animationVariables"
  >
    <!-- 线性进度条 -->
    <template v-if="!isCircular">
      <div
        class="acuity-progress-bar-track"
        :style="{ height: `${barHeight}px` }"
      >
        <div :class="progressClasses" :style="progressStyle"></div>
      </div>
      <!-- 线性进度条百分比标签（右侧） -->
      <div
        v-if="showLabel"
        class="acuity-progress-label acuity-progress-label--right"
      >
        {{ Math.round(progressPercentage) }}%
      </div>
    </template>

    <!-- 环形进度条 -->
    <div v-else class="acuity-progress-circle-wrapper">
      <svg
        class="acuity-progress-circle"
        :width="circleSize"
        :height="circleSize"
        :viewBox="`0 0 ${circleSize} ${circleSize}`"
      >
        <!-- 背景圆环 -->
        <circle
          class="acuity-progress-circle-track"
          :cx="circleSize / 2"
          :cy="circleSize / 2"
          :r="radius"
          :stroke-width="strokeWidth"
          fill="none"
        />
        <!-- 进度圆环 -->
        <circle
          :class="circleClasses"
          :cx="circleSize / 2"
          :cy="circleSize / 2"
          :r="radius"
          :stroke-width="strokeWidth"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="countdown ? circumference : circleOffset"
          :style="
            countdown
              ? {
                  '--countdown-duration': `${duration}ms`,
                  '--circumference': circumference
                }
              : undefined
          "
          fill="none"
          stroke-linecap="round"
        />
      </svg>
      <!-- 环形进度条百分比标签（中心） -->
      <div
        v-if="showLabel"
        class="acuity-progress-label acuity-progress-label--center"
      >
        {{ Math.round(progressPercentage) }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ProgressBarProps } from './ProgressBar.d'
import { ANIMATION_CONFIG } from '@/config/constants'

const props = withDefaults(defineProps<ProgressBarProps>(), {
  min: 0,
  max: 100,
  variant: 'linear',
  size: 40,
  strokeWidth: 4,
  striped: false,
  animated: false,
  height: 6,
  color: 'primary',
  showLabel: true // ✅ 默认显示百分比标签
})

// ✅ 是否为环形模式
const isCircular = computed(() => props.variant === 'circular')

const barHeight = computed(() => props.height ?? 6)

/**
 * 计算当前进度百分比
 */
const progressPercentage = computed(() => {
  if (props.indeterminate) {
    return 0
  }

  const sourceValue = props.value ?? props.modelValue ?? 0
  const clamped = Math.max(props.min, Math.min(props.max, sourceValue))
  const percentage =
    ((clamped - props.min) / (props.max - props.min || 1)) * 100
  return percentage
})

/**
 * 进度条是否已完成（100%）
 */
const isCompleted = computed(() => progressPercentage.value >= 100)

const progressClasses = computed(() => [
  'acuity-progress-bar-fill',
  `acuity-progress-bar-fill--${props.color}`,
  {
    'acuity-progress-bar-fill--indeterminate': props.indeterminate,
    'acuity-progress-bar-fill--striped': props.striped,
    // ✨ 进度到达 100% 时，不再显示流光动画
    'acuity-progress-bar-fill--animated': props.animated && !isCompleted.value
  }
])

const progressStyle = computed(() => {
  if (props.indeterminate) {
    return {}
  }

  return {
    width: `${progressPercentage.value}%`
  }
})

// ===== 环形进度条相关计算 =====

/**
 * 环形进度条尺寸
 */
const circleSize = computed(() => props.size ?? 40)

/**
 * 环形进度条半径
 */
const radius = computed(() => {
  const size = circleSize.value
  const stroke = props.strokeWidth ?? 4
  return (size - stroke) / 2
})

/**
 * 环形进度条周长
 */
const circumference = computed(() => 2 * Math.PI * radius.value)

/**
 * 环形进度条偏移量（控制进度显示）
 */
const circleOffset = computed(() => {
  const percentage = progressPercentage.value
  // 从顶部开始顺时针绘制
  return circumference.value * (1 - percentage / 100)
})

/**
 * 环形进度条样式类
 */
const circleClasses = computed(() => [
  'acuity-progress-circle-fill',
  `acuity-progress-circle-fill--${props.color}`,
  {
    'acuity-progress-circle-fill--animated':
      props.animated && !isCompleted.value && !props.countdown,
    'acuity-progress-circle-fill--indeterminate': props.indeterminate,
    'acuity-progress-circle-fill--countdown': props.countdown,
    'acuity-progress-circle-fill--paused': props.countdown && props.paused
  }
])

/**
 * ✅ 动画配置 CSS 变量
 */
const animationVariables = computed(() => ({
  '--shimmer-duration': `${ANIMATION_CONFIG.DURATION.SHIMMER}ms`,
  '--spinner-duration': `${ANIMATION_CONFIG.DURATION.SPINNER}ms`,
  '--circle-rotate-duration': `${ANIMATION_CONFIG.DURATION.CIRCLE_ROTATE}ms`,
  '--transition-duration': `${ANIMATION_CONFIG.DURATION.NORMAL}ms`
}))
</script>

<style scoped>
.acuity-progress-bar {
  width: 100%;
}

/* ✅ 带标签的线性进度条容器 */
.acuity-progress-bar--with-label:not(.acuity-progress-bar--circular) {
  display: flex;
  align-items: center;
  gap: 12px;
}

.acuity-progress-bar-track {
  width: 100%;
  background: var(--color-surface-variant);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.acuity-progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

/* Colors */
.acuity-progress-bar-fill--primary {
  background: var(--color-primary);
}

.acuity-progress-bar-fill--secondary {
  background: var(--color-secondary);
}

.acuity-progress-bar-fill--success {
  background: var(--color-success);
}

.acuity-progress-bar-fill--warning {
  background: var(--color-warning);
}

.acuity-progress-bar-fill--error {
  background: var(--color-error);
}

/* Striped pattern */
.acuity-progress-bar-fill--striped {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 20px 20px;
}

/* Animated stripes */
.acuity-progress-bar-fill--animated {
  position: relative;
  overflow: hidden;
}

.acuity-progress-bar-fill--animated::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  /* ✅ 使用统一配置 */
  animation: shimmer var(--shimmer-duration) ease-in-out infinite;
}

.acuity-progress-bar-fill--striped.acuity-progress-bar-fill--animated {
  /* ✅ 使用统一配置 */
  animation: stripes-move var(--spinner-duration) linear infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

@keyframes stripes-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 20px 20px;
  }
}

/* Indeterminate animation */
.acuity-progress-bar-fill--indeterminate {
  width: 40% !important;
  /* ✅ 使用统一配置 */
  animation: progress-indeterminate var(--shimmer-duration) ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(250%);
  }
  100% {
    transform: translateX(250%);
  }
}

/* ===============================================
   ✨ 环形进度条样式
   =============================================== */

.acuity-progress-bar--circular {
  width: auto;
  display: inline-flex;
}

/* ===============================================
   ✨ 百分比标签样式
   =============================================== */

/* 通用标签样式 */
.acuity-progress-label {
  font-size: var(--text-sm, 14px);
  font-weight: 500;
  color: var(--color-text-primary);
  user-select: none;
}

/* 右侧标签（线性进度条） */
.acuity-progress-label--right {
  flex-shrink: 0;
  min-width: 48px;
  text-align: right;
}

/* 环形进度条容器（用于定位中心标签） */
.acuity-progress-circle-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 中心标签（环形进度条） */
.acuity-progress-label--center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--text-xs, 12px);
  font-weight: 600;
  text-align: center;
  pointer-events: none;
}

.acuity-progress-circle {
  display: block;
  /* 旋转 -90deg 使进度从顶部（12点钟方向）开始 */
  transform: rotate(-90deg);
}

/* 环形进度条轨道（背景圆环） */
.acuity-progress-circle-track {
  stroke: var(--color-surface-variant);
  opacity: 0.3;
}

/* 环形进度条填充（进度圆环） */
.acuity-progress-circle-fill {
  /* ✅ 使用统一配置 */
  transition: stroke-dashoffset var(--transition-duration) ease;
}

/* 环形进度条颜色 */
.acuity-progress-circle-fill--primary {
  stroke: var(--color-primary);
}

.acuity-progress-circle-fill--secondary {
  stroke: var(--color-secondary);
}

.acuity-progress-circle-fill--success {
  stroke: var(--color-success);
}

.acuity-progress-circle-fill--warning {
  stroke: var(--color-warning);
}

.acuity-progress-circle-fill--error {
  stroke: var(--color-error);
}

/* 环形进度条动画（流光效果） */
.acuity-progress-circle-fill--animated {
  /* ✅ 使用统一配置 */
  animation: circle-shimmer var(--shimmer-duration) ease-in-out infinite;
}

@keyframes circle-shimmer {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 环形不确定进度动画 */
.acuity-progress-circle-fill--indeterminate {
  /* ✅ 使用统一配置 */
  animation: circle-rotate var(--circle-rotate-duration) linear infinite;
}

@keyframes circle-rotate {
  0% {
    stroke-dashoffset: 0;
    transform: rotate(0deg);
  }
  50% {
    stroke-dashoffset: calc(var(--circumference, 125) * -0.5);
  }
  100% {
    stroke-dashoffset: 0;
    transform: rotate(360deg);
  }
}

/* ♿ 尊重用户的动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .acuity-progress-circle-fill--animated,
  .acuity-progress-circle-fill--indeterminate {
    animation: none;
  }
}

/* ========================================
   ✨ 倒计时模式（Toast 专用）
   ======================================== */

/* 倒计时：时间流逝，圆环逐渐填满（空圆 → 满圆） */
.acuity-progress-circle-fill--countdown {
  /* 初始状态：空圆 */
  stroke-dashoffset: var(--circumference);
  /* CSS 动画驱动 */
  animation: countdown-fill var(--countdown-duration, 2500ms) linear forwards;
}

/* 倒计时动画：从空圆到满圆 */
@keyframes countdown-fill {
  from {
    stroke-dashoffset: var(--circumference); /* 空圆（开始） */
  }
  to {
    stroke-dashoffset: 0; /* 满圆（结束） */
  }
}

/* 暂停状态 */
.acuity-progress-circle-fill--paused {
  animation-play-state: paused;
}

/* ♿ 倒计时模式也尊重用户的动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .acuity-progress-circle-fill--countdown {
    animation: none;
    /* 降级为立即显示满圆 */
    stroke-dashoffset: 0;
  }
}
</style>
