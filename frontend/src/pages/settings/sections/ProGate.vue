<template>
  <div class="pro-gate">
    <div class="pro-gate__icon-wrap">
      <Icon name="icon-lock" :size="40" class="pro-gate__icon" />
    </div>
    <h3 class="pro-gate__title">PRO 专属功能</h3>
    <p class="pro-gate__desc">{{ desc }}</p>
    <div class="pro-gate__actions">
      <Button
        v-if="!isLoggedIn"
        color="primary"
        size="lg"
        @click="handleLogin"
      >
        <template #prepend><Icon name="icon-login" /></template>
        登录后解锁
      </Button>
      <Button
        v-else
        color="primary"
        size="lg"
        @click="handleUpgrade"
      >
        <template #prepend><Icon name="icon-crown" /></template>
        升级到 PRO
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, Icon } from '@/components'
import { useSupabaseAuth } from '@/composables'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({ name: 'ProGate' })

const props = defineProps<{
  /** 来自哪个 tab，用于 redirect 参数 */
  tab: string
}>()

const { isAuthenticated } = useSupabaseAuth()
const isLoggedIn = computed(() => isAuthenticated.value)

const descMap: Record<string, string> = {
  embeddings: '内容嵌入分析需要 PRO 会员，升级后自动开启深度内容理解能力。',
  vectorize: '语义向量检索需要 PRO 会员，升级后用自然语言精准找到相关书签。'
}

const desc = computed(() => descMap[props.tab] ?? '此功能需要 PRO 会员，升级后立即解锁。')

/** 构建带 redirect 的目标 URL */
function buildUrl(base: string): string {
  const redirect = encodeURIComponent(`settings.html?tab=${props.tab}`)
  return `${base}?redirect=${redirect}`
}

async function handleLogin() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(buildUrl('auth.html'))
      : buildUrl('/auth.html')
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('ProGate', '打开登录页失败', error)
  }
}

async function handleUpgrade() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL(buildUrl('subscription.html'))
      : buildUrl('/subscription.html')
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('ProGate', '打开订阅页失败', error)
  }
}
</script>

<style scoped>
.pro-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-8) var(--spacing-4);
  text-align: center;
}

.pro-gate__icon-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.pro-gate__icon {
  color: var(--md-sys-color-primary);
}

.pro-gate__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.pro-gate__desc {
  max-width: 360px;
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-secondary);
}

.pro-gate__actions {
  display: flex;
  gap: var(--spacing-3);
}
</style>
