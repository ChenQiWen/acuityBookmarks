<template>
  <Teleport to="body">
    <Transition name="dialog" appear>
      <div
        v-if="show"
        :class="dialogClasses"
        tabindex="-1"
        @click.self="handleBackdropClick"
        @keydown="handleKeydown"
      >
        <Transition name="dialog-content" appear>
          <Card
            v-if="show"
            :class="contentClasses"
            elevation="high"
            @click.stop
          >
            <template v-if="$slots.header || title" #header>
              <div class="acuity-dialog-header">
                <slot name="header">
                  <div class="acuity-dialog-title">
                    <Icon
                      v-if="icon"
                      :name="icon"
                      :color="iconColor"
                      class="title-icon"
                    />
                    <span>{{ title }}</span>
                  </div>
                </slot>
              </div>
            </template>

            <div
              ref="bodyRef"
              :class="['acuity-dialog-body', bodyMinHeightClass]"
            >
              <slot />
            </div>
            <!-- 取消确认覆盖层 -->
            <div v-if="showCancelConfirm" class="acuity-dialog-cancel-overlay">
              <div class="acuity-dialog-cancel-box">
                <div class="cancel-text">{{ cancelConfirmText }}</div>
                <div class="cancel-actions">
                  <Button variant="text" @click="continueEditing">{{
                    cancelConfirmContinueText
                  }}</Button>
                  <Button color="error" @click="confirmCancel">{{
                    cancelConfirmOkText
                  }}</Button>
                </div>
              </div>
            </div>

            <template v-if="$slots.actions" #footer>
              <div class="acuity-dialog-actions">
                <slot name="actions" />
              </div>
            </template>
          </Card>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { DialogProps } from './Dialog.d'
import { Button, Card, Icon } from '@/components'

const props = withDefaults(defineProps<DialogProps>(), {
  width: '480px',
  persistent: false,
  dense: false,
  hideClose: false,
  teleportTarget: 'body',
  closeOnOverlay: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:show': [value: boolean]
  open: []
  close: []
  confirm: []
}>()

const dialogClasses = computed(() => [
  'acuity-dialog-overlay',
  {
    'acuity-dialog-overlay--fullscreen': props.fullscreen
  }
])

const contentClasses = computed(() => {
  const classes = ['acuity-dialog-content']
  if (props.fullscreen) classes.push('acuity-dialog-content--fullscreen')
  if (props.scrollable) classes.push('acuity-dialog-content--scrollable')
  // 映射固定尺寸（仅使用到的三种宽度）
  if (!props.fullscreen) {
    const mw = (props.maxWidth || '').trim()
    if (mw === '480px') classes.push('acuity-dialog-content--size-480')
    else if (mw === '500px') classes.push('acuity-dialog-content--size-500')
    else if (mw === '520px') classes.push('acuity-dialog-content--size-520')
  }
  return classes
})

// 将 bodyMinHeight 从字符串(px)映射到就近的类，避免内联样式
const bodyMinHeightClass = computed(() => {
  const val = (props.bodyMinHeight || '').trim()
  if (!val.endsWith('px')) return undefined
  const n = Number(val.replace('px', ''))
  const steps = [320, 360, 400, 420, 440, 480, 520, 560, 600]
  let picked = steps[0]
  for (const s of steps) {
    if (n <= s) {
      picked = s
      break
    }
    picked = s
  }
  return `min-h-${picked}`
})

const bodyRef = ref<HTMLElement | null>(null)
const showCancelConfirm = ref(false)

const detectUnsaved = (): boolean => {
  if (!bodyRef.value) return false
  const inputs = Array.from(
    bodyRef.value.querySelectorAll('input, textarea')
  ) as HTMLInputElement[]
  for (const el of inputs) {
    if (el.disabled || el.readOnly) continue
    const val = (el.value || '').trim()
    if (val.length > 0) return true
  }
  // 允许使用 data-dirty 标记为脏
  const dirty = bodyRef.value.querySelector('[data-dirty="true"]')
  return !!dirty
}

const attemptCancel = () => {
  if (!props.cancelable) return // 不可取消弹窗直接忽略
  if (props.enableCancelGuard && detectUnsaved()) {
    showCancelConfirm.value = true
  } else {
    emit('update:show', false)
    emit('close')
  }
}

const confirmCancel = () => {
  showCancelConfirm.value = false
  emit('update:show', false)
  emit('close')
}

const continueEditing = () => {
  showCancelConfirm.value = false
}

const handleBackdropClick = () => {
  attemptCancel()
}

const handleKeydown = (event: KeyboardEvent) => {
  // ESC键 - 取消/关闭
  if (event.key === 'Escape') {
    if (props.escToClose) {
      attemptCancel()
    }
    event.preventDefault()
    return
  }

  // Tab键 - 检查是否有Tabs组件进行特殊处理
  if (event.key === 'Tab') {
    // 查找弹窗内的Tabs组件
    const tabsElement = document.querySelector(
      '.acuity-dialog-overlay .acuity-tabs-nav'
    )
    if (tabsElement) {
      // 如果找到Tabs组件，让其处理Tab键事件
      // 创建一个新的KeyboardEvent并在Tabs元素上触发
      const tabsEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: event.shiftKey,
        bubbles: true,
        cancelable: true
      })
      tabsElement.dispatchEvent(tabsEvent)
      event.preventDefault()
      return
    }
  }

  // 回车键 - 确认（只有在启用时才生效）
  if (event.key === 'Enter' && props.enterToConfirm) {
    // 统一由弹窗处理，无论焦点位于何处
    emit('confirm')
    event.preventDefault()
  }
}

// Focus trap and body scroll lock
watch(
  () => props.show,
  newShow => {
    if (newShow) {
      nextTick(() => {
        document.body.style.overflow = 'hidden'
        // 自动获得焦点以确保键盘事件能被捕获
        const overlay = document.querySelector(
          '.acuity-dialog-overlay'
        ) as HTMLElement
        if (overlay) {
          overlay.focus()
        }
      })
    } else {
      document.body.style.overflow = ''
    }
  }
)
</script>

<style scoped>
.acuity-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: var(--spacing-lg);
  outline: none; /* 移除焦点轮廓 */
}

.acuity-dialog-overlay--fullscreen {
  padding: 0;
}

.acuity-dialog-content {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.acuity-dialog-content--fullscreen {
  max-height: 100vh;
  border-radius: 0;
}

.acuity-dialog-content--scrollable {
  overflow: hidden;
}

.acuity-dialog-header {
  padding: var(--spacing-lg);
  padding-left: 0;
  padding-right: 0;
}

.acuity-dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

/* 为自定义header slot内容提供样式基类 */
.acuity-dialog-header .custom-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  padding: 0 var(--spacing-lg);
}

.title-icon {
  flex-shrink: 0;
}

.acuity-dialog-body {
  flex: 1;
  overflow-y: auto;
  font-size: var(--text-base);
  line-height: var(--line-height-relaxed);
}

/* 取消确认覆盖层 */
.acuity-dialog-cancel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.acuity-dialog-cancel-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-lg);
  width: 420px;
  max-width: 90%;
}
.cancel-text {
  color: var(--color-text-primary);
  font-size: var(--text-base);
  margin-bottom: var(--spacing-md);
}
.cancel-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.acuity-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}

/* 固定宽度尺寸（避免内联样式） */
.acuity-dialog-content--size-480 {
  max-width: 480px;
  min-width: 480px;
}
.acuity-dialog-content--size-500 {
  max-width: 500px;
  min-width: 500px;
}
.acuity-dialog-content--size-520 {
  max-width: 520px;
  min-width: 520px;
}

/* 全屏模式 */
.acuity-dialog-content--fullscreen {
  max-width: 100%;
  min-width: 100%;
  width: 100%;
  height: 100%;
}

/* 主体最小高度类（就近映射） */
.acuity-dialog-body.min-h-320 {
  min-height: 320px;
}
.acuity-dialog-body.min-h-360 {
  min-height: 360px;
}
.acuity-dialog-body.min-h-400 {
  min-height: 400px;
}
.acuity-dialog-body.min-h-420 {
  min-height: 420px;
}
.acuity-dialog-body.min-h-440 {
  min-height: 440px;
}
.acuity-dialog-body.min-h-480 {
  min-height: 480px;
}
.acuity-dialog-body.min-h-520 {
  min-height: 520px;
}
.acuity-dialog-body.min-h-560 {
  min-height: 560px;
}
.acuity-dialog-body.min-h-600 {
  min-height: 600px;
}

/* Transitions */
.dialog-enter-active,
.dialog-leave-active {
  transition: all var(--md-sys-motion-duration-medium2)
    var(--md-sys-motion-easing-standard);
}

.dialog-enter-from {
  opacity: 0;
}

.dialog-leave-to {
  opacity: 0;
}

.dialog-content-enter-active,
.dialog-content-leave-active {
  transition: all var(--md-sys-motion-duration-medium2)
    var(--md-sys-motion-easing-standard);
}

.dialog-content-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.dialog-content-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}
</style>
