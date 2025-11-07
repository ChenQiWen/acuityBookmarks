<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-crown" />
      <span>订阅</span>
    </h3>

    <!-- 未登录提示 -->
    <div v-if="!isAuthenticated" class="auth-prompt">
      <Alert
        message="请先登录以管理订阅"
        color="info"
        variant="filled"
        size="md"
      />
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载订阅信息...</span>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-state">
      <Alert :message="error" color="error" variant="filled" size="md" />
      <Button
        size="md"
        variant="outline"
        :loading="loading"
        @click="loadSubscription"
      >
        重试
      </Button>
    </div>

    <!-- 订阅信息 -->
    <div v-else class="grid">
      <!-- 当前订阅状态 -->
      <div class="row">
        <div class="label">当前订阅</div>
        <div class="field">
          <Badge
            :color="isPro ? 'primary' : 'secondary'"
            variant="filled"
            size="md"
          >
            {{ isPro ? 'PRO' : 'FREE' }}
          </Badge>
          <span v-if="subscriptionStatus" class="subscription-info">
            <span v-if="isCancelledButActive" class="warning-text">
              （将在
              {{ formatDate(subscriptionStatus.current_period_end) }}
              到期后取消）
            </span>
            <span v-else-if="isExpiringSoon" class="warning-text">
              （将于
              {{ formatDate(subscriptionStatus.current_period_end) }} 到期）
            </span>
            <span v-else-if="isPro" class="success-text">
              （有效期至
              {{ formatDate(subscriptionStatus.current_period_end) }}）
            </span>
          </span>
        </div>
      </div>

      <!-- 订阅操作按钮 -->
      <div class="row">
        <div class="label"></div>
        <div class="field btn-group">
          <!-- Pro 用户：显示取消/恢复按钮 -->
          <template v-if="isPro">
            <Button
              v-if="!isCancelledButActive"
              size="md"
              color="error"
              variant="outline"
              :loading="loading"
              @click="handleCancel"
            >
              取消订阅
            </Button>
            <Button
              v-else
              size="md"
              color="primary"
              variant="outline"
              :loading="loading"
              @click="handleResume"
            >
              恢复订阅
            </Button>
            <Button
              size="md"
              variant="ghost"
              :loading="loading"
              @click="loadSubscription"
            >
              <template #prepend
                ><Icon name="icon-refresh" :spin="loading"
              /></template>
              刷新
            </Button>
          </template>

          <!-- Free 用户：显示升级按钮 -->
          <template v-else>
            <Button
              size="md"
              color="primary"
              :loading="loading"
              @click="showPricingModal = true"
            >
              <template #prepend><Icon name="icon-crown" /></template>
              升级到 Pro
            </Button>
          </template>
        </div>
      </div>
    </div>

    <!-- 定价选择弹窗 -->
    <div
      v-if="showPricingModal"
      class="modal-overlay"
      @click="showPricingModal = false"
    >
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>选择订阅计划</h3>
          <Button variant="ghost" size="sm" @click="showPricingModal = false">
            <Icon name="icon-close" />
          </Button>
        </div>
        <div class="pricing-options">
          <div class="pricing-card">
            <div class="pricing-header">
              <h4>月度订阅</h4>
              <div class="price">$9.99<span class="period">/月</span></div>
            </div>
            <ul class="features">
              <li>✓ 所有 Pro 功能</li>
              <li>✓ 月度计费</li>
              <li>✓ 随时取消</li>
            </ul>
            <Button
              size="lg"
              color="primary"
              variant="outline"
              :loading="loading"
              @click="handleSubscribeMonthly"
            >
              选择月度计划
            </Button>
          </div>
          <div class="pricing-card pricing-card--featured">
            <div class="badge">推荐</div>
            <div class="pricing-header">
              <h4>年度订阅</h4>
              <div class="price">$99.99<span class="period">/年</span></div>
              <div class="savings">节省 17%</div>
            </div>
            <ul class="features">
              <li>✓ 所有 Pro 功能</li>
              <li>✓ 年度计费</li>
              <li>✓ 随时取消</li>
              <li>✓ 更优惠的价格</li>
            </ul>
            <Button
              size="lg"
              color="primary"
              :loading="loading"
              @click="handleSubscribeYearly"
            >
              选择年度计划
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { defineOptions } from 'vue'
import { Alert, Badge, Button, Icon } from '@/components'
import { useSubscription } from '@/composables'
import { useSupabaseAuth } from '@/composables'
import { notificationService } from '@/application/notification/notification-service'

defineOptions({
  name: 'SubscriptionSettings'
})

const { isAuthenticated } = useSupabaseAuth()
const {
  subscriptionStatus,
  loading,
  error,
  isPro,
  isExpiringSoon,
  isCancelledButActive,
  loadSubscription,
  subscribeMonthly,
  subscribeYearly,
  cancel,
  resume
} = useSubscription()

const showPricingModal = ref(false)

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * 处理取消订阅
 */
async function handleCancel() {
  if (!confirm('确定要取消订阅吗？订阅将在当前周期结束时取消。')) {
    return
  }

  try {
    await cancel()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '取消订阅失败'
    notificationService.notify(errorMessage, { level: 'error' })
  }
}

/**
 * 处理恢复订阅
 */
async function handleResume() {
  try {
    await resume()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '恢复订阅失败'
    notificationService.notify(errorMessage, { level: 'error' })
  }
}

/**
 * 处理订阅月度计划
 */
async function handleSubscribeMonthly() {
  try {
    showPricingModal.value = false
    await subscribeMonthly()
    notificationService.notify('正在跳转到支付页面...', { level: 'success' })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '创建支付链接失败'
    notificationService.notify(errorMessage, { level: 'error' })
  }
}

/**
 * 处理订阅年度计划
 */
async function handleSubscribeYearly() {
  try {
    showPricingModal.value = false
    await subscribeYearly()
    notificationService.notify('正在跳转到支付页面...', { level: 'success' })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '创建支付链接失败'
    notificationService.notify(errorMessage, { level: 'error' })
  }
}

onMounted(() => {
  if (isAuthenticated.value) {
    loadSubscription()
  }
})
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.label {
  width: 120px;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.field {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-2);
}

.btn-group {
  display: flex;
  gap: var(--spacing-2);
}

.subscription-info {
  margin-left: var(--spacing-2);
  font-size: var(--text-sm);
}

.warning-text {
  color: var(--color-warning);
}

.success-text {
  color: var(--color-success);
}

.auth-prompt,
.loading-state,
.error-state {
  padding: var(--spacing-4);
  text-align: center;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border-subtle);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 定价弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgb(0 0 0 / 50%);
}

.modal-content {
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  padding: var(--spacing-6);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.pricing-options {
  display: grid;
  gap: var(--spacing-4);
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.pricing-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.pricing-card--featured {
  border-width: 2px;
  border-color: var(--color-primary);
}

.badge {
  position: absolute;
  top: -12px;
  right: var(--spacing-4);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: white;
  background: var(--color-primary);
}

.pricing-header {
  text-align: center;
}

.pricing-header h4 {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.price {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-primary);
}

.period {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  color: var(--color-text-secondary);
}

.savings {
  margin-top: var(--spacing-1);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-success);
}

.features {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.features li {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
