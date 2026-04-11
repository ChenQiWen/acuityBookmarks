<template>
  <App app class="app-container">
    <AppHeader
      :show-side-panel-toggle="false"
      :show-settings="false"
      :show-account="false"
    />
    <Main class="main-content">
      <div class="subscription-body">
        <!-- 标题区 -->
        <div class="subscription-hero">
          <Icon name="icon-crown" :size="48" class="subscription-hero__icon" />
          <h1 class="subscription-hero__title">升级到 PRO</h1>
          <p class="subscription-hero__desc">解锁 AI 智能功能，让书签管理更高效</p>
        </div>

        <!-- 已是 PRO 用户 -->
        <div v-if="isPro" class="subscription-active">
          <Icon name="icon-check-circle" :size="32" class="subscription-active__icon" />
          <h2 class="subscription-active__title">你已是 PRO 会员</h2>
          <p v-if="subscriptionStatus?.current_period_end" class="subscription-active__expire">
            {{ isCancelledButActive ? '到期后不续费，有效至' : '有效至' }}
            {{ formatDate(subscriptionStatus.current_period_end) }}
          </p>
          <div class="subscription-active__actions">
            <Button color="primary" variant="outline" @click="handleManage">
              管理订阅
            </Button>
            <Button variant="ghost" @click="handleBack">
              返回
            </Button>
          </div>
        </div>

        <!-- 未订阅：方案选择 -->
        <template v-else>
          <!-- 权益对比 -->
          <div class="subscription-features">
            <div
              v-for="feature in features"
              :key="feature.id"
              class="subscription-feature"
            >
              <Icon name="icon-check-circle" :size="16" class="subscription-feature__icon" />
              <div>
                <p class="subscription-feature__name">{{ feature.name }}</p>
                <p class="subscription-feature__desc">{{ feature.desc }}</p>
              </div>
            </div>
          </div>

          <!-- 价格卡片 -->
          <div class="subscription-plans">
            <!-- 月付 -->
            <div class="plan-card">
              <div class="plan-card__header">
                <h3 class="plan-card__name">月付</h3>
                <div class="plan-card__price">
                  <span class="plan-card__amount">{{ formatPrice(proPlan.price.monthly) }}</span>
                  <span class="plan-card__period">/ 月</span>
                </div>
              </div>
              <ul class="plan-card__perks">
                <li>按月计费，随时取消</li>
                <li>全部 PRO 功能</li>
              </ul>
              <Button
                variant="outline"
                color="primary"
                size="lg"
                :loading="loading"
                class="plan-card__cta"
                @click="handleMonthly"
              >
                选择月付
              </Button>
            </div>

            <!-- 年付（推荐） -->
            <div class="plan-card plan-card--featured">
              <div v-if="proPlan.badge" class="plan-card__badge">{{ proPlan.badge }}</div>
              <div class="plan-card__header">
                <h3 class="plan-card__name">年付</h3>
                <div class="plan-card__price">
                  <span class="plan-card__amount">{{ formatPrice(proPlan.price.yearly) }}</span>
                  <span class="plan-card__period">/ 年</span>
                </div>
                <p v-if="yearlyDiscount > 0" class="plan-card__savings">
                  比月付节省 {{ yearlyDiscount }}%
                </p>
              </div>
              <ul class="plan-card__perks">
                <li>按年计费，更划算</li>
                <li>全部 PRO 功能</li>
                <li>优先客户支持</li>
              </ul>
              <Button
                color="primary"
                size="lg"
                :loading="loading"
                class="plan-card__cta"
                @click="handleYearly"
              >
                选择年付
              </Button>
            </div>
          </div>

          <!-- 底部说明 -->
          <p class="subscription-note">
            付款由 Gumroad 安全处理，随时可取消订阅
          </p>
        </template>
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { App, AppHeader, Button, Icon, Main } from '@/components'
import { useSubscription } from '@/composables'
import { notificationService } from '@/application/notification/notification-service'
import { PLANS, getPlanByTier, calculateYearlyDiscount } from '@/types/subscription/plan'
import { formatDateTime } from '@/utils/time-formatter'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({ name: 'SubscriptionPage' })

const {
  isPro,
  subscriptionStatus,
  isCancelledButActive,
  loading,
  subscribeMonthly,
  subscribeYearly,
  openManagePortal
} = useSubscription()

const proPlan = computed(() => getPlanByTier('pro') || PLANS[1])

const yearlyDiscount = computed(() =>
  calculateYearlyDiscount(proPlan.value.price.monthly, proPlan.value.price.yearly)
)

/** 读取来源页，付费成功后跳回 */
function getRedirectUrl(): string | null {
  try {
    const url = new URL(window.location.href)
    return url.searchParams.get('redirect')
  } catch {
    return null
  }
}

function formatDate(dateString: string): string {
  return formatDateTime(new Date(dateString).getTime(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

const features = [
  { id: 'ai-tag', name: 'AI 智能标签', desc: '自动为书签生成分类标签，无需手动整理' },
  { id: 'vector', name: '语义向量检索', desc: '用自然语言描述，精准找到相关书签' },
  { id: 'embedding', name: '内容嵌入分析', desc: '深度理解书签页面内容' },
  { id: 'unlimited', name: '无限书签同步', desc: '突破免费版数量限制' }
]

async function handleMonthly() {
  try {
    await subscribeMonthly()
    notificationService.notify('正在跳转到支付页面...', { level: 'success' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '创建支付链接失败'
    notificationService.notify(msg, { level: 'error' })
    logger.error('SubscriptionPage', '月付订阅失败', err)
  }
}

async function handleYearly() {
  try {
    await subscribeYearly()
    notificationService.notify('正在跳转到支付页面...', { level: 'success' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '创建支付链接失败'
    notificationService.notify(msg, { level: 'error' })
    logger.error('SubscriptionPage', '年付订阅失败', err)
  }
}

function handleManage() {
  openManagePortal()
}

function handleBack() {
  const redirect = getRedirectUrl()
  if (redirect) {
    try {
      const url = chrome?.runtime?.getURL ? chrome.runtime.getURL(redirect) : redirect
      window.location.href = url
      return
    } catch {
      // fallback
    }
  }
  window.history.back()
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  background: var(--color-background);
}

.subscription-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-6);
  max-width: 760px;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
}

/* 标题区 */
.subscription-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  text-align: center;
}

.subscription-hero__icon {
  color: var(--md-sys-color-primary);
}

.subscription-hero__title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}

.subscription-hero__desc {
  margin: 0;
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

/* 已激活 */
.subscription-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
  padding: var(--spacing-6);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  border-radius: var(--radius-lg);
  text-align: center;
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.subscription-active__icon {
  color: var(--md-sys-color-primary);
}

.subscription-active__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.subscription-active__expire {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.subscription-active__actions {
  display: flex;
  gap: var(--spacing-3);
}

/* 权益列表 */
.subscription-features {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  width: 100%;
}

.subscription-feature {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.subscription-feature__icon {
  flex-shrink: 0;
  margin-top: var(--spacing-1);
  color: var(--md-sys-color-primary);
}

.subscription-feature__name {
  margin: 0 0 var(--spacing-1) 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.subscription-feature__desc {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* 价格卡片 */
.subscription-plans {
  display: grid;
  gap: var(--spacing-4);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  width: 100%;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.plan-card--featured {
  border-width: 2px;
  border-color: var(--md-sys-color-primary);
}

.plan-card__badge {
  position: absolute;
  top: -12px;
  right: var(--spacing-4);
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-primary);
  background: var(--md-sys-color-primary);
}

.plan-card__header {
  text-align: center;
}

.plan-card__name {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.plan-card__price {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: var(--spacing-1);
}

.plan-card__amount {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--md-sys-color-primary);
}

.plan-card__period {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.plan-card__savings {
  margin: var(--spacing-1) 0 0 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-primary);
}

.plan-card__perks {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-card__perks li {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.plan-card__perks li::before {
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-primary);
  content: '✓ ';
}

.plan-card__cta {
  width: 100%;
}

.subscription-note {
  margin: 0;
  font-size: var(--text-xs);
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
