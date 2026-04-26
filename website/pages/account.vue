<template>
  <div class="account-page">
    <div class="account-container">
      <div v-if="!isAuthenticated" class="account-card account-card--center">
        <div class="account-icon">🔒</div>
        <h1 class="account-title">请先登录</h1>
        <p class="account-message">您需要登录才能查看账户信息</p>
        <NuxtLink to="/login" class="account-button account-button--primary">
          前往登录
        </NuxtLink>
      </div>

      <div v-else class="account-content">
        <h1 class="page-title">账户信息</h1>
        
        <div class="account-card">
          <div class="user-avatar">
            <img 
              v-if="userAvatar" 
              :src="userAvatar" 
              :alt="userName"
              class="avatar-image"
            />
            <div v-else class="avatar-placeholder">
              {{ userInitial }}
            </div>
          </div>

          <div class="user-info">
            <h2 class="user-name">{{ userName }}</h2>
            <p class="user-email">{{ user?.email }}</p>
            <div class="user-meta">
              <div class="user-meta-item">
                <span class="meta-label">用户 ID</span>
                <span class="meta-value">{{ user?.id?.substring(0, 8) }}...</span>
              </div>
              <div class="user-meta-item">
                <span class="meta-label">登录方式</span>
                <span class="meta-value">{{ loginProvider }}</span>
              </div>
            </div>
          </div>

          <div class="account-actions">
            <button 
              class="account-button account-button--danger"
              :disabled="isLoading"
              @click="handleSignOut"
            >
              <span v-if="!isLoading">退出登录</span>
              <span v-else>退出中...</span>
            </button>
            <NuxtLink to="/" class="account-button account-button--outline">
              返回首页
            </NuxtLink>
          </div>
        </div>

        <div class="account-card">
          <h3 class="card-title">账户详情</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">注册时间</span>
              <span class="info-value">{{ createdAt }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">最后登录</span>
              <span class="info-value">{{ lastSignIn }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">邮箱验证</span>
              <span class="info-value">
                <span v-if="user?.email_confirmed_at" class="status-badge status-badge--success">
                  ✓ 已验证
                </span>
                <span v-else class="status-badge status-badge--warning">
                  ⚠ 未验证
                </span>
              </span>
            </div>
          </div>
        </div>

        <div class="account-card">
          <h3 class="card-title">订阅状态</h3>
          <div class="subscription-info">
            <div class="subscription-badge subscription-badge--free">
              <span class="badge-icon">🆓</span>
              <span class="badge-text">免费版</span>
            </div>
            <p class="subscription-desc">升级到 Pro 版本，解锁更多高级功能</p>
            <NuxtLink to="/pricing" class="account-button account-button--primary">
              查看订阅计划
            </NuxtLink>
          </div>
        </div>

        <div class="account-card">
          <h3 class="card-title">快捷操作</h3>
          <div class="quick-actions">
            <a 
              href="https://chrome.google.com/webstore" 
              target="_blank"
              class="quick-action-item"
            >
              <span class="action-icon">🔌</span>
              <span class="action-text">安装浏览器扩展</span>
            </a>
            <NuxtLink to="/docs" class="quick-action-item">
              <span class="action-icon">📚</span>
              <span class="action-text">查看使用文档</span>
            </NuxtLink>
            <NuxtLink to="/support" class="quick-action-item">
              <span class="action-icon">💬</span>
              <span class="action-text">联系客服支持</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, isAuthenticated, signOut, initialize } = useAuth()
const isLoading = ref(false)

onMounted(() => {
  initialize()
})

const userName = computed(() => {
  if (!user.value) return '未知用户'
  const metadata = user.value.user_metadata
  if (metadata?.full_name) return metadata.full_name
  if (metadata?.name) return metadata.name
  if (user.value.email) return user.value.email.split('@')[0]
  return '未知用户'
})

const userAvatar = computed(() => {
  if (!user.value) return null
  const metadata = user.value.user_metadata
  return metadata?.avatar_url || metadata?.picture || null
})

const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const loginProvider = computed(() => {
  if (!user.value) return '未知'
  const appMetadata = user.value.app_metadata
  const provider = appMetadata?.provider
  if (provider === 'google') return 'Google'
  if (provider === 'azure') return 'Microsoft'
  return provider || '未知'
})

const createdAt = computed(() => {
  if (!user.value?.created_at) return '未知'
  const date = new Date(user.value.created_at)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const lastSignIn = computed(() => {
  if (!user.value?.last_sign_in_at) return '未知'
  const date = new Date(user.value.last_sign_in_at)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const handleSignOut = async () => {
  try {
    isLoading.value = true
    await signOut()
    await navigateTo('/')
  } catch (error) {
    console.error('[Account] 退出登录失败:', error)
    alert('退出登录失败，请重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  padding: var(--spacing-6);
  background: linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-secondary-container) 100%);
}

.account-container {
  max-width: 900px;
  margin: 0 auto;
}

.page-title {
  margin-bottom: var(--spacing-6);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  text-align: center;
  color: var(--color-text-primary);
}

.account-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.account-card {
  padding: var(--spacing-8);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.account-card--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.card-title {
  margin: 0 0 var(--spacing-4);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.account-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-4);
}

.account-title {
  margin-bottom: var(--spacing-2);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}

.account-message {
  margin: 0 0 var(--spacing-4);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

.user-avatar {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-4);
}

.avatar-image {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--md-sys-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 3rem;
  font-weight: var(--font-bold);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.user-info {
  text-align: center;
  margin-bottom: var(--spacing-6);
}

.user-name {
  margin: 0 0 var(--spacing-2);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.user-email {
  margin: 0 0 var(--spacing-4);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}

.user-meta {
  display: flex;
  justify-content: center;
  gap: var(--spacing-8);
  flex-wrap: wrap;
}

.user-meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  align-items: center;
}

.meta-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.account-actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.account-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.account-button--primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.account-button--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 10%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.account-button--danger {
  background-color: #ef4444;
  color: white;
}

.account-button--danger:hover:not(:disabled) {
  background-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.account-button--outline {
  background-color: transparent;
  color: var(--color-text-primary);
  border: 2px solid var(--color-border);
}

.account-button--outline:hover {
  background-color: var(--color-background);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-primary);
}

.account-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.info-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.status-badge {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-badge--success {
  background-color: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-badge--warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.subscription-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  text-align: center;
}

.subscription-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.subscription-badge--free {
  background-color: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.badge-icon {
  font-size: 1.5rem;
}

.subscription-desc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-3);
}

.quick-action-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.quick-action-item:hover {
  border-color: var(--md-sys-color-primary);
  background-color: rgba(131, 213, 197, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-icon {
  font-size: 1.5rem;
}

.action-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

@media (width <= 768px) {
  .account-page {
    padding: var(--spacing-4);
  }
  .account-card {
    padding: var(--spacing-6);
  }
  .user-meta {
    flex-direction: column;
    gap: var(--spacing-3);
  }
  .account-actions {
    flex-direction: column;
    width: 100%;
  }
  .account-button {
    width: 100%;
  }
  .info-grid {
    grid-template-columns: 1fr;
  }
  .quick-actions {
    grid-template-columns: 1fr;
  }
}
</style>
