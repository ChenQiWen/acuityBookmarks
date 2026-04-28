<template>
  <div class="account-page">
    <!-- 未登录状态 -->
    <div v-if="!isAuthenticated" class="unauth-container">
      <div class="unauth-card">
        <div class="unauth-icon">🔒</div>
        <h1 class="unauth-title">请先登录</h1>
        <p class="unauth-message">您需要登录才能查看账户信息</p>
        <NuxtLink to="/login" class="account-button account-button--primary">
          前往登录
        </NuxtLink>
      </div>
    </div>

    <!-- 已登录状态：双栏布局 -->
    <div v-else class="account-layout">
      <!-- 左侧：用户信息面板 -->
      <aside class="profile-sidebar">
        <div class="profile-card">
          <!-- 头像 -->
          <div class="avatar-wrap">
            <img
              v-if="userAvatar && !avatarLoadFailed"
              :src="userAvatar"
              :alt="userName"
              class="avatar-img"
              @error="avatarLoadFailed = true"
            />
            <div v-else class="avatar-fallback">{{ userInitial }}</div>
            <div class="avatar-ring"></div>
          </div>

          <!-- 用户名 & 邮箱 -->
          <h2 class="profile-name">{{ userName }}</h2>
          <p class="profile-email">{{ user?.email }}</p>

          <!-- 标签 -->
          <div class="profile-tags">
            <span class="tag tag--provider">{{ loginProvider }}</span>
            <span class="tag tag--plan">免费版</span>
          </div>

          <!-- 分隔线 -->
          <div class="divider"></div>

          <!-- 元信息 -->
          <div class="profile-meta">
            <div class="meta-row">
              <span class="meta-key">用户 ID</span>
              <span class="meta-val mono">{{ user?.id?.substring(0, 8) }}…</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">注册时间</span>
              <span class="meta-val">{{ createdAt }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">最后登录</span>
              <span class="meta-val">{{ lastSignIn }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">邮箱验证</span>
              <span class="meta-val">
                <span v-if="user?.email_confirmed_at" class="badge badge--success">✓ 已验证</span>
                <span v-else class="badge badge--warning">⚠ 未验证</span>
              </span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="profile-actions">
            <button
              class="account-button account-button--danger"
              :disabled="isLoading"
              @click="handleSignOut"
            >
              <span v-if="!isLoading">退出登录</span>
              <span v-else>退出中…</span>
            </button>
            <NuxtLink to="/" class="account-button account-button--ghost">
              返回首页
            </NuxtLink>
          </div>
        </div>
      </aside>

      <!-- 右侧：内容区 -->
      <main class="account-main">
        <!-- 订阅状态卡片 -->
        <section class="content-card subscription-card">
          <div class="card-header">
            <h3 class="card-title">订阅状态</h3>
          </div>
          <div class="subscription-body">
            <div class="plan-info">
              <div class="plan-icon">🆓</div>
              <div class="plan-text">
                <div class="plan-name">免费版</div>
                <div class="plan-desc">升级到 Pro，解锁 AI 标签、无限书签同步等高级功能</div>
              </div>
            </div>
            <NuxtLink to="/pricing" class="account-button account-button--primary upgrade-btn">
              升级到 Pro →
            </NuxtLink>
          </div>
        </section>

        <!-- 快捷操作卡片 -->
        <section class="content-card">
          <div class="card-header">
            <h3 class="card-title">快捷操作</h3>
          </div>
          <div class="quick-grid">
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              class="quick-item"
            >
              <span class="quick-icon">🔌</span>
              <div class="quick-text">
                <div class="quick-title">安装扩展</div>
                <div class="quick-sub">Chrome Web Store</div>
              </div>
              <span class="quick-arrow">→</span>
            </a>
            <NuxtLink to="/docs" class="quick-item">
              <span class="quick-icon">📚</span>
              <div class="quick-text">
                <div class="quick-title">使用文档</div>
                <div class="quick-sub">查看帮助与教程</div>
              </div>
              <span class="quick-arrow">→</span>
            </NuxtLink>
            <NuxtLink to="/support" class="quick-item">
              <span class="quick-icon">💬</span>
              <div class="quick-text">
                <div class="quick-title">联系支持</div>
                <div class="quick-sub">获取客服帮助</div>
              </div>
              <span class="quick-arrow">→</span>
            </NuxtLink>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, isAuthenticated, signOut, initialize } = useAuth()
const isLoading = ref(false)
const avatarLoadFailed = ref(false)

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
/* ===== 页面容器 ===== */
.account-page {
  min-height: 100vh;
  padding: var(--md-sys-spacing-lg) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-background);
}

/* ===== 未登录状态 ===== */
.unauth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.unauth-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--md-sys-spacing-2xl);
  background-color: var(--md-sys-color-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-extra-large);
  max-width: 400px;
  gap: var(--md-sys-spacing-md);
}

.unauth-icon {
  font-size: 3rem;
}

.unauth-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.unauth-message {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
}

/* ===== 双栏布局 ===== */
.account-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--md-sys-spacing-lg);
  max-width: 1000px;
  margin: 0 auto;
  align-items: start;
}

/* ===== 左侧 Profile 卡片 ===== */
.profile-sidebar {
  position: sticky;
  top: calc(80px + var(--md-sys-spacing-md));
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--md-sys-spacing-xl) var(--md-sys-spacing-lg);
  background-color: var(--md-sys-color-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-extra-large);
  gap: var(--md-sys-spacing-sm);
}

/* 头像 */
.avatar-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: var(--md-sys-spacing-xs);
}

.avatar-img {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.avatar-fallback {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary));
  color: var(--md-sys-color-on-primary);
  font-size: 2.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-secondary));
  z-index: 0;
}

/* 用户名 & 邮箱 */
.profile-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.profile-email {
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
  word-break: break-all;
}

/* 标签 */
.profile-tags {
  display: flex;
  gap: var(--md-sys-spacing-xs);
  flex-wrap: wrap;
  justify-content: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.tag--provider {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
  color: var(--md-sys-color-primary);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 25%, transparent);
}

.tag--plan {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 15%, transparent);
  color: var(--md-sys-color-on-surface-variant);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-on-surface-variant) 30%, transparent);
}

/* 分隔线 */
.divider {
  width: 100%;
  height: 1px;
  background-color: var(--md-sys-color-outline-variant);
  margin: var(--md-sys-spacing-xs) 0;
}

/* 元信息列表 */
.profile-meta {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
}

.meta-key {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  flex-shrink: 0;
}

.meta-val {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  text-align: right;
}

.meta-val.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

/* 状态徽章 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge--success {
  background-color: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.badge--warning {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

/* 操作按钮区 */
.profile-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
  margin-top: var(--md-sys-spacing-xs);
}

/* ===== 通用按钮 ===== */
.account-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: var(--md-sys-shape-corner-medium);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
  width: 100%;
}

.account-button--primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.account-button--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 8%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
}

.account-button--danger {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
  color: var(--md-sys-color-error);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-error) 25%, transparent);
}

.account-button--danger:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 20%, transparent);
  transform: translateY(-1px);
}

.account-button--ghost {
  background-color: transparent;
  color: var(--md-sys-color-on-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
}

.account-button--ghost:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent);
  color: var(--md-sys-color-on-surface);
}

.account-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ===== 右侧内容区 ===== */
.account-main {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-md);
}

.content-card {
  padding: var(--md-sys-spacing-lg);
  background-color: var(--md-sys-color-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-extra-large);
}

.card-header {
  margin-bottom: var(--md-sys-spacing-md);
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

/* 订阅卡片 */
.subscription-card {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-primary) 15%, var(--md-sys-color-surface-variant)) 0%,
    var(--md-sys-color-surface-variant) 100%
  );
}

.subscription-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-sys-spacing-md);
  flex-wrap: wrap;
}

.plan-info {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
}

.plan-icon {
  font-size: 2rem;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 10%, transparent);
  border-radius: var(--md-sys-shape-corner-medium);
  flex-shrink: 0;
}

.plan-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 2px;
}

.plan-desc {
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  max-width: 280px;
}

.upgrade-btn {
  width: auto;
  flex-shrink: 0;
  white-space: nowrap;
}

/* 快捷操作 */
.quick-grid {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
}

.quick-item {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-large);
  text-decoration: none;
  color: var(--md-sys-color-on-surface);
  transition: all 0.18s ease;
  border: 1px solid transparent;
}

.quick-item:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent);
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.quick-icon {
  font-size: 1.375rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
  border-radius: var(--md-sys-shape-corner-small);
  flex-shrink: 0;
}

.quick-text {
  flex: 1;
}

.quick-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.quick-sub {
  font-size: 0.75rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 1px;
}

.quick-arrow {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.quick-item:hover .quick-arrow {
  opacity: 1;
  transform: translateX(3px);
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .account-page {
    padding: var(--md-sys-spacing-md) var(--md-sys-spacing-sm);
  }

  .account-layout {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: static;
  }

  .subscription-body {
    flex-direction: column;
    align-items: flex-start;
  }

  .upgrade-btn {
    width: 100%;
  }
}
</style>
