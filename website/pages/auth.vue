<template>
  <div class="auth-page">
    <!-- 左右分栏布局 -->
    <div class="auth-container">
      <!-- 左侧装饰区域 -->
      <div class="auth-decorative">
        <div class="decorative-shapes">
          <div class="shape shape--circle"></div>
        </div>
        <div class="decorative-content">
          <!-- 品牌图标 -->
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
          <div
            v-if="error"
            class="auth-alert auth-alert--error"
          >
            <p class="auth-alert-text">{{ error }}</p>
          </div>

          <!-- 成功提示 -->
          <div
            v-if="success"
            class="auth-alert auth-alert--success"
          >
            <p class="auth-alert-text">{{ success }}</p>
          </div>

          <!-- 标题 -->
          <h1 class="auth-title">
            {{ isLoginMode ? 'Welcome Back' : 'Create your Free Account' }}
          </h1>

          <!-- 表单 -->
          <form class="form-fields" @submit.prevent="handleSubmit">
            <!-- 邮箱输入 -->
            <div class="form-field-row">
              <label for="email" class="field-label">Email</label>
              <input
                id="email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                placeholder="Enter your Email here"
                class="auth-input"
                :class="{ 'auth-input--error': emailError }"
              />
            </div>
            <p v-if="emailError" class="field-error">
              {{ emailError }}
            </p>

            <!-- 密码输入 -->
            <div class="form-field-row">
              <label for="password" class="field-label">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                required
                :autocomplete="isLoginMode ? 'current-password' : 'new-password'"
                :placeholder="
                  isLoginMode ? 'Enter your password' : '至少8位，包含字母和数字'
                "
                class="auth-input"
                :class="{ 'auth-input--error': passwordError }"
              />
            </div>
            <p v-if="passwordError" class="field-error">
              {{ passwordError }}
            </p>

          </form>

          <!-- 确认密码（仅注册模式，独立于表单） -->
          <div v-if="!isLoginMode" class="form-field-row">
            <label for="confirmPassword" class="field-label">Confirm</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="Confirm your password"
              class="auth-input"
              :class="{ 'auth-input--error': confirmPasswordError }"
            />
          </div>
          <p v-if="confirmPasswordError" class="field-error">
            {{ confirmPasswordError }}
          </p>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            :class="[
              'auth-submit-btn',
              isLoginMode ? 'auth-submit-btn--login' : 'auth-submit-btn--register'
            ]"
          >
            <span v-if="!loading">{{ isLoginMode ? 'Sign In' : 'Create Account' }}</span>
            <span v-else>{{ isLoginMode ? 'Signing in...' : 'Creating...' }}</span>
          </button>

          <!-- 底部链接 -->
          <div class="auth-footer-links">
            <span>{{ isLoginMode ? "Don't have an account yet?" : 'Already have an account?' }}</span>
            <button
              type="button"
              class="auth-link auth-link--primary"
              @click="toggleMode"
            >
              {{ isLoginMode ? 'Register Now' : 'Sign In' }}
            </button>
          </div>

          <!-- 忘记密码链接（仅登录模式） -->
          <div v-if="isLoginMode" class="auth-footer-links">
            <NuxtLink
              to="/reset-password"
              class="auth-link auth-link--forgot"
            >
              忘记密码？
            </NuxtLink>
          </div>

          <!-- 占位空间（注册模式） -->
          <div v-else class="auth-footer-links auth-footer-links--placeholder">
            <span></span>
          </div>

          <!-- 分隔线（仅登录模式） -->
          <div v-if="isLoginMode" class="auth-divider">
            <span class="divider-text">- OR -</span>
          </div>

          <!-- 注册模式的占位分隔线 -->
          <div v-else class="auth-divider auth-divider--placeholder">
            <span class="divider-text"></span>
          </div>

          <!-- 社交登录按钮（仅登录模式） -->
          <div v-if="isLoginMode" class="social-login">
            <button
              type="button"
              :disabled="loading"
              class="social-btn"
              @click="handleGoogleAuth"
            >
              <span class="social-icon social-icon--google">G</span>
              使用 Google 账号
            </button>
          </div>

          <!-- 注册模式的占位社交登录区域 -->
          <div v-else class="social-login social-login--placeholder">
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
import { ref, computed, onMounted } from 'vue'
import {
  AuthService,
  validateEmail,
  validatePassword
} from '@acuity-bookmarks/auth-core'
import { createClient } from '@supabase/supabase-js'

// SEO 配置（动态根据模式）
const route = useRoute()
const isLoginMode = ref(route.query.mode !== 'register')

definePageMeta({
  title: '登录 / 注册',
  description: '登录或注册您的 AcuityBookmarks 账户'
})

useSeoMeta({
  title: () => `${isLoginMode.value ? '登录' : '注册'} - AcuityBookmarks`,
  description: () =>
    `${isLoginMode.value ? '登录您的' : '创建您的'} AcuityBookmarks 账户，开始高效管理您的书签`,
  ogTitle: () => `${isLoginMode.value ? '登录' : '注册'} - AcuityBookmarks`,
  ogDescription: () =>
    `${isLoginMode.value ? '登录您的' : '创建您的'} AcuityBookmarks 账户，开始高效管理您的书签`
})

// 表单状态
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

// 表单验证
const emailError = computed(() => {
  if (!email.value) return ''
  const validation = validateEmail(email.value)
  return validation.valid ? '' : validation.message || ''
})

const passwordError = computed(() => {
  if (!password.value) return ''
  if (isLoginMode.value) return '' // 登录模式不验证密码格式
  const validation = validatePassword(password.value)
  return validation.valid ? '' : validation.message || ''
})

const confirmPasswordError = computed(() => {
  if (isLoginMode.value) return ''
  if (!confirmPassword.value) return ''
  if (password.value !== confirmPassword.value) {
    return '两次输入的密码不一致'
  }
  return ''
})

// 初始化 Supabase 和 AuthService
const config = useRuntimeConfig()
const supabaseUrl = config.public.supabaseUrl
const supabaseAnonKey = config.public.supabaseAnonKey

if (!supabaseUrl || !supabaseAnonKey) {
  error.value = 'Supabase 配置缺失，请联系管理员'
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const authService = new AuthService(supabase)

// 模式切换
const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  error.value = ''
  success.value = ''
  confirmPassword.value = ''

  // 更新 URL（不刷新页面）
  const newQuery = isLoginMode.value ? {} : { mode: 'register' }
  navigateTo({ query: newQuery }, { replace: true })
}

// 统一提交处理
const handleSubmit = async () => {
  error.value = ''
  success.value = ''

  // 验证邮箱
  const emailValidation = validateEmail(email.value)
  if (!emailValidation.valid) {
    error.value = emailValidation.message || '邮箱格式不正确'
    return
  }

  // 注册模式额外验证
  if (!isLoginMode.value) {
    if (emailError.value || passwordError.value || confirmPasswordError.value) {
      error.value = '请检查输入信息'
      return
    }
  }

  loading.value = true

  try {
    if (isLoginMode.value) {
      // 登录
      await authService.signIn({
        email: email.value,
        password: password.value
      })

      await navigateTo('/download')
    } else {
      // 注册
      await authService.signUp({
        email: email.value,
        password: password.value
      })

      success.value = '注册成功！正在跳转...'

      setTimeout(async () => {
        await navigateTo('/download')
      }, 1500)
    }
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : `${isLoginMode.value ? '登录' : '注册'}失败，请稍后重试`
  } finally {
    loading.value = false
  }
}

// Google OAuth 统一处理
const handleGoogleAuth = async () => {
  loading.value = true
  error.value = ''

  try {
    const { url } = await authService.getOAuthUrl('google', {
      redirectUrl: `${window.location.origin}/auth/callback`
    })

    window.location.href = url
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : `Google ${isLoginMode.value ? '登录' : '注册'}失败`
    loading.value = false
  }
}

// 注入 design tokens
useDesignTokens()

// 监听 URL 参数变化
onMounted(() => {
  const query = useRoute().query
  if (query.mode === 'register') {
    isLoginMode.value = false
  }
})
</script>

<style scoped>
/* ==================== */
/* 全局布局 */
/* ==================== */
.auth-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background: #f5f5f5;
}

.auth-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  background: #fff;
  overflow: hidden;
}

/* ==================== */
/* 左侧装饰区域 */
/* ==================== */
.auth-decorative {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 3rem;
  background: var(--color-gradient);
  overflow: hidden;
}

.decorative-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.shape--circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  height: 500px;
  border-radius: 50% 40% 60% 50%;
  background: rgba(255, 255, 255, 0.15);
  transform: translate(-50%, -50%);
}

.decorative-content {
  position: relative;
  z-index: 1;
  max-width: 400px;
  text-align: center;
  color: rgba(0, 0, 0, 0.8);
}

.decorative-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 200px;
  height: 200px;
  margin: 0 auto 2rem;
  color: rgba(0, 0, 0, 0.6);
}

.decorative-icon svg {
  width: 100%;
  height: 100%;
}

.decorative-title {
  margin-bottom: 1rem;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.85);
}

.decorative-subtitle {
  font-size: 1.125rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.7);
}

/* ==================== */
/* 右侧表单区域 */
/* ==================== */
.auth-form-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 3rem;
  background: #fff;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 400px;
}

.auth-alert {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.auth-alert--error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.auth-alert--success {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.5);
}

.auth-alert-text {
  font-size: 0.875rem;
  color: #ef4444;
}

.auth-alert--success .auth-alert-text {
  color: #22c55e;
}

.auth-title {
  margin: 0 0 2rem 0;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  letter-spacing: -0.01em;
  color: #1f2937;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.form-field-row {
  display: grid;
  align-items: center;
  gap: 1rem;
  grid-template-columns: 100px 1fr;
  width: 100%;
}

.field-label {
  font-size: 1rem;
  font-weight: 500;
  text-align: left;
  color: #1f2937;
}

.auth-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #1f2937;
  transition: all 0.2s;
}

.auth-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.auth-input--error {
  border-color: #ef4444;
}

.auth-input::placeholder {
  color: #9ca3af;
}

.field-error {
  margin-top: -0.5rem;
  margin-left: 100px;
  font-size: 0.875rem;
  color: #ef4444;
}

.auth-submit-btn {
  width: 100%;
  height: 48px;
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 登录按钮 - 深绿色 */
.auth-submit-btn--login {
  color: white;
  background-color: var(--color-brand-green);
}

.auth-submit-btn--login:hover:not(:disabled) {
  background-color: var(--color-brand-green-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 160, 133, 0.3);
}

/* 注册按钮 - 金黄色 */
.auth-submit-btn--register {
  color: #000;
  background-color: var(--color-brand-yellow);
  font-weight: 700;
}

.auth-submit-btn--register:hover:not(:disabled) {
  background-color: var(--color-brand-yellow-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.auth-footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  height: 20px;
  min-height: 20px;
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.auth-footer-links--placeholder {
  visibility: hidden;
}

.auth-link {
  padding: 0;
  background: none;
  border: none;
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.2s;
}

.auth-link--primary {
  font-weight: 600;
  color: var(--color-brand-yellow);
}

.auth-link--primary:hover {
  color: var(--color-brand-yellow-hover);
  text-decoration: underline;
}

.auth-link--forgot {
  font-weight: 400;
  color: #6b7280;
}

.auth-link--forgot:hover {
  color: #1f2937;
  text-decoration: underline;
}

.auth-divider {
  display: flex;
  align-items: center;
  height: 20px;
  min-height: 20px;
  margin: 1.5rem 0;
  text-align: center;
}

.auth-divider::before,
.auth-divider::after {
  flex: 1;
  height: 1px;
  background: #e5e7eb;
  content: '';
}

.divider-text {
  padding: 0 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: #9ca3af;
}

.auth-divider--placeholder {
  visibility: hidden;
}

.social-login {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  height: 48px;
  min-height: 48px;
}

.social-login--placeholder {
  visibility: hidden;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex: 1;
  height: 48px;
  padding: 0 1rem;
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s;
}

.social-btn:hover:not(:disabled) {
  border-color: #d1d5db;
  background: #f9fafb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.social-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.social-btn-placeholder {
  flex: 1;
  height: 48px;
}

.social-icon {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.social-icon--google {
  border: 2px solid #4285f4;
  color: #4285f4;
  background: transparent;
}

.auth-fineprint {
  margin-top: 1rem;
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: center;
  color: #9ca3af;
}

/* ==================== */
/* 响应式设计 */
/* ==================== */
@media (max-width: 768px) {
  .auth-container {
    grid-template-columns: 1fr;
  }

  .auth-decorative {
    min-height: 200px;
    padding: 2rem;
  }

  .decorative-title {
    font-size: 2rem;
  }

  .decorative-icon {
    width: 120px;
    height: 120px;
  }

  .shape--circle {
    display: none;
  }

  .auth-form-wrapper {
    padding: 2rem;
  }

  .form-field-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .field-label {
    text-align: left;
  }

  .field-error {
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .auth-decorative {
    min-height: 150px;
    padding: 1.5rem;
  }

  .decorative-title {
    font-size: 1.5rem;
  }

  .auth-form-wrapper {
    padding: 1.5rem;
  }

  .auth-title {
    font-size: 1.5rem;
  }
}
</style>
