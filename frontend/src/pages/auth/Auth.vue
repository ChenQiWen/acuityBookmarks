<template>
  <div class="auth-page">
    <!-- 重置密码模式 -->
    <div v-if="isResetMode" class="auth-container auth-container--reset">
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <h1 class="auth-title">重置密码</h1>
          <div v-if="authError" class="error-banner">{{ authError }}</div>
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
          <!-- 错误提示 -->
          <div v-if="authError" class="error-banner">{{ authError }}</div>

          <!-- 标题 -->
          <h1 class="auth-title">
            {{ isLoginMode ? 'Welcome Back' : 'Create your Free Account' }}
          </h1>

          <!-- 登录表单 -->
          <template v-if="isLoginMode">
            <div class="form-fields form-fields--login">
              <div class="form-field-row">
                <label class="field-label">Email</label>
                <Input
                  v-model.trim="loginEmail"
                  type="email"
                  placeholder="Enter your Email here"
                  autocomplete="email"
                  size="lg"
                  :error="authError && !isEmailValid(loginEmail) ? true : false"
                  data-testid="login-email"
                />
              </div>
              <div class="form-field-row">
                <label class="field-label">Password</label>
                <Input
                  v-model="loginPassword"
                  type="password"
                  placeholder="Enter your Password here"
                  autocomplete="current-password"
                  size="lg"
                  :error="!!authError"
                  data-testid="login-password"
                />
              </div>
            </div>

            <Button
              size="lg"
              :disabled="loginLoading"
              :loading="loginLoading"
              class="auth-submit-btn auth-submit-btn--login"
              data-testid="btn-login"
              @click="login()"
              >登录</Button
            >

            <div class="auth-footer-links">
              <span>Already have an account?</span>
              <button
                type="button"
                class="auth-link auth-link--primary"
                @click="isLoginMode = false"
              >
                注册
              </button>
            </div>
            <div class="auth-footer-links">
              <button
                type="button"
                class="auth-link auth-link--forgot"
                :disabled="loginLoading"
                @click="forgot()"
              >
                忘记密码？
              </button>
            </div>
          </template>

          <!-- 注册表单 -->
          <template v-else>
            <div class="form-fields">
              <Input
                v-model.trim="regEmail"
                label="Email"
                type="email"
                placeholder="Enter your Email here"
                autocomplete="email"
                size="lg"
                :error="authError && !isEmailValid(regEmail) ? true : false"
                data-testid="reg-email"
              />
              <Input
                v-model="regPassword"
                label="Password"
                type="password"
                placeholder="Enter your Password here"
                autocomplete="new-password"
                size="lg"
                :error="
                  authError && regPassword && !passwordStrength.isValid
                    ? true
                    : false
                "
                :error-message="
                  regPassword && !passwordStrength.isValid
                    ? '密码强度不符合要求'
                    : ''
                "
                data-testid="reg-password"
              />
              <!-- 密码强度提示 -->
              <div v-if="regPassword" class="password-strength">
                <div class="strength-label">
                  密码强度：<span
                    :class="`strength-${passwordStrength.label}`"
                    >{{ passwordStrength.label }}</span
                  >
                </div>
                <div class="strength-details">
                  <div
                    v-for="(detail, index) in passwordStrength.details"
                    :key="index"
                    class="strength-item"
                    :class="{
                      'strength-ok':
                        detail.includes('包含') || detail.includes('长度≥')
                    }"
                  >
                    {{ detail }}
                  </div>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              :disabled="
                regLoading ||
                !passwordStrength.isValid ||
                !isEmailValid(regEmail)
              "
              :loading="regLoading"
              class="auth-submit-btn auth-submit-btn--register"
              data-testid="btn-register"
              @click="register()"
              >Create Account</Button
            >

            <div class="auth-footer-links">
              <span>Already have a account?</span>
              <button
                type="button"
                class="auth-link auth-link--primary"
                @click="isLoginMode = true"
              >
                log in
              </button>
            </div>
          </template>

          <!-- 分隔线 -->
          <div class="auth-divider">
            <span class="divider-text">- OR -</span>
          </div>

          <!-- 社交登录按钮 -->
          <div class="social-login">
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
              Sign up with Google
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
              Sign up with GitHub
            </Button>
            <Button
              v-if="allowDevLogin"
              variant="text"
              size="lg"
              class="social-btn"
              data-testid="btn-oauth-dev"
              @click="oauth('dev')"
            >
              开发者登录
            </Button>
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
import { Button, Input } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { API_CONFIG } from '@/config/constants'
import { saveAuthTokens } from '@/application/auth/auth-service'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
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
const authError = shallowRef<string>('')
const DEFAULT_TIMEOUT_MS = 20000
const loginEmail = ref('')
const loginPassword = ref('')
const regEmail = ref('')
const regPassword = ref('')
const loginLoading = ref(false)
const regLoading = ref(false)
const isLoginMode = ref(true) // 默认显示登录模式
const allowDevLogin = ref(false)

// 密码强度验证
const passwordStrength = computed(() => {
  const pwd = regPassword.value
  if (!pwd) return { score: 0, label: '', details: [] }

  const details: string[] = []
  let score = 0

  if (pwd.length >= 10) {
    score++
    details.push('长度≥10位')
  } else {
    details.push('长度需要≥10位')
  }

  if (/[a-z]/.test(pwd)) {
    score++
    details.push('包含小写字母')
  } else {
    details.push('缺少小写字母')
  }

  if (/[A-Z]/.test(pwd)) {
    score++
    details.push('包含大写字母')
  } else {
    details.push('缺少大写字母')
  }

  if (/\d/.test(pwd)) {
    score++
    details.push('包含数字')
  } else {
    details.push('缺少数字')
  }

  if (/[^A-Za-z0-9]/.test(pwd)) {
    score++
    details.push('包含符号')
  } else {
    details.push('缺少符号')
  }

  let label = ''
  if (score >= 5) label = '强'
  else if (score >= 4) label = '中'
  else if (score >= 3) label = '弱'
  else label = '不符合要求'

  return { score, label, details, isValid: score >= 4 }
})

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
    const data = await safeJsonFetch<LoginResponse>(
      `${apiBase}/api/auth/login`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.value,
          password: loginPassword.value
        })
      }
    )
    if (!data || !data.success) throw new Error(data?.error || '登录失败')
    if (data.access_token)
      await saveAuthTokens(
        String(data.access_token),
        data.refresh_token ? String(data.refresh_token) : null
      )
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    authError.value = (e as Error)?.message || '登录失败，请稍后重试'
  } finally {
    loginLoading.value = false
  }
}

async function register() {
  authError.value = ''
  if (!regEmail.value || !regPassword.value) {
    authError.value = '请输入邮箱和密码'
    return
  }
  if (!isEmailValid(regEmail.value)) {
    authError.value = '请输入有效的邮箱地址'
    return
  }
  if (!passwordStrength.value.isValid) {
    authError.value = '密码强度不符合要求，请至少满足4项条件'
    return
  }
  regLoading.value = true
  try {
    const apiBase = API_CONFIG.API_BASE
    const data = await safeJsonFetch<BasicOk>(
      `${apiBase}/api/auth/register`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.value,
          password: regPassword.value
        })
      }
    )
    if (!data || !data.success) throw new Error(data?.error || '注册失败')
    const loginData = await safeJsonFetch<LoginResponse>(
      `${apiBase}/api/auth/login`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.value,
          password: regPassword.value
        })
      }
    )
    if (loginData && loginData.success && loginData.access_token) {
      await saveAuthTokens(
        String(loginData.access_token),
        loginData.refresh_token ? String(loginData.refresh_token) : null
      )
    }
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    authError.value = (e as Error)?.message || '注册失败，请稍后重试'
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
    await safeJsonFetch<BasicOk>(
      `${apiBase}/api/auth/forgot-password`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.value })
      }
    ).catch(() => ({}))
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
          reset_token: resetToken.value,
          new_password: resetPassword.value
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
    try {
      await chrome.tabs.create({ url })
    } catch {}
    try {
      window.close()
    } catch {}
  } catch {}
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

/* 登录表单 - 横向布局 */
.form-fields--login {
  gap: var(--spacing-lg);
}

.form-field-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: var(--spacing-md);
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
}

.auth-link {
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
  padding: 0;
  text-decoration: none;
  transition: color 0.2s ease;
}

/* 主要链接 - 亮色（黄色） */
.auth-link--primary {
  color: #ffd700;
  font-weight: var(--font-semibold);
}

.auth-link--primary:hover {
  color: #ffed4e;
  text-decoration: underline;
}

/* 次要链接 - 灰色 */
.auth-link--forgot {
  color: var(--color-text-secondary);
  font-weight: var(--font-normal);
}

.auth-link--forgot:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.auth-divider {
  display: flex;
  align-items: center;
  margin: var(--spacing-lg) 0;
  text-align: center;
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

.social-login {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.social-btn {
  width: 100%;
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

.error-banner {
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  margin: 0;
  font-size: var(--text-sm);
  width: 100%;
  text-align: center;
}

.password-strength {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-surface-variant);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
}

.strength-label {
  font-weight: var(--font-semibold);
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-primary);
}

.strength-label .strength-强 {
  color: var(--color-success);
}

.strength-label .strength-中 {
  color: var(--color-warning);
}

.strength-label .strength-弱,
.strength-label .strength-不符合要求 {
  color: var(--color-error);
}

.strength-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.strength-item {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.strength-item.strength-ok {
  background: var(--color-success-container);
  color: var(--color-on-success-container);
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
