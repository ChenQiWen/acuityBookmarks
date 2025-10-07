<template>
  <div
    class="url-input"
    :class="{ 'url-input--error': !!error || !!errorMessage }"
  >
    <label v-if="label" class="url-input__label">{{ label }}</label>
    <div class="url-input__controls" :class="[`density-${density}`]">
      <div class="url-input__protocol">
        <select v-model="protocol" class="protocol-select" :disabled="disabled">
          <option v-for="p in protocols" :key="p" :value="p">{{ p }}</option>
        </select>
        <div class="protocol-divider" />
      </div>
      <div class="url-input__rest">
        <Input
          v-model="rest"
          :variant="'outlined'"
          :density="density"
          type="text"
          class="url-rest-input"
          :disabled="disabled"
          @paste="handlePaste"
        />
      </div>
    </div>
    <div
      v-if="hint || errorMessage"
      class="url-input__hint"
      :class="{ error: !!errorMessage }"
    >
      {{ errorMessage || hint || defaultHint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Input } from './index'

export interface UrlInputProps {
  modelValue?: string
  label?: string
  variant?: 'outlined' | 'filled' | 'underlined'
  density?: 'default' | 'comfortable' | 'compact'
  error?: boolean
  errorMessage?: string
  hint?: string
  disabled?: boolean
  protocols?: string[]
  inputClass?: string
}

const props = withDefaults(defineProps<UrlInputProps>(), {
  modelValue: '',
  label: '书签链接',
  variant: 'outlined',
  density: 'compact',
  error: false,
  errorMessage: '',
  hint: '',
  disabled: false,
  protocols: () => ['https', 'http'],
  inputClass: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// 解析初始URL，提取协议与剩余部分
const initialProtocol = computed(() => {
  const val = (props.modelValue || '').trim()
  const m = val.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//)
  if (m) return m[1]
  return 'https'
})

const protocol = ref(initialProtocol.value)
const initialRest = computed(() => {
  const val = (props.modelValue || '').trim()
  const m = val.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
  return m ? m[2] : val
})
const rest = ref(initialRest.value)

const defaultHint = computed(() => `示例：${protocol.value}://example.com/path`)

// 当任一部分变化时，组合为完整URL并抛出更新
const composeAndEmit = () => {
  const restTrimmed = (rest.value || '').trim()
  const url = restTrimmed ? `${protocol.value}://${restTrimmed}` : ''
  emit('update:modelValue', url)
}

watch(
  () => props.modelValue,
  val => {
    const str = (val || '').trim()
    const m = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
    if (m) {
      protocol.value = m[1]
      rest.value = m[2]
    } else {
      rest.value = str
    }
  }
)

watch(protocol, composeAndEmit)
watch(
  () => rest.value,
  val => {
    // 自动移除用户输入中的协议前缀，保持与下拉选择一致
    const str = (val || '').trim()
    const m = str.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
    if (m) {
      // 只移除协议，保持下拉选择不变
      rest.value = m[2]
    }
    composeAndEmit()
  }
)

const handlePaste = (e: any) => {
  const txt = e.clipboardData?.getData('text') || ''
  const m = txt.trim().match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/)
  if (m) {
    // 阻止默认粘贴，改为粘贴去掉协议的部分
    e.preventDefault()
    rest.value = m[2]
  }
}
</script>

<style scoped>
.url-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.url-input__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}
.url-input__controls {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: stretch;
  border: 1px solid var(--color-border);
  border-radius: 999px; /* pill 风格，类似“清理”按钮 */
  overflow: hidden;
  background: var(--color-surface);
  transition: all var(--transition-base);
}
.url-input__controls:hover {
  border-color: var(--color-border-hover);
}
.url-input__controls:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha-10);
}
.url-input--error .url-input__controls {
  border-color: var(--color-error);
}

/* 密度控制，使高度与 Input 一致 */
.url-input__controls.density-default {
  min-height: 40px;
}
.url-input__controls.density-comfortable {
  min-height: 40px;
}
.url-input__controls.density-compact {
  min-height: 36px;
}

.url-input__protocol {
  display: flex;
  align-items: center;
  background: var(--color-surface-variant);
}
.protocol-select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  padding: 0 var(--spacing-md);
  font-size: var(--text-base);
  cursor: pointer;
}
.protocol-divider {
  width: 1px;
  height: 70%;
  background: var(--color-divider);
}

.url-input__rest {
  display: flex;
  align-items: stretch;
}
.url-rest-input {
  width: 100%;
}
/* 合并内部Input的外观为统一控件（移除自身边框与圆角） */
:deep(.acuity-input-wrapper) {
  width: 100%;
}
:deep(.acuity-input-label) {
  display: none;
}
:deep(.acuity-input-container) {
  border: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 var(--spacing-md) !important;
}
:deep(.acuity-input-container--focused) {
  box-shadow: none !important;
}
:deep(.acuity-input-hint) {
  display: none;
}

.url-input__hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
.url-input__hint.error {
  color: var(--color-error);
}
</style>
