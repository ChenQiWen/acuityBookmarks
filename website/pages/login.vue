<template>
  <div class="auth-page">
    <!-- Logo 和标题 -->
    <div class="auth-header">
      <div class="auth-logo">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="80" fill="currentColor" opacity="0.2" />
          <path
            d="M100 30 L120 70 L165 75 L130 108 L140 155 L100 132 L60 155 L70 108 L35 75 L80 70 Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <h1 class="auth-title">AcuityBookmarks</h1>
      <p class="auth-subtitle">智能书签管理，一键登录</p>
    </div>

    <!-- 登录表单 -->
    <div class="auth-form">
      <h2 class="form-title">欢迎使用</h2>
      <p class="form-subtitle">使用以下方式快速登录</p>

      <!-- 错误提示 -->
      <div
        v-if="authError"
        class="auth-alert"
      >
        <p class="auth-alert-text">{{ authError }}</p>
      </div>

      <!-- OAuth 登录按钮 -->
      <div class="oauth-buttons">
        <button
          :disabled="isLoading"
          class="oauth-btn oauth-btn--google"
          @click="handleGoogleLogin"
        >
          <svg class="oauth-icon" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span v-if="!isGoogleLoading">使用 Google 登录</span>
          <span v-else>登录中...</span>
        </button>

        <button
          :disabled="isLoading"
          class="oauth-btn oauth-btn--microsoft"
          @click="handleMicrosoftLogin"
        >
          <svg class="oauth-icon" viewBox="0 0 24 24">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#00a4ef" d="M13 1h10v10H13z" />
            <path fill="#7fba00" d="M1 13h10v10H1z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
          <span v-if="!isMicrosoftLoading">使用 Microsoft 登录</span>
          <span v-else>登录中...</span>
        </button>
      </div>

      <!-- 隐私提示 -->
      <p class="auth-privacy-notice">
        登录即表示您同意我们的
        <NuxtLink to="/terms" target="_blank">服务条款</NuxtLink>
        和
        <NuxtLink to="/privacy" target="_blank">隐私政策</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  title: '登录',
  description: '登录您的 AcuityBookmarks 账户'
})

useSeoMeta({
  title: '登录 - AcuityBookmarks',
  description: '登录您的 AcuityBookmarks 账户，开始高效管理您的书签',
  ogTitle: '登录 - AcuityBookmarks',
  ogDescription: '登录您的 AcuityBookmarks 账户，开始高效管理您的书签'
})

const { signInWithOAuth, setOAuthSession, user, initialize } = useAuth()

// 状态
const authError = ref('')
const isGoogleLoading = ref(false)
const isMicrosoftLoading = ref(false)
const isProcessingCallback = ref(false)

const isLoading = computed(
  () => isGoogleLoading.value || isMicrosoftLoading.value || isProcessingCallback.value
)

/**
 * 登录成功后跳转
 */
const navigateToHome = () => {
  // 跳转到账户页或首页
  navigateTo('/account')
}

/**
 * 处理 OAuth 回调（从 URL hash 中提取 token）
 */
const handleOAuthCallback = async () => {
  try {
    const hash = window.location.hash
    
    if (!hash || !hash.includes('access_token')) {
      console.log('[Auth] 没有 OAuth 回调参数')
      return
    }

    console.log('[Auth] 检测到 OAuth 回调，开始处理...')
    isProcessingCallback.value = true
    authError.value = ''

    // 解析 URL hash 参数
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    console.log('[Auth] OAuth 回调参数', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    })

    if (!accessToken || !refreshToken) {
      throw new Error('OAuth 回调缺少必要的 token')
    }

    // 使用 Supabase 设置 session
    await setOAuthSession(accessToken, refreshToken)
    console.log('[Auth] Session 设置成功')

    // 清除 URL hash
    window.location.hash = ''

    // 短暂延迟后跳转
    setTimeout(() => {
      console.log('[Auth] 跳转到主页...')
      navigateToHome()
    }, 1000)

  } catch (error) {
    console.error('[Auth] OAuth 回调处理失败', error)
    authError.value = error instanceof Error ? error.message : 'OAuth 登录失败'
    isProcessingCallback.value = false
  }
}

/**
 * 页面加载时检查登录状态和 OAuth 回调
 */
onMounted(async () => {
  // 1. 先初始化认证状态
  await initialize()
  
  // 2. 检查用户是否已登录
  if (user.value) {
    console.log('[Auth] 用户已登录，跳转到账户页面')
    navigateToHome()
    return
  }

  // 3. 如果未登录，检查是否有 OAuth 回调
  handleOAuthCallback()
})

/**
 * 处理 Google 登录
 */
const handleGoogleLogin = async () => {
  try {
    isGoogleLoading.value = true
    authError.value = ''

    console.log('[Auth] 开始 Google OAuth 登录...')
    
    const { url } = await signInWithOAuth('google')
    
    // 跳转到 OAuth 授权页面
    window.location.href = url
  } catch (error) {
    console.error('[Auth] Google 登录失败', error)
    
    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value = error instanceof Error ? error.message : 'Google 登录失败，请重试'
    }
  } finally {
    isGoogleLoading.value = false
  }
}

/**
 * 处理 Microsoft 登录
 */
const handleMicrosoftLogin = async () => {
  try {
    isMicrosoftLoading.value = true
    authError.value = ''

    console.log('[Auth] 开始 Microsoft OAuth 登录...')
    
    const { url } = await signInWithOAuth('microsoft')
    
    // 跳转到 OAuth 授权页面
    window.location.href = url
  } catch (error) {
    console.error('[Auth] Microsoft 登录失败', error)
    
    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value = error instanceof Error ? error.message : 'Microsoft 登录失败，请重试'
    }
  } finally {
    isMicrosoftLoading.value = false
  }
}
</script>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }

  33% {
    transform: translate(30px, -30px) rotate(120deg);
  }

  66% {
    transform: translate(-20px, 20px) rotate(240deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }
}

.auth-page {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--spacing-6);
  background: linear-gradient(
    135deg,
    var(--md-sys-color-primary-container) 0%,
    var(--md-sys-color-secondary-container) 100%
  );
  overflow: hidden;
}

.auth-page::before {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle,
    rgb(255 255 255 / 10%) 0%,
    transparent 70%
  );
  animation: float 20s ease-in-out infinite;
  content: '';
}

.auth-page::after {
  position: absolute;
  bottom: -50%;
  left: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle,
    rgb(255 255 255 / 5%) 0%,
    transparent 70%
  );
  animation: float 25s ease-in-out infinite reverse;
  content: '';
}

.auth-header {
  position: relative;
  z-index: 1;
  margin-bottom: var(--spacing-8);
  text-align: center;
}

.auth-logo {
  width: 120px;
  height: 120px;
  margin: 0 auto var(--spacing-4);
  color: var(--md-sys-color-on-primary-container);
  filter: drop-shadow(0 4px 12px rgb(0 0 0 / 20%));
  animation: pulse 3s ease-in-out infinite;
}

.auth-title {
  margin-bottom: var(--spacing-2);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  text-align: center;
  color: var(--md-sys-color-on-primary-container);
  text-shadow: 0 2px 8px rgb(0 0 0 / 20%);
}

.auth-subtitle {
  font-size: var(--text-lg);
  text-align: center;
  color: rgb(255 255 255 / 90%);
  text-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}

.auth-form {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: var(--spacing-8);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
}

@media (width <= 480px) {
  .auth-form {
    max-width: 100%;
    padding: var(--spacing-6);
  }
}

.form-title {
  margin-bottom: var(--spacing-2);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  text-align: center;
  color: var(--color-text-primary);
}

.form-subtitle {
  margin-bottom: var(--spacing-6);
  font-size: var(--text-sm);
  text-align: center;
  color: var(--color-text-secondary);
}

.auth-alert {
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.auth-alert-text {
  font-size: var(--text-sm);
  color: #ef4444;
  text-align: center;
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.oauth-btn {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border: 2px solid;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.oauth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.oauth-btn--google {
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-primary);
}

.oauth-btn--google:hover:not(:disabled) {
  color: var(--md-sys-color-on-primary);
  background-color: var(--md-sys-color-primary);
  box-shadow: 0 4px 12px rgb(66 133 244 / 30%);
}

.oauth-btn--microsoft {
  border-color: var(--md-sys-color-secondary);
  color: var(--md-sys-color-secondary);
}

.oauth-btn--microsoft:hover:not(:disabled) {
  color: var(--md-sys-color-on-secondary);
  background-color: var(--md-sys-color-secondary);
  box-shadow: 0 4px 12px rgb(0 164 239 / 30%);
}

.oauth-icon {
  width: 20px;
  height: 20px;
}

.auth-privacy-notice {
  margin-top: var(--spacing-4);
  font-size: var(--text-xs);
  line-height: 1.6;
  text-align: center;
  color: var(--color-text-secondary);
}

.auth-privacy-notice a {
  text-decoration: none;
  color: var(--md-sys-color-primary);
  transition: color 0.2s ease;
}

.auth-privacy-notice a:hover {
  text-decoration: underline;
  color: color-mix(in srgb, var(--md-sys-color-primary) 80%, var(--color-text-primary) 20%);
}
</style>
