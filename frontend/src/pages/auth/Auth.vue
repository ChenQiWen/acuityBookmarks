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
      <Alert
        v-if="authError"
        :message="authError"
        color="error"
        variant="filled"
        size="md"
        class="auth-alert"
      />

      <!-- OAuth 登录按钮 -->
      <div class="oauth-buttons">
        <Button
          color="primary"
          size="lg"
          variant="outline"
          :loading="isGoogleLoading"
          :disabled="isLoading"
          class="oauth-btn oauth-btn--google"
          data-testid="btn-google-login"
          @click="handleGoogleLogin"
        >
          <template #prepend>
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
          </template>
          使用 Google 登录
        </Button>

        <Button
          color="primary"
          size="lg"
          variant="outline"
          :loading="isMicrosoftLoading"
          :disabled="isLoading"
          class="oauth-btn oauth-btn--microsoft"
          data-testid="btn-microsoft-login"
          @click="handleMicrosoftLogin"
        >
          <template #prepend>
            <svg class="oauth-icon" viewBox="0 0 24 24">
              <path fill="#f25022" d="M1 1h10v10H1z" />
              <path fill="#00a4ef" d="M13 1h10v10H13z" />
              <path fill="#7fba00" d="M1 13h10v10H1z" />
              <path fill="#ffb900" d="M13 13h10v10H13z" />
            </svg>
          </template>
          使用 Microsoft 登录
        </Button>
      </div>

      <!-- 隐私提示 -->
      <p class="auth-privacy-notice">
        登录即表示您同意我们的
        <a href="/terms" target="_blank">服务条款</a>
        和
        <a href="/privacy" target="_blank">隐私政策</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Button, Alert } from '@/components'
import { useSupabaseAuth } from '@/composables'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { supabase } from '@/infrastructure/supabase/client'
import { modernStorage } from '@/infrastructure/storage/modern-storage'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'AuthPage'
})

const { signInWithOAuth } = useSupabaseAuth()

// 状态
const authError = ref('')
const isGoogleLoading = ref(false)
const isMicrosoftLoading = ref(false)
const isProcessingCallback = ref(false)

const isLoading = computed(
  () => isGoogleLoading.value || isMicrosoftLoading.value || isProcessingCallback.value
)

/**
 * 登录成功后跳转到主页
 */
const navigateToHome = () => {
  if (typeof window === 'undefined') {
    logger.warn('Auth', 'Navigation', '非浏览器环境，无法跳转')
    return
  }

  // Chrome Extension 环境：关闭当前页面，打开主页
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.getCurrent(tab => {
      if (tab?.id) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('management.html')
        })
        chrome.tabs.remove(tab.id)
      }
    })
  } else {
    window.location.href = '/management.html'
  }
}

/**
 * 处理 OAuth 回调（从 URL hash 中提取 token）
 */
const handleOAuthCallback = async () => {
  try {
    if (typeof window === 'undefined') {
      logger.warn('Auth', 'Callback', '非浏览器环境，跳过 OAuth 回调处理')
      return
    }

    const hash = window.location.hash
    
    if (!hash || !hash.includes('access_token')) {
      logger.debug('Auth', 'Callback', '没有 OAuth 回调参数')
      return
    }

    logger.info('Auth', 'Callback', '检测到 OAuth 回调，开始处理...')
    isProcessingCallback.value = true
    authError.value = ''

    // 解析 URL hash 参数
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const provider = params.get('provider')

    logger.debug('Auth', 'Callback', 'OAuth 回调参数', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      provider
    })

    if (!accessToken || !refreshToken) {
      throw new Error('OAuth 回调缺少必要的 token')
    }

    // 使用 Supabase 设置 session
    logger.info('Auth', 'Session', '设置 Supabase session...')
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    if (error) {
      logger.error('Auth', 'Session', '设置 session 失败', error)
      throw error
    }

    logger.info('Auth', 'Session', 'Session 设置成功', {
      userId: data.user?.id,
      email: data.user?.email,
      provider
    })

    // 保存 provider 到本地存储（用于显示 provider badge）
    if (provider) {
      try {
        await modernStorage.setLocal('current_login_provider', provider)
        logger.info('Auth', 'Storage', '已保存 provider 到本地存储', { provider })
      } catch (storageError) {
        logger.error('Auth', 'Storage', '保存 provider 失败', storageError)
      }
    }

    // 清除 URL hash
    window.location.hash = ''

    // 触发登录成功事件
    emitEvent('auth:logged-in', {})

    // 短暂延迟后跳转（确保状态同步）
    setTimeout(() => {
      logger.info('Auth', 'Navigation', '跳转到主页...')
      navigateToHome()
    }, 1000)

  } catch (error) {
    logger.error('Auth', 'Callback', 'OAuth 回调处理失败', error)
    authError.value = error instanceof Error ? error.message : 'OAuth 登录失败'
    isProcessingCallback.value = false
  }
}

/**
 * 页面加载时检查是否有 OAuth 回调
 */
onMounted(() => {
  handleOAuthCallback()
})

/**
 * 处理 Google 登录
 */
const handleGoogleLogin = async () => {
  try {
    isGoogleLoading.value = true
    authError.value = ''

    logger.info('Auth', 'Google', '开始 Google OAuth 登录...')
    await signInWithOAuth('google')
    logger.info('Auth', 'Google', 'Google OAuth 登录成功')

    emitEvent('auth:logged-in', {})
    navigateToHome()
  } catch (error) {
    logger.error('Auth', 'Google', 'Google 登录失败', error)
    
    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value =
        error instanceof Error ? error.message : 'Google 登录失败，请重试'
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

    logger.info('Auth', 'Microsoft', '开始 Microsoft OAuth 登录...')
    await signInWithOAuth('microsoft')
    logger.info('Auth', 'Microsoft', 'Microsoft OAuth 登录成功')

    emitEvent('auth:logged-in', {})
    navigateToHome()
  } catch (error) {
    logger.error('Auth', 'Microsoft', 'Microsoft 登录失败', error)
    
    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value =
        error instanceof Error
          ? error.message
          : 'Microsoft 登录失败，请重试'
    }
  } finally {
    isMicrosoftLoading.value = false
  }
}
</script>

<style scoped lang="scss">


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

  // 背景装饰动画
  &::before {
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

  &::after {
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
}

/* Logo 和标题区域 */
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

/* 登录表单 */
.auth-form {
  @media (width <= 480px) {
    max-width: 100%;
    padding: var(--spacing-6);
  }

  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: var(--spacing-8);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
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

/* 错误提示 */
.auth-alert {
  margin-bottom: var(--spacing-4);
}

/* OAuth 按钮 */
.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.oauth-btn {
  position: relative;
  justify-content: center;
  width: 100%;

  &--google {
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-primary);

    &:hover:not(:disabled) {
      color: var(--md-sys-color-on-primary);
      background-color: var(--md-sys-color-primary);
      box-shadow: 0 4px 12px rgb(66 133 244 / 30%);
    }
  }

  &--microsoft {
    border-color: var(--md-sys-color-secondary);
    color: var(--md-sys-color-secondary);

    &:hover:not(:disabled) {
      color: var(--md-sys-color-on-secondary);
      background-color: var(--md-sys-color-secondary);
      box-shadow: 0 4px 12px rgb(0 164 239 / 30%);
    }
  }
}

.oauth-icon {
  width: 20px;
  height: 20px;
}

/* 隐私提示 */
.auth-privacy-notice {
  margin-top: var(--spacing-4);
  font-size: var(--text-xs);
  line-height: 1.6;
  text-align: center;
  color: var(--color-text-secondary);

  a {
    text-decoration: none;
    color: var(--md-sys-color-primary);
    transition: color 0.2s ease;

    &:hover {
      text-decoration: underline;
      color: color-mix(in srgb, var(--md-sys-color-primary) 80%, var(--color-text-primary) 20%);
    }
  }
}
</style>
