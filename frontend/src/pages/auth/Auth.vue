<template>
  <div class="auth-page">
    <!-- 重置密码模式 -->
    <div v-if="isResetMode" class="auth-container auth-container--reset">
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <h1 class="auth-title">重置密码</h1>
          <Alert
            v-if="authError"
            :message="authError"
            :color="isSuccessMessage ? 'success' : 'error'"
            variant="filled"
            size="md"
            style="margin-bottom: var(--spacing-md)"
          />
          <Input
            v-model="resetPassword"
            label="新密码"
            type="password"
            placeholder="至少10位，包含大小写/数字/符号"
            autocomplete="new-password"
            size="lg"
            :error="!!authError"
            data-testid="reset-password"
          />
          <Button
            color="primary"
            size="lg"
            :disabled="resetLoading"
            :loading="resetLoading"
            data-testid="btn-reset-password"
            class="auth-submit-btn"
            @click="doResetPassword()"
            >重置密码</Button
          >
        </div>
      </div>
    </div>

    <!-- 主登录/注册页面 -->
    <div v-else class="auth-container">
      <!-- 左侧装饰区域 -->
      <div class="auth-decorative">
        <div class="decorative-shapes">
          <div class="shape shape--circle"></div>
        </div>
        <div class="decorative-content">
          <div class="decorative-icon">
            <svg
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="currentColor"
                opacity="0.2"
              />
              <path
                d="M100 30 L120 70 L165 75 L130 108 L140 155 L100 132 L60 155 L70 108 L35 75 L80 70 Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 class="decorative-title">AcuityBookmarks</h2>
          <p class="decorative-subtitle">
            {{ isLoginMode ? '欢迎回来' : '开始你的智能书签之旅' }}
          </p>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <!-- 错误提示（仅用于表单验证错误，成功提示使用 Toast） -->
          <Alert
            v-if="authError && !isSuccessMessage"
            :message="authError"
            color="error"
            variant="filled"
            size="md"
            style="
              margin-bottom: var(--spacing-md);
              z-index: 10;
              position: relative;
            "
          />

          <!-- 标题 -->
          <h1 class="auth-title">
            {{ isLoginMode ? 'Welcome Back' : 'Create your Free Account' }}
          </h1>

          <!-- 统一表单布局 -->
          <form
            :class="['form-fields', `form-fields--${formConfig.mode}`]"
            @submit.prevent="formConfig.onSubmit"
          >
            <div class="form-field-row">
              <label class="field-label">Email</label>
              <Input
                v-if="isLoginMode"
                v-model.trim="loginEmail"
                type="email"
                name="email"
                placeholder="Enter your Email here"
                autocomplete="email"
                size="lg"
                :error="formConfig.emailError"
                data-testid="login-email"
              />
              <Input
                v-else
                v-model.trim="regEmail"
                type="email"
                name="email"
                placeholder="Enter your Email here"
                autocomplete="email"
                size="lg"
                :error="formConfig.emailError"
                data-testid="reg-email"
              />
            </div>
            <div class="form-field-row">
              <label class="field-label">Password</label>
              <Input
                v-if="isLoginMode"
                v-model="loginPassword"
                type="password"
                name="password"
                :placeholder="formConfig.passwordPlaceholder"
                :autocomplete="formConfig.passwordAutocomplete"
                size="lg"
                :error="formConfig.passwordError"
                :error-message="formConfig.passwordErrorMessage"
                data-testid="login-password"
              />
              <Input
                v-else
                v-model="regPassword"
                type="password"
                name="password"
                :placeholder="formConfig.passwordPlaceholder"
                :autocomplete="formConfig.passwordAutocomplete"
                size="lg"
                :error="formConfig.passwordError"
                :error-message="formConfig.passwordErrorMessage"
                data-testid="reg-password"
              />
            </div>
          </form>

          <Button
            size="lg"
            :disabled="formConfig.loading.value"
            :loading="formConfig.loading.value"
            :class="['auth-submit-btn', `auth-submit-btn--${formConfig.mode}`]"
            :data-testid="`btn-${formConfig.mode}`"
            @click="formConfig.onSubmit"
          >
            {{ formConfig.submitButtonText }}
          </Button>

          <div class="auth-footer-links">
            <span>{{ formConfig.footerText }}</span>
            <Button
              variant="text"
              size="sm"
              class="auth-link auth-link--primary"
              @click="formConfig.toggleMode"
            >
              {{ formConfig.toggleButtonText }}
            </Button>
          </div>

          <!-- 忘记密码链接（仅登录模式） -->
          <div v-if="isLoginMode" class="auth-footer-links">
            <Button
              variant="text"
              size="sm"
              class="auth-link auth-link--forgot"
              :disabled="loginLoading"
              @click="forgot()"
            >
              忘记密码？
            </Button>
          </div>

          <!-- 占位空间（注册模式，保持与登录模式的"忘记密码"高度一致） -->
          <div v-else class="auth-footer-links auth-footer-links--placeholder">
            <span></span>
          </div>

          <!-- 分隔线（仅登录模式） -->
          <div v-if="isLoginMode" class="auth-divider">
            <span class="divider-text">- OR -</span>
          </div>

          <!-- 注册模式的占位分隔线（保持高度一致） -->
          <div v-else class="auth-divider auth-divider--placeholder">
            <span class="divider-text"></span>
          </div>

          <!-- 社交登录按钮（仅登录模式） -->
          <div v-if="isLoginMode" class="social-login">
            <Button
              variant="outline"
              size="lg"
              class="social-btn"
              data-testid="btn-oauth-google"
              @click="oauth('google')"
            >
              <template #prepend>
                <span class="social-icon social-icon--google">G</span>
              </template>
              Sign in with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="social-btn"
              data-testid="btn-oauth-github"
              @click="oauth('github')"
            >
              <template #prepend>
                <span class="social-icon social-icon--github">G</span>
              </template>
              Sign in with GitHub
            </Button>
            <Button
              v-if="allowDevLogin"
              variant="text"
              size="lg"
              class="social-btn social-btn--dev"
              data-testid="btn-oauth-dev"
              @click="oauth('dev')"
            >
              开发者登录
            </Button>
          </div>

          <!-- 注册模式的占位社交登录区域（保持高度一致） -->
          <div v-else class="social-login social-login--placeholder">
            <div class="social-btn-placeholder"></div>
            <div class="social-btn-placeholder"></div>
          </div>

          <!-- 服务条款 -->
          <div class="auth-fineprint">
            登录/注册即表示你同意我们的服务条款与隐私政策。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineOptions, ref, shallowRef } from 'vue'
import { Alert, Button, Input } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notificationService } from '@/application/notification/notification-service'
import { API_CONFIG } from '@/config/constants'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
import { proxyApiRequest } from '@/infrastructure/http/proxy-api'
import { emitEvent } from '@/infrastructure/events/event-bus'
import type {
  AuthStartResponse,
  AuthCallbackResponse,
  LoginResponse,
  BasicOk
} from '@/types/api'

/// <reference types="chrome"/>

defineOptions({
  name: 'AuthPage'
})

const AUTH_TOKEN_KEY = 'auth.jwt'
const AUTH_REFRESH_KEY = 'auth.refresh'
const authError = shallowRef<string>('')

// 判断是否是成功消息
const isSuccessMessage = computed(() => {
  return authError.value.includes('✅') || authError.value.includes('成功')
})
const DEFAULT_TIMEOUT_MS = 20000
const loginEmail = ref('')
const loginPassword = ref('')
const regEmail = ref('')
const regPassword = ref('')
const loginLoading = ref(false)
const regLoading = ref(false)
const isLoginMode = ref(true) // 默认显示登录模式
const allowDevLogin = ref(false)

// 统一表单配置（根据登录/注册模式切换）
const formConfig = computed(() => {
  if (isLoginMode.value) {
    return {
      mode: 'login' as const,
      loading: loginLoading,
      passwordPlaceholder: 'Enter your Password here',
      passwordAutocomplete: 'current-password' as const,
      passwordError: !!authError.value,
      passwordErrorMessage: undefined as string | undefined,
      emailError: !!(authError.value && !isEmailValid(loginEmail.value)),
      submitButtonText: '登录',
      footerText: 'Already have an account?',
      toggleButtonText: '注册',
      toggleMode: () => {
        isLoginMode.value = false
      },
      onSubmit: login
    }
  } else {
    return {
      mode: 'register' as const,
      loading: regLoading,
      passwordPlaceholder: '至少10位，包含大小写字母、数字和符号',
      passwordAutocomplete: 'new-password' as const,
      passwordError: !!(
        regPassword.value && !isPasswordValid(regPassword.value)
      ),
      passwordErrorMessage:
        regPassword.value && !isPasswordValid(regPassword.value)
          ? passwordErrorMessage
          : (undefined as string | undefined),
      emailError: !!(authError.value && !isEmailValid(regEmail.value)),
      submitButtonText: 'Create Account',
      footerText: 'Already have a account?',
      toggleButtonText: 'log in',
      toggleMode: () => {
        isLoginMode.value = true
      },
      onSubmit: register
    }
  }
})

// 密码验证正则：至少10位，包含大小写字母、数字和符号
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/

// 密码验证
const isPasswordValid = (password: string): boolean => {
  return PASSWORD_REGEX.test(password)
}

// 密码错误提示信息
const passwordErrorMessage = '密码必须至少10位，包含大小写字母、数字和符号'

// 邮箱格式验证
const isEmailValid = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function oauth(provider: 'google' | 'github' | 'dev') {
  try {
    const apiBase = API_CONFIG.API_BASE
    const redirectUri = chrome.identity.getRedirectURL('oauth2')
    const codeVerifier = await pkceCreateVerifier()
    const codeChallenge = await pkceChallengeS256(codeVerifier)
    const start = new URL('/api/auth/start', apiBase)
    start.searchParams.append('provider', provider)
    start.searchParams.append('redirect_uri', redirectUri)
    start.searchParams.append('code_challenge', codeChallenge)
    start.searchParams.append('scope', '')
    start.searchParams.append('t', String(Date.now()))

    const startData = await safeJsonFetch<AuthStartResponse>(
      start.toString(),
      DEFAULT_TIMEOUT_MS
    )
    if (!(startData && startData.success && startData.authUrl))
      throw new Error('Auth start failed')
    const authUrl = String(startData.authUrl)
    const resultUrl = await new Promise<string>((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          (redirectedTo: string | undefined) => {
            if (chrome.runtime.lastError)
              return reject(new Error(chrome.runtime.lastError.message))
            if (!redirectedTo) return reject(new Error('empty redirect'))
            resolve(redirectedTo)
          }
        )
      } catch (e) {
        reject(e as Error)
      }
    })
    const u = new URL(resultUrl)
    const code = u.searchParams.get('code')
    if (!code) throw new Error('No code returned from provider')
    const cb = new URL('/api/auth/callback', apiBase)
    cb.searchParams.append('provider', provider)
    cb.searchParams.append('code', code)
    cb.searchParams.append('redirect_uri', redirectUri)
    cb.searchParams.append('code_verifier', codeVerifier)
    const cbData = await safeJsonFetch<AuthCallbackResponse>(
      cb.toString(),
      DEFAULT_TIMEOUT_MS
    )
    const tokenValue = cbData?.token || cbData?.accessToken
    if (cbData && cbData.success && tokenValue) {
      authError.value = ''
      await settingsAppService.saveSetting(
        AUTH_TOKEN_KEY,
        tokenValue,
        'string',
        'JWT auth token'
      )
      // 发送登录成功事件，通知其他组件更新状态
      emitEvent('auth:logged-in', {})
      const params = new window.URLSearchParams(window.location.search)
      const ret = params.get('return') || 'settings.html?tab=account'
      const url = ret.startsWith('http') ? ret : chrome.runtime.getURL(ret)
      try {
        await chrome.tabs.create({ url })
      } catch {}
      try {
        window.close()
      } catch {}
    }
  } catch (e: unknown) {
    console.error('[Auth] oauth failed:', e)
    authError.value = (e as Error)?.message
      ? `登录失败：${(e as Error).message}`
      : '登录失败，请稍后重试'
    try {
      chrome?.notifications?.create?.({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'AcuityBookmarks',
        message: authError.value
      })
    } catch {}
  }
}

async function login() {
  authError.value = ''
  if (!loginEmail.value || !loginPassword.value) {
    authError.value = '请输入邮箱和密码'
    return
  }
  if (!isEmailValid(loginEmail.value)) {
    authError.value = '请输入有效的邮箱地址'
    return
  }
  loginLoading.value = true
  try {
    const apiBase = API_CONFIG.API_BASE
    // 使用 Background Script 代理请求，绕过 CSP 限制
    const data = await proxyApiRequest<LoginResponse>(
      `${apiBase}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.value,
          password: loginPassword.value
        })
      }
    )

    // proxyApiRequest 已经处理了错误响应并转换为错误文案
    // 如果返回 null 说明请求失败（非 HTTP 错误）
    if (!data) {
      throw new Error('登录失败，请稍后重试')
    }

    // 如果后端返回了 success: false（虽然通常不会到达这里，因为 HTTP 错误已经抛出）11
    if (!data.success) {
      throw new Error('登录失败，请稍后重试')
    }

    // 🔧 兼容后端返回的驼峰格式（accessToken）和下划线格式（access_token）
    const accessToken = data.accessToken || data.access_token
    const refreshToken = data.refreshToken || data.refresh_token

    if (accessToken && typeof accessToken === 'string') {
      // 直接使用 settingsAppService 保存 token，确保与 AccountSettings 读取方式一致
      await settingsAppService.saveSetting(
        AUTH_TOKEN_KEY,
        accessToken,
        'string',
        'JWT auth token'
      )
      if (refreshToken && typeof refreshToken === 'string') {
        await settingsAppService.saveSetting(
          AUTH_REFRESH_KEY,
          refreshToken,
          'string',
          'Refresh token'
        )
      }
      // 发送登录成功事件，通知其他组件更新状态
      emitEvent('auth:logged-in', {})
    }
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || '登录失败，请稍后重试'
    authError.value = errorMsg
    await notificationService.notifyError(errorMsg, '登录失败')
  } finally {
    loginLoading.value = false
  }
}

async function register() {
  authError.value = ''
  // 临时注释掉验证，方便测试
  // if (!regEmail.value || !regPassword.value) {
  //   authError.value = '请输入邮箱和密码'
  //   return
  // }
  // if (!isEmailValid(regEmail.value)) {
  //   authError.value = '请输入有效的邮箱地址'
  //   return
  // }
  // if (!isPasswordValid(regPassword.value)) {
  //   authError.value = passwordErrorMessage
  //   return
  // }
  regLoading.value = true
  try {
    const apiBase = API_CONFIG.API_BASE
    // 使用 Background Script 代理请求，绕过 CSP 限制
    const data = await proxyApiRequest<BasicOk>(
      `${apiBase}/api/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.value,
          password: regPassword.value
        })
      }
    )

    // proxyApiRequest 已经处理了错误响应并转换为错误文案
    // 如果返回 null 说明请求失败（非 HTTP 错误）
    if (!data) {
      throw new Error('注册失败，请稍后重试')
    }

    // 如果后端返回了 success: false（虽然通常不会到达这里，因为 HTTP 错误已经抛出）
    if (!data.success) {
      throw new Error('注册失败，请稍后重试')
    }
    const loginData = await proxyApiRequest<LoginResponse>(
      `${apiBase}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.value,
          password: regPassword.value
        })
      }
    )

    if (!loginData || !loginData.success) {
      console.error('[Auth] ❌ 注册后自动登录失败:', {
        hasData: !!loginData,
        success: loginData?.success
      })
      throw new Error('注册成功，但自动登录失败，请手动登录')
    }

    // 🔧 兼容后端返回的驼峰格式（accessToken）和下划线格式（access_token）
    const accessToken = loginData.accessToken || loginData.access_token
    const refreshToken = loginData.refreshToken || loginData.refresh_token

    if (!accessToken) {
      console.error('[Auth] ❌ 注册后自动登录失败: 没有 accessToken', {
        loginDataKeys: Object.keys(loginData),
        accessTokenType: typeof accessToken,
        accessTokenValue: accessToken
      })
      throw new Error('注册成功，但自动登录失败，请手动登录')
    }

    // 🔧 确保 accessToken 是字符串
    if (typeof accessToken !== 'string') {
      console.error('[Auth] ❌ accessToken 不是字符串:', {
        type: typeof accessToken,
        value: accessToken
      })
      throw new Error('Token 格式错误，请重试')
    }

    try {
      // 直接使用 settingsAppService 保存 token，确保与 AccountSettings 读取方式一致
      await settingsAppService.saveSetting(
        AUTH_TOKEN_KEY,
        accessToken,
        'string',
        'JWT auth token'
      )

      if (refreshToken && typeof refreshToken === 'string') {
        await settingsAppService.saveSetting(
          AUTH_REFRESH_KEY,
          refreshToken,
          'string',
          'Refresh token'
        )
      }

      // 发送登录成功事件，通知其他组件更新状态
      emitEvent('auth:logged-in', {})

      // 使用 notificationService 显示成功提示（Toast 组件）
      await notificationService.notifySuccess('注册成功！', '注册成功')

      // 延迟一小段时间，让用户看到成功提示
      await new Promise(resolve => setTimeout(resolve, 800))

      // 跳转到设置页面
      await onAuthSuccessNavigate()
    } catch (saveError) {
      console.error('[Auth] ❌ Token 保存过程出错:', saveError)
      throw saveError
    }
  } catch (e: unknown) {
    const error = e as Error
    // 检查是否是证书错误
    if (
      error.message.includes('证书错误') ||
      error.message.includes('certificate')
    ) {
      const errorMsg =
        '证书错误：请先手动访问 https://localhost:8787/api/health 并接受证书，或使用 mkcert 生成受信任的本地证书'
      authError.value = errorMsg
      await notificationService.notifyError(errorMsg, '注册失败')
    } else {
      const errorMsg = error?.message || '注册失败，请稍后重试'
      authError.value = errorMsg
      await notificationService.notifyError(errorMsg, '注册失败')
    }
  } finally {
    regLoading.value = false
  }
}

async function forgot() {
  authError.value = ''
  if (!loginEmail.value) {
    authError.value = '请输入邮箱以找回密码'
    return
  }
  try {
    const apiBase = API_CONFIG.API_BASE
    // 使用 Background Script 代理请求，绕过 CSP 限制
    await proxyApiRequest<BasicOk>(`${apiBase}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value })
    }).catch(() => ({}))
    authError.value =
      '如果邮箱存在，我们已发送重置邮件（本地开发为生成一次性令牌）'
  } catch (e: unknown) {
    authError.value = (e as Error)?.message || '请求失败，请稍后重试'
  }
}

// 重置密码模式
const resetToken = ref<string>('')
const resetPassword = ref<string>('')
const resetLoading = ref(false)
const isResetMode = (() => {
  try {
    const u = new URL(window.location.href)
    const tok = u.searchParams.get('reset_token')
    if (tok) {
      resetToken.value = tok
      return true
    }
  } catch {}
  return false
})()

async function doResetPassword() {
  authError.value = ''
  if (!resetToken.value || !resetPassword.value) {
    authError.value = '重置令牌或新密码缺失'
    return
  }
  resetLoading.value = true
  try {
    const apiBase = API_CONFIG.API_BASE
    const data = await safeJsonFetch<BasicOk>(
      `${apiBase}/api/auth/reset-password`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken.value,
          newPassword: resetPassword.value
        })
      }
    )
    if (!data || !data.success) throw new Error(data?.error || '重置失败')
    authError.value = '密码已重置，请使用新密码登录'
  } catch (e: unknown) {
    authError.value = (e as Error)?.message || '重置失败，请稍后重试'
  } finally {
    resetLoading.value = false
  }
}

async function onAuthSuccessNavigate() {
  authError.value = ''
  try {
    const params = new window.URLSearchParams(window.location.search)
    const ret = params.get('return') || 'settings.html?tab=account'
    const url = ret.startsWith('http') ? ret : chrome.runtime.getURL(ret)

    // ✅ 优先使用 window.location.href 进行同页跳转
    // 这样可以在同一个页面上下文中，确保 IndexedDB 数据已同步
    // 如果是在扩展页面中（可以访问 window.location），直接跳转
    try {
      window.location.href = url
      return
    } catch (e) {
      console.warn(
        '[Auth] window.location.href 跳转失败，尝试 chrome.tabs.create:',
        e
      )
    }

    // 降级方案：使用 chrome.tabs.create（适用于弹窗等场景）
    try {
      await chrome.tabs.create({ url })
      // 尝试关闭当前窗口（如果是弹窗）
      try {
        window.close()
      } catch {}
    } catch (e) {
      console.error('[Auth] chrome.tabs.create 跳转失败:', e)
    }
  } catch (e) {
    console.error('[Auth] onAuthSuccessNavigate 失败:', e)
  }
}

// PKCE helpers
async function pkceCreateVerifier(): Promise<string> {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return base64url(bytes)
}
async function pkceChallengeS256(verifier: string): Promise<string> {
  const data = new globalThis.TextEncoder().encode(verifier)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return base64url(new Uint8Array(digest))
}
function base64url(bytes: Uint8Array): string {
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: var(--color-background);
  padding: 0;
  margin: 0;
}

.auth-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  background: var(--color-surface);
  overflow: hidden;
}

.auth-container--reset {
  grid-template-columns: 1fr;
  max-width: 500px;
  min-height: auto;
  border-radius: var(--radius-lg);
  margin: var(--spacing-6) auto;
}

/* 左侧装饰区域 */
.auth-decorative {
  position: relative;
  background: linear-gradient(135deg, #ffd54f 0%, #ffeb3b 50%, #ffc107 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-8);
  overflow: hidden;
  min-height: 100vh;
}

.decorative-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
}

.shape--circle {
  width: 500px;
  height: 500px;
  border-radius: 50% 40% 60% 50%;
  background: rgba(255, 255, 255, 0.15);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.decorative-content {
  position: relative;
  z-index: 1;
  text-align: center;
  color: rgba(0, 0, 0, 0.8);
  max-width: 400px;
}

.decorative-icon {
  width: 200px;
  height: 200px;
  margin: 0 auto var(--spacing-6);
  color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.decorative-icon svg {
  width: 100%;
  height: 100%;
}

.decorative-title {
  font-size: 2.5rem;
  font-weight: var(--font-bold);
  margin-bottom: var(--spacing-md);
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.2;
}

.decorative-subtitle {
  font-size: var(--text-lg);
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
}

/* 右侧表单区域 */
.auth-form-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-8);
  background: var(--color-surface);
  min-height: 100vh;
}

.auth-container--reset .auth-form-wrapper {
  padding: var(--spacing-6);
  min-height: auto;
}

.auth-form {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  /* 平滑过渡高度变化，避免抖动 */
  transition: height 0.3s ease;
  min-height: fit-content;
}

.auth-title {
  font-size: 2rem;
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-6) 0;
  text-align: center;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
}

/* 登录和注册表单 - 统一布局 */
.form-fields--login,
.form-fields--register {
  gap: var(--spacing-lg);
}

.form-field-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%; /* 确保占据整个宽度 */
}

/* 确保 Input 组件在 form-field-row 中占据全部可用空间 */
.form-field-row :deep(.acuity-input-wrapper) {
  width: 100%;
}

.form-field-row :deep(.acuity-input-container) {
  width: 100%;
}

.form-field-row :deep(.acuity-input) {
  width: 100%;
}

.field-label {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  text-align: left;
}

.auth-submit-btn {
  width: 100%;
  margin-top: var(--spacing-md);
  height: 48px;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

/* 登录按钮 - 深绿色/青绿色 */
.auth-submit-btn--login {
  background-color: #16a085 !important;
  border-color: #16a085 !important;
  color: white !important;
  font-weight: var(--font-semibold);
}

.auth-submit-btn--login:hover:not(:disabled) {
  background-color: #138d75 !important;
  border-color: #138d75 !important;
}

.auth-submit-btn--login:disabled {
  opacity: 0.6;
}

/* 注册按钮 - 黄色 */
.auth-submit-btn--register {
  background-color: #ffd700 !important;
  border-color: #ffd700 !important;
  color: #000 !important;
  font-weight: var(--font-bold);
}

.auth-submit-btn--register:hover:not(:disabled) {
  background-color: #ffed4e !important;
  border-color: #ffed4e !important;
}

.auth-submit-btn--register:disabled {
  opacity: 0.6;
}

.auth-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  margin: var(--spacing-md) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 20px;
  height: 20px;
}

/* 占位链接（保持高度一致） */
.auth-footer-links--placeholder {
  visibility: hidden; /* 隐藏但占据空间 */
  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 20px;
  height: 20px;
}

/* Button variant="text" 的自定义样式 */
.auth-link {
  min-width: auto;
  padding: 0;
  font-size: var(--text-sm);
}

/* 主要链接 - 亮色（黄色） */
.auth-link--primary {
  color: #ffd700 !important;
  font-weight: var(--font-semibold);
}

.auth-link--primary:hover {
  color: #ffed4e !important;
  text-decoration: underline;
  background: transparent !important;
}

/* 次要链接 - 灰色 */
.auth-link--forgot {
  color: var(--color-text-secondary) !important;
  font-weight: var(--font-normal);
}

.auth-link--forgot:hover {
  color: var(--color-text-primary) !important;
  text-decoration: underline;
  background: transparent !important;
}

.auth-divider {
  display: flex;
  align-items: center;
  margin: var(--spacing-lg) 0;
  text-align: center;
  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 20px;
  height: 20px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.divider-text {
  padding: 0 var(--spacing-lg);
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: 0.05em;
}

/* 占位分隔线（保持高度一致） */
.auth-divider--placeholder {
  visibility: hidden; /* 隐藏但占据空间 */
  pointer-events: none;
  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 20px;
  height: 20px;
}

.auth-divider--placeholder::before,
.auth-divider--placeholder::after {
  background: transparent; /* 隐藏线条 */
}

.social-login {
  display: flex;
  flex-direction: row;
  gap: var(--spacing-md);
  width: 100%;
  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 48px;
  height: 48px;
  align-items: center;
}

/* 占位社交登录区域（保持高度一致） */
.social-login--placeholder {
  visibility: hidden; /* 隐藏但占据空间 */
  pointer-events: none;
  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 48px;
  height: 48px;
}

.social-btn-placeholder {
  flex: 1;
  height: 48px; /* 与 .auth-submit-btn 高度一致 */
}

.social-btn {
  flex: 1;
  min-width: 0; /* 允许按钮缩小 */
}

/* 开发者登录按钮单独占一行（如果显示） */
.social-btn--dev {
  flex: 1 1 100%; /* 占满整行 */
  margin-top: var(--spacing-sm);
}

.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-weight: var(--font-bold);
  font-size: 12px;
  flex-shrink: 0;
}

.social-icon--google {
  background: transparent;
  color: #4285f4;
  border: 2px solid #4285f4;
}

.social-icon--github {
  background: transparent;
  color: #24292e;
  border: 2px solid #24292e;
}

.auth-fineprint {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin: var(--spacing-md) 0 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .auth-page {
    padding: 0;
  }

  .auth-container {
    grid-template-columns: 1fr;
    min-height: 100vh;
    box-shadow: none;
  }

  .auth-decorative {
    min-height: 180px;
    padding: var(--spacing-4);
  }

  .decorative-title {
    font-size: 1.75rem;
  }

  .decorative-subtitle {
    font-size: var(--text-base);
  }

  .shape--circle {
    display: none;
  }

  .auth-form-wrapper {
    padding: var(--spacing-4);
    min-height: auto;
  }

  .auth-form {
    max-width: 100%;
  }

  .auth-title {
    font-size: 1.5rem;
  }

  /* 移动端登录表单改为垂直布局 */
  .form-field-row {
    grid-template-columns: 1fr;
    gap: var(--spacing-xs);
  }

  .field-label {
    text-align: left;
  }
}

@media (max-width: 480px) {
  .auth-decorative {
    min-height: 150px;
    padding: var(--spacing-3);
  }

  .decorative-title {
    font-size: 1.5rem;
  }

  .auth-form-wrapper {
    padding: var(--spacing-3);
  }

  .auth-title {
    font-size: 1.25rem;
  }

  .form-fields {
    gap: var(--spacing-sm);
  }
}
</style>
