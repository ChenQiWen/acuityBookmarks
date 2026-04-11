<template>
  <App app class="app-container">
    <AppHeader
      :show-side-panel-toggle="false"
      :show-settings="false"
      :show-account="false"
    />
    <Main class="main-content">
      <div class="account-body">
        <!-- 未登录：引导登录 -->
        <div v-if="!isAuthenticated" class="account-guest">
          <Icon name="icon-account" :size="64" class="account-guest__icon" />
          <h2 class="account-guest__title">请先登录</h2>
          <p class="account-guest__desc">登录后查看账户信息和会员权益</p>
          <Button color="primary" size="lg" @click="handleLogin">
            <template #prepend><Icon name="icon-login" /></template>
            登录 / 注册
          </Button>
        </div>

        <!-- 已登录：账户信息 -->
        <template v-else>
          <!-- 用户信息卡片 -->
          <section class="account-card">
            <div class="account-profile">
              <Avatar
                :src="avatarUrl"
                :text="avatarInitial"
                :size="72"
                variant="circle"
              />
              <div class="account-profile__info">
                <h2 class="account-profile__name">{{ displayName }}</h2>
                <p class="account-profile__email">{{ userEmail }}</p>
                <div class="account-profile__meta">
                  <Badge
                    v-if="loginProvider"
                    color="secondary"
                    variant="outlined"
                    size="sm"
                  >
                    {{ loginProviderLabel }}
                  </Badge>
                  <Badge
                    :color="isPro ? 'primary' : 'secondary'"
                    variant="filled"
                    size="sm"
                  >
                    {{ isPro ? 'PRO 会员' : 'FREE' }}
                  </Badge>
                </div>
              </div>
            </div>
          </section>

          <!-- 订阅状态 -->
          <section class="account-card">
            <h3 class="account-card__title">
              <Icon name="icon-crown" :size="18" />
              当前计划
            </h3>
            <div v-if="isPro" class="account-plan account-plan--pro">
              <div class="account-plan__info">
                <span class="account-plan__name">PRO 会员</span>
                <span v-if="subscriptionStatus?.current_period_end" class="account-plan__expire">
                  {{ isCancelledButActive ? '到期后不续费，有效至' : '有效至' }}
                  {{ formatDate(subscriptionStatus.current_period_end) }}
                </span>
              </div>
              <Button variant="outline" size="sm" @click="handleManageSubscription">
                管理订阅
              </Button>
            </div>
            <div v-else class="account-plan account-plan--free">
              <div class="account-plan__info">
                <span class="account-plan__name">免费版</span>
                <span class="account-plan__desc">升级解锁 AI 智能功能</span>
              </div>
              <Button color="primary" size="sm" @click="handleUpgrade">
                <template #prepend><Icon name="icon-crown" /></template>
                升级到 PRO
              </Button>
            </div>
          </section>

          <!-- PRO 权益清单 -->
          <section class="account-card">
            <h3 class="account-card__title">
              <Icon name="icon-star" :size="18" />
              {{ isPro ? '已开通权益' : 'PRO 会员权益' }}
            </h3>
            <ul class="account-benefits">
              <li
                v-for="benefit in benefits"
                :key="benefit.id"
                class="account-benefit"
                :class="{ 'account-benefit--locked': !isPro && !benefit.free }"
              >
                <Icon
                  :name="isPro || benefit.free ? 'icon-check-circle' : 'icon-lock'"
                  :size="16"
                  class="account-benefit__icon"
                  :class="{
                    'account-benefit__icon--active': isPro || benefit.free,
                    'account-benefit__icon--locked': !isPro && !benefit.free
                  }"
                />
                <div class="account-benefit__content">
                  <span class="account-benefit__name">{{ benefit.name }}</span>
                  <span class="account-benefit__desc">{{ benefit.desc }}</span>
                </div>
                <Badge v-if="benefit.auto && isPro" color="primary" variant="outlined" size="sm">
                  已自动开通
                </Badge>
              </li>
            </ul>
          </section>

          <!-- 危险操作区 -->
          <section class="account-card account-card--danger">
            <h3 class="account-card__title account-card__title--danger">
              <Icon name="icon-warning" :size="18" />
              账户操作
            </h3>
            <Button
              color="error"
              variant="outline"
              size="md"
              :loading="isLoggingOut"
              @click="handleLogout"
            >
              <template #prepend><Icon name="icon-logout-variant" /></template>
              退出登录
            </Button>
          </section>
        </template>
      </div>
    </Main>
  </App>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { App, AppHeader, Avatar, Badge, Button, Icon, Main } from '@/components'
import { useSupabaseAuth } from '@/composables'
import { useSubscription } from '@/composables'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { logger } from '@/infrastructure/logging/logger'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
import { formatDateTime } from '@/utils/time-formatter'

defineOptions({ name: 'AccountPage' })

const { user, isAuthenticated, signOut } = useSupabaseAuth()
const { isPro, subscriptionStatus, isCancelledButActive, openManagePortal } = useSubscription()

const isLoggingOut = ref(false)
const storedLoginProvider = ref<string | null>(null)

/** 用户邮箱 */
const userEmail = computed(() => user.value?.email ?? '')

/** 显示名称 */
const displayName = computed(() => {
  if (!user.value) return ''
  const meta = user.value.user_metadata
  return meta?.full_name || meta?.name || user.value.email?.split('@')[0] || ''
})

/** 头像 URL */
const avatarUrl = computed(() => {
  if (!user.value) return undefined
  const meta = user.value.user_metadata
  return meta?.avatar_url || meta?.picture || meta?.avatar || meta?.photo || undefined
})

/** 头像首字母 */
const avatarInitial = computed(() => {
  if (displayName.value) return displayName.value.charAt(0).toUpperCase()
  if (userEmail.value) return userEmail.value.charAt(0).toUpperCase()
  return '?'
})

/** 登录方式 */
const loginProvider = computed(() => {
  const stored = storedLoginProvider.value
  if (stored === 'google' || stored === 'github' || stored === 'microsoft') return stored
  const appProvider = user.value?.app_metadata?.provider
  const normalized = appProvider === 'azure' ? 'microsoft' : appProvider
  if (normalized === 'google' || normalized === 'github' || normalized === 'microsoft') return normalized
  return null
})

const loginProviderLabel = computed(() => {
  const p = loginProvider.value
  if (p === 'google') return 'Google 登录'
  if (p === 'github') return 'GitHub 登录'
  if (p === 'microsoft') return 'Microsoft 登录'
  return ''
})

/** 格式化日期 */
function formatDate(dateString: string): string {
  return formatDateTime(new Date(dateString).getTime(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/** PRO 权益列表 */
const benefits = [
  {
    id: 'ai-tag',
    name: 'AI 智能标签',
    desc: '自动为书签生成分类标签',
    free: false,
    auto: true
  },
  {
    id: 'vector-search',
    name: '语义向量检索',
    desc: '用自然语言找到相关书签',
    free: false,
    auto: false
  },
  {
    id: 'embedding',
    name: '内容嵌入分析',
    desc: '深度理解书签内容',
    free: false,
    auto: false
  },
  {
    id: 'unlimited-sync',
    name: '无限书签同步',
    desc: '突破免费版数量限制',
    free: false,
    auto: true
  },
  {
    id: 'basic-sync',
    name: '基础书签管理',
    desc: '同步、整理、筛选书签',
    free: true,
    auto: true
  }
]

async function handleLogin() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('auth.html')
      : '/auth.html'
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('AccountPage', '打开登录页失败', error)
  }
}

async function handleUpgrade() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('subscription.html')
      : '/subscription.html'
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('AccountPage', '打开订阅页失败', error)
  }
}

function handleManageSubscription() {
  openManagePortal()
}

async function handleLogout() {
  if (isLoggingOut.value) return
  try {
    isLoggingOut.value = true
    await signOut()
    emitEvent('auth:logged-out', {})
    const authUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('auth.html')
      : 'auth.html'
    window.location.href = authUrl
  } catch (error) {
    logger.error('AccountPage', '退出登录失败', error)
    isLoggingOut.value = false
  }
}

onMounted(async () => {
  try {
    const saved = await modernStorage.getLocal<string>('current_login_provider')
    storedLoginProvider.value = saved || null
  } catch (error) {
    logger.error('AccountPage', '读取 provider 失败', error)
  }
})
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

.account-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  max-width: 680px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4);
}

/* 未登录 */
.account-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-8) var(--spacing-4);
  text-align: center;
}

.account-guest__icon {
  color: var(--color-text-secondary);
}

.account-guest__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.account-guest__desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 卡片 */
.account-card {
  padding: var(--spacing-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.account-card--danger {
  border-color: color-mix(in srgb, var(--md-sys-color-error) 30%, transparent);
}

.account-card__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.account-card__title--danger {
  color: var(--md-sys-color-error);
}

/* 用户信息 */
.account-profile {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.account-profile__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-2);
  min-width: 0;
}

.account-profile__name {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.account-profile__email {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.account-profile__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
}

/* 订阅计划 */
.account-plan {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
}

.account-plan--pro {
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.account-plan--free {
  background: var(--color-surface-variant);
}

.account-plan__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.account-plan__name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.account-plan__expire,
.account-plan__desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 权益列表 */
.account-benefits {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.account-benefit {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.account-benefit--locked {
  opacity: 0.5;
}

.account-benefit__icon--active {
  color: var(--md-sys-color-primary);
}

.account-benefit__icon--locked {
  color: var(--color-text-secondary);
}

.account-benefit__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-1);
}

.account-benefit__name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.account-benefit__desc {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
