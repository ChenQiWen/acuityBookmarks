<template>
  <div class="auth-page">
    <!-- 邮箱验证成功模式 -->
    <div
      v-if="isEmailVerificationMode"
      class="auth-container auth-container--success"
    >
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <div class="auth-success-icon">✅</div>
          <h1 class="auth-title">邮箱验证成功！</h1>
          <p class="auth-message">您的邮箱已验证成功，现在可以登录了。</p>
          <Button
            color="primary"
            size="lg"
            class="auth-submit-btn"
            @click="goToLogin"
          >
            立即登录
          </Button>
        </div>
      </div>
    </div>

    <!-- 重置密码模式 -->
    <div v-else-if="isResetMode" class="auth-container auth-container--reset">
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
            placeholder="至少8位，包含字母和数字"
            autocomplete="new-password"
            size="lg"
            :error="resetPassword ? !isPasswordValid(resetPassword) : false"
            :error-message="
              resetPassword && !isPasswordValid(resetPassword)
                ? passwordErrorMessage
                : undefined
            "
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
          <!-- 错误提示（固定定位，不影响布局） -->
          <Alert
            v-if="authError && !isSuccessMessage"
            :message="authError"
            color="error"
            variant="filled"
            size="md"
            class="auth-error-alert"
          />

          <!-- 标题 -->
          <h1 v-if="!isForgotPasswordMode" class="auth-title">
            {{ isLoginMode ? 'Welcome Back' : 'Create your Free Account' }}
          </h1>

          <!-- 统一表单布局（登录/注册模式） -->
          <form
            v-if="!isForgotPasswordMode"
            :class="['form-fields', `form-fields--${formConfig.mode}`]"
            @submit.prevent="
              async e => {
                e.preventDefault()
                await formConfig.onSubmit()
              }
            "
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
                @input="clearErrorOnInput"
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
                @input="clearErrorOnInput"
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
                @input="clearErrorOnInput"
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
                @input="clearErrorOnInput"
              />
            </div>
          </form>

          <Button
            v-if="!isForgotPasswordMode"
            size="lg"
            :disabled="formConfig.loading.value"
            :loading="formConfig.loading.value"
            :class="['auth-submit-btn', `auth-submit-btn--${formConfig.mode}`]"
            :data-testid="`btn-${formConfig.mode}`"
            @click="formConfig.onSubmit"
          >
            {{ formConfig.submitButtonText }}
          </Button>

          <div v-if="!isForgotPasswordMode" class="auth-footer-links">
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
          <!-- 暂时禁用，避免触发邮件发送频率限制 -->
          <div
            v-if="
              ENABLE_FORGOT_PASSWORD && isLoginMode && !isForgotPasswordMode
            "
            class="auth-footer-links"
          >
            <Button
              variant="text"
              size="sm"
              class="auth-link auth-link--forgot"
              :disabled="loginLoading"
              @click="showForgotPassword"
            >
              忘记密码？
            </Button>
          </div>

          <!-- 忘记密码模式 UI -->
          <!-- 暂时禁用，避免触发邮件发送频率限制 -->
          <div
            v-if="ENABLE_FORGOT_PASSWORD && isForgotPasswordMode"
            class="forgot-password-section"
          >
            <h2 class="auth-title">重置密码</h2>
            <p class="auth-subtitle">
              请输入您的邮箱地址，我们将发送密码重置链接
            </p>

            <div class="form-field-row">
              <label class="field-label">Email</label>
              <Input
                v-model.trim="forgotPasswordEmail"
                type="email"
                name="forgot-email"
                placeholder="Enter your Email here"
                autocomplete="email"
                size="lg"
                :error="
                  !isEmailValid(forgotPasswordEmail) &&
                  forgotPasswordEmail.length > 0
                "
                @input="clearErrorOnInput"
              />
            </div>

            <Button
              size="lg"
              :disabled="
                forgotPasswordLoading || !isEmailValid(forgotPasswordEmail)
              "
              :loading="forgotPasswordLoading"
              class="auth-submit-btn auth-submit-btn--login"
              @click="submitForgotPassword"
            >
              发送重置链接
            </Button>

            <div class="auth-footer-links">
              <Button
                variant="text"
                size="sm"
                class="auth-link"
                :disabled="forgotPasswordLoading"
                @click="backToLogin"
              >
                返回登录
              </Button>
            </div>
          </div>

          <!-- 占位空间（注册模式，保持与登录模式的"忘记密码"高度一致） -->
          <!-- 如果忘记密码功能禁用，登录模式也需要占位空间 -->
          <div
            v-else-if="(!ENABLE_FORGOT_PASSWORD && isLoginMode) || !isLoginMode"
            class="auth-footer-links auth-footer-links--placeholder"
          >
            <span></span>
          </div>

          <!-- 分隔线（仅登录模式且非忘记密码模式） -->
          <div
            v-if="
              isLoginMode && (!ENABLE_FORGOT_PASSWORD || !isForgotPasswordMode)
            "
            class="auth-divider"
          >
            <span class="divider-text">- OR -</span>
          </div>

          <!-- 注册模式的占位分隔线（保持高度一致） -->
          <div
            v-else-if="!isLoginMode"
            class="auth-divider auth-divider--placeholder"
          >
            <span class="divider-text"></span>
          </div>

          <!-- 社交登录按钮（仅登录模式且非忘记密码模式） -->
          <div
            v-if="
              isLoginMode && (!ENABLE_FORGOT_PASSWORD || !isForgotPasswordMode)
            "
            class="social-login"
          >
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
              使用 Google 账号
            </Button>
            <Button
              variant="outline"
              size="lg"
              class="social-btn"
              data-testid="btn-oauth-microsoft"
              @click="oauth('microsoft')"
            >
              <template #prepend>
                <span class="social-icon social-icon--microsoft">M</span>
              </template>
              使用 Microsoft 账号
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
import {
  computed,
  defineOptions,
  ref,
  shallowRef,
  onMounted,
  watch,
  onUnmounted
} from 'vue'
import { Alert, Button, Input } from '@/components'
import { useSupabaseAuth } from '@/composables'
import { notificationService } from '@/application/notification/notification-service'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { supabase } from '@/infrastructure/supabase/client'

/// <reference types="chrome"/>

defineOptions({
  name: 'AuthPage'
})

import { signInWithOAuthNew } from '@/composables/useSupabaseAuth-oauth-new'

const {
  signIn,
  signUp,
  resetPassword: supabaseResetPassword,
  updatePassword: supabaseUpdatePassword
} = useSupabaseAuth()

// ============================================
// 功能开关：忘记密码功能
// ============================================
// ✅ SMTP 已配置完成，启用忘记密码功能
const ENABLE_FORGOT_PASSWORD = true

const authError = shallowRef<string>('')

// 判断是否是成功消息
const isSuccessMessage = computed(() => {
  return authError.value.includes('✅') || authError.value.includes('成功')
})

// 错误提示自动消失定时器
let errorAutoHideTimer: ReturnType<typeof setTimeout> | null = null

// 监听 authError 变化，设置自动消失
watch(authError, newError => {
  // 清除之前的定时器
  if (errorAutoHideTimer) {
    clearTimeout(errorAutoHideTimer)
    errorAutoHideTimer = null
  }

  // 如果有错误且不是成功消息，5秒后自动消失
  // 成功消息（包含 ✅ 或 "成功"）不自动消失
  if (newError && !newError.includes('✅') && !newError.includes('成功')) {
    errorAutoHideTimer = setTimeout(() => {
      authError.value = ''
      errorAutoHideTimer = null
    }, 5000) // 5秒后自动消失
  }
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (errorAutoHideTimer) {
    clearTimeout(errorAutoHideTimer)
    errorAutoHideTimer = null
  }
})

// 用户开始输入时清除错误提示
const clearErrorOnInput = () => {
  // 只清除错误消息，保留成功消息
  if (
    authError.value &&
    !authError.value.includes('✅') &&
    !authError.value.includes('成功')
  ) {
    authError.value = ''
    if (errorAutoHideTimer) {
      clearTimeout(errorAutoHideTimer)
      errorAutoHideTimer = null
    }
  }
}
const loginEmail = ref('')
const loginPassword = ref('')
const regEmail = ref('')
const regPassword = ref('')
const loginLoading = ref(false)
const regLoading = ref(false)
const isLoginMode = ref(true) // 默认显示登录模式
const isForgotPasswordMode = ref(false) // 忘记密码模式
const forgotPasswordEmail = ref('') // 忘记密码邮箱输入
const forgotPasswordLoading = ref(false) // 忘记密码加载状态

// 统一表单配置（根据登录/注册模式切换）
const formConfig = computed(() => {
  if (isLoginMode.value) {
    return {
      mode: 'login' as const,
      loading: loginLoading,
      passwordPlaceholder: 'Enter your Password here',
      passwordAutocomplete: 'current-password' as const,
      // 登录模式下，密码输入框不显示错误（登录错误通过顶部 Alert 显示）
      passwordError: false,
      passwordErrorMessage: undefined as string | undefined,
      // 邮箱输入框只在格式错误时显示错误（登录错误通过顶部 Alert 显示）
      emailError:
        !isEmailValid(loginEmail.value) && loginEmail.value.length > 0,
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
      passwordPlaceholder: '至少8位，包含字母和数字',
      passwordAutocomplete: 'new-password' as const,
      passwordError: !!(
        regPassword.value && !isPasswordValid(regPassword.value)
      ),
      passwordErrorMessage:
        regPassword.value && !isPasswordValid(regPassword.value)
          ? passwordErrorMessage
          : (undefined as string | undefined),
      // 注册模式下，邮箱输入框只在格式错误时显示错误（注册错误通过顶部 Alert 显示）
      emailError: !isEmailValid(regEmail.value) && regEmail.value.length > 0,
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

// 密码验证正则：至少8位，包含字母和数字
// 🔑 安全策略：适度的密码复杂度 + 账户冻结机制（Rate Limiting）
// 密码复杂度不是最重要的，更重要的是防止暴力破解（连续错误后冻结账户）
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/

// 密码验证
const isPasswordValid = (password: string): boolean => {
  return PASSWORD_REGEX.test(password)
}

// 密码错误提示信息
const passwordErrorMessage = '密码必须至少8位，包含字母和数字'

// 邮箱格式验证
const isEmailValid = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// OAuth 登录防重复调用标志
let isOAuthInProgress = false

async function oauth(provider: 'google' | 'microsoft') {
  // 🔒 防止重复调用
  if (isOAuthInProgress) {
    console.warn('[Auth] OAuth 登录正在进行中，忽略重复调用')
    return
  }

  authError.value = ''

  try {
    isOAuthInProgress = true
    loginLoading.value = true
    await signInWithOAuthNew(provider)

    // 登录成功
    authError.value = ''

    // 🔑 OAuth 登录后，等待用户信息同步（Google 的 user_metadata 可能需要一点时间）
    console.log('[Auth] OAuth 登录成功，等待用户信息同步...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // 🔑 再次刷新用户信息，确保昵称和头像已加载
    try {
      const {
        data: { user: refreshedUser },
        error: refreshError
      } = await supabase.auth.getUser()
      if (refreshError) {
        console.warn('[Auth] ⚠️ 刷新用户信息失败:', refreshError)
      } else if (refreshedUser) {
        console.log('[Auth] ✅ 用户信息已刷新:', {
          userId: refreshedUser.id,
          email: refreshedUser.email,
          hasNickname: !!refreshedUser.user_metadata?.nickname,
          hasFullName: !!refreshedUser.user_metadata?.full_name,
          hasPicture: !!refreshedUser.user_metadata?.picture,
          hasAvatarUrl: !!refreshedUser.user_metadata?.avatar_url
        })
      }
    } catch (refreshErr) {
      console.warn('[Auth] ⚠️ 刷新用户信息异常:', refreshErr)
    }

    emitEvent('auth:logged-in', {})
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    console.error('[Auth] OAuth failed:', e)
    const errorMsg = (e as Error)?.message || 'OAuth 登录失败，请稍后重试'

    // 如果是用户取消授权，不显示错误提示
    if (errorMsg.includes('用户取消了授权') || errorMsg.includes('canceled')) {
      console.log('[Auth] 用户取消了 OAuth 授权，不显示错误')
      authError.value = ''
      return
    }

    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
  } finally {
    loginLoading.value = false
    isOAuthInProgress = false
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
    await signIn(loginEmail.value, loginPassword.value)

    // 登录成功
    authError.value = ''
    emitEvent('auth:logged-in', {})
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || '登录失败，请稍后重试'
    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
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
  // 密码验证错误由 Input 组件的 error-message 显示，不需要额外的 Alert
  if (!isPasswordValid(regPassword.value)) {
    return // 直接返回，让 Input 组件显示错误信息
  }
  regLoading.value = true
  try {
    const result = await signUp(regEmail.value, regPassword.value)

    // 注册成功后，显示提示并自动登录
    authError.value = ''
    await notificationService.notify('✅ 注册成功！正在为您登录...', {
      level: 'success'
    })

    console.log('[Auth] 注册成功，用户信息:', {
      userId: result.user?.id,
      email: result.user?.email,
      hasSession: !!result.session,
      session: result.session,
      user: result.user
    })

    // ⚠️ 如果 session 为 null，说明需要邮箱验证
    if (!result.session) {
      console.warn('[Auth] ⚠️ 注册成功但 session 为 null，可能需要邮箱验证')
      authError.value = '✅ 注册成功！请检查您的邮箱并点击验证链接完成注册。'
      await notificationService.notify('✅ 注册成功！请检查邮箱验证', {
        level: 'success'
      })
      // 不跳转，让用户先验证邮箱
      return
    }

    // 确保 Supabase session 已持久化到 chrome.storage.local
    // 等待 Supabase 完成持久化操作
    await new Promise(resolve => setTimeout(resolve, 500))

    // 验证 session 是否已持久化
    try {
      const {
        data: { session: verifySession }
      } = await supabase.auth.getSession()
      console.log('[Auth] 验证 session 持久化:', {
        hasSession: !!verifySession,
        userId: verifySession?.user?.id
      })

      if (!verifySession) {
        console.warn('[Auth] ⚠️ Session 未持久化，等待更长时间...')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (e) {
      console.error('[Auth] 验证 session 失败:', e)
    }

    // 发送登录事件
    console.log('[Auth] 发送登录事件...')
    emitEvent('auth:logged-in', {})

    // 延时后自动跳转（给事件监听器和页面初始化时间）
    // 增加延迟，确保 user 和 session 已正确设置
    await new Promise(resolve => setTimeout(resolve, 500))

    // 再次验证 session 是否已设置
    try {
      const {
        data: { session: finalSession }
      } = await supabase.auth.getSession()
      console.log('[Auth] 跳转前验证 session:', {
        hasSession: !!finalSession,
        hasUser: !!finalSession?.user,
        userId: finalSession?.user?.id
      })
    } catch (e) {
      console.warn('[Auth] 验证 session 失败:', e)
    }

    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || '注册失败，请稍后重试'
    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
  } finally {
    regLoading.value = false
  }
}

// 显示忘记密码 UI
function showForgotPassword() {
  isForgotPasswordMode.value = true
  forgotPasswordEmail.value = loginEmail.value // 预填充当前邮箱
  authError.value = ''
}

// 返回登录页面
function backToLogin() {
  isForgotPasswordMode.value = false
  forgotPasswordEmail.value = ''
  authError.value = ''
}

// 提交忘记密码请求
async function submitForgotPassword() {
  authError.value = ''

  if (!forgotPasswordEmail.value) {
    authError.value = '请输入邮箱地址'
    return
  }

  if (!isEmailValid(forgotPasswordEmail.value)) {
    authError.value = '请输入有效的邮箱地址'
    return
  }

  try {
    forgotPasswordLoading.value = true
    await supabaseResetPassword(forgotPasswordEmail.value)
    authError.value = '✅ 如果邮箱存在，我们已发送重置邮件'
    await notificationService.notify('如果邮箱存在，我们已发送重置邮件', {
      level: 'success'
    })
    // 3秒后返回登录页面
    setTimeout(() => {
      backToLogin()
    }, 3000)
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || '请求失败，请稍后重试'
    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
  } finally {
    forgotPasswordLoading.value = false
  }
}

// 重置密码模式（Supabase 通过 URL hash 传递 token）
const resetPassword = ref<string>('')
const resetLoading = ref(false)
const isResetMode = (() => {
  try {
    const u = new URL(window.location.href)
    // Supabase 会将 token 放在 hash 中，格式: #access_token=xxx&type=recovery
    const hash = u.hash.substring(1)
    const params = new URLSearchParams(hash)
    return params.get('type') === 'recovery' && params.has('access_token')
  } catch {
    return false
  }
})()

// 邮箱验证模式（Supabase 通过 URL hash 传递 token）
const isEmailVerificationMode = (() => {
  try {
    const u = new URL(window.location.href)
    const hash = u.hash.substring(1)
    const params = new URLSearchParams(hash)
    // 邮箱验证会传递 type=signup 或没有 type，但有 access_token
    return params.has('access_token') && params.get('type') !== 'recovery'
  } catch {
    return false
  }
})()

// 跳转到登录页面
function goToLogin() {
  isLoginMode.value = true
  // 清除 URL hash，避免重复触发验证逻辑
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search
  )
}

async function doResetPassword() {
  authError.value = ''
  if (!resetPassword.value) {
    authError.value = '请输入新密码'
    return
  }
  // 密码验证错误由 Input 组件的 error-message 显示，不需要额外的 Alert
  if (!isPasswordValid(resetPassword.value)) {
    return // 直接返回，让 Input 组件显示错误信息
  }
  resetLoading.value = true
  try {
    await supabaseUpdatePassword(resetPassword.value)
    authError.value = '✅ 密码已重置，请使用新密码登录'
    await notificationService.notify('密码已重置，请使用新密码登录', {
      level: 'success'
    })
    // 延迟后跳转到登录页面
    setTimeout(() => {
      window.location.href = chrome.runtime.getURL('auth.html')
    }, 2000)
  } catch (e: unknown) {
    const errorMsg = (e as Error)?.message || '重置失败，请稍后重试'
    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
  } finally {
    resetLoading.value = false
  }
}

// 初始化：检查是否是从 Supabase 重定向回来的
onMounted(async () => {
  console.log('[Auth] onMounted 执行，当前 URL:', window.location.href)
  console.log('[Auth] URL hash:', window.location.hash)

  try {
    const u = new URL(window.location.href)
    const hash = u.hash.substring(1)
    const params = new URLSearchParams(hash)

    console.log('[Auth] URL 解析结果:', {
      hash,
      hasAccessToken: params.has('access_token'),
      hasRefreshToken: params.has('refresh_token'),
      type: params.get('type'),
      allParams: Object.fromEntries(params.entries())
    })

    // 如果是 OAuth 回调（包含 access_token）
    if (params.has('access_token') && params.get('type') !== 'recovery') {
      console.log('[Auth] ✅ 检测到 OAuth 回调，开始处理 token')

      // 🔒 手动从 URL hash 中提取 token 并设置 session
      // 因为 detectSessionInUrl: false，Supabase 不会自动处理
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (accessToken && refreshToken) {
        try {
          console.log('[Auth] 设置 session...', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            accessTokenLength: accessToken.length,
            refreshTokenLength: refreshToken.length
          })

          // 手动设置 session
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })

          if (sessionError) {
            console.error('[Auth] ❌ 设置 session 失败:', sessionError)
            authError.value = sessionError.message || '登录失败，请稍后重试'
            return
          }

          if (sessionData.session && sessionData.user) {
            console.log('[Auth] ✅ OAuth 登录成功', {
              userId: sessionData.user.id,
              email: sessionData.user.email,
              userMetadata: sessionData.user.user_metadata
            })

            // 🔑 立即刷新用户信息，确保获取到完整的 user_metadata（包括头像、昵称等）
            // OAuth 登录后，user_metadata 可能需要一点时间同步，主动刷新可以立即获取
            try {
              const {
                data: { user: refreshedUser },
                error: refreshError
              } = await supabase.auth.getUser()
              if (!refreshError && refreshedUser) {
                console.log('[Auth] ✅ 已刷新用户信息', {
                  hasFullName: !!refreshedUser.user_metadata?.full_name,
                  hasPicture: !!refreshedUser.user_metadata?.picture,
                  hasNickname: !!refreshedUser.user_metadata?.nickname,
                  userMetadata: refreshedUser.user_metadata
                })
              } else if (refreshError) {
                console.warn(
                  '[Auth] ⚠️ 刷新用户信息失败（不影响登录）:',
                  refreshError
                )
              }
            } catch (refreshErr) {
              console.warn(
                '[Auth] ⚠️ 刷新用户信息异常（不影响登录）:',
                refreshErr
              )
            }

            // 清除 URL hash，避免重复触发
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            )

            // 触发登录成功事件
            emitEvent('auth:logged-in', {})

            // 延迟跳转，让用户看到成功提示
            setTimeout(() => {
              onAuthSuccessNavigate()
            }, 1500)
          } else {
            console.error('[Auth] ❌ Session 数据不完整', sessionData)
            authError.value = '登录失败，session 数据不完整'
          }
        } catch (err) {
          console.error('[Auth] ❌ 处理 OAuth 回调失败:', err)
          authError.value = (err as Error).message || '登录失败，请稍后重试'
        }
      } else {
        console.error('[Auth] ❌ URL 中缺少必要的 token', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hash
        })
        authError.value = '登录失败，未找到有效的 token'
      }
    } else {
      console.log('[Auth] 不是 OAuth 回调，显示登录/注册页面')
    }
    // 如果是密码重置回调
    if (params.get('type') === 'recovery' && params.has('access_token')) {
      // 密码重置逻辑已在 isResetMode 中处理
      console.log('[Auth] 检测到密码重置回调')
    }
  } catch (e) {
    console.error('[Auth] ❌ Failed to handle redirect:', e)
  }
})

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
</script>

<style scoped>
@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式设计 */
@media (width <= 768px) {
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
    min-height: auto;
    padding: var(--spacing-4);
  }

  .auth-form {
    max-width: 100%;
  }

  .auth-title {
    font-size: 1.5rem;
  }

  /* 移动端登录表单改为垂直布局 */
  .form-field-row {
    gap: var(--spacing-xs);
    grid-template-columns: 1fr;
  }

  .field-label {
    text-align: left;
  }
}

@media (width <= 480px) {
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

.auth-page {
  display: flex;
  justify-content: stretch;
  align-items: stretch;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background: var(--color-background);
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
  margin: var(--spacing-6) auto;
  border-radius: var(--radius-lg);
}

.auth-container--success {
  grid-template-columns: 1fr;
  max-width: 500px;
  min-height: auto;
  margin: var(--spacing-6) auto;
  border-radius: var(--radius-lg);
}

.auth-success-icon {
  margin-bottom: var(--spacing-md);
  font-size: 64px;
  text-align: center;
}

.auth-message {
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-md);
  text-align: center;
  color: var(--color-text-secondary);
}

/* 左侧装饰区域 */
.auth-decorative {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--spacing-8);
  background: linear-gradient(135deg, #ffd54f 0%, #ffeb3b 50%, #ffc107 100%);
  overflow: hidden;
}

.decorative-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.shape {
  position: absolute;
}

.shape--circle {
  top: 50%;
  left: 50%;
  width: 500px;
  height: 500px;
  border-radius: 50% 40% 60% 50%;
  background: rgb(255 255 255 / 15%);
  transform: translate(-50%, -50%);
}

.decorative-content {
  position: relative;
  z-index: 1;
  max-width: 400px;
  text-align: center;
  color: rgb(0 0 0 / 80%);
}

.decorative-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 200px;
  height: 200px;
  margin: 0 auto var(--spacing-6);
  color: rgb(0 0 0 / 60%);
}

.decorative-icon svg {
  width: 100%;
  height: 100%;
}

.decorative-title {
  margin-bottom: var(--spacing-md);
  font-size: 2.5rem;
  font-weight: var(--font-bold);
  line-height: 1.2;
  color: rgb(0 0 0 / 85%);
}

.decorative-subtitle {
  font-size: var(--text-lg);
  line-height: 1.5;
  color: rgb(0 0 0 / 70%);
}

/* 右侧表单区域 */
.auth-form-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--spacing-8);
  background: var(--color-surface);
}

.auth-container--reset .auth-form-wrapper {
  min-height: auto;
  padding: var(--spacing-6);
}

.auth-form {
  position: relative; /* 为绝对定位的 Alert 提供定位上下文 */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 400px;
  min-height: fit-content;

  /* 平滑过渡高度变化，避免抖动 */
  transition: height 0.3s ease;
}

/* 错误提示 Alert - 绝对定位，不影响布局 */
.auth-error-alert {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 1000;
  width: calc(100% - var(--spacing-md) * 2);
  max-width: 400px;
  margin: 0;
  transform: translateX(-50%);
  animation: slide-down 0.3s ease-out;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}

.auth-title {
  margin: 0 0 var(--spacing-6) 0;
  font-size: 2rem;
  font-weight: var(--font-bold);
  line-height: 1.3;
  text-align: center;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.auth-subtitle {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: var(--text-base);
  line-height: 1.5;
  text-align: center;
  color: var(--color-text-secondary);
}

.forgot-password-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
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
  align-items: center;
  gap: var(--spacing-md);
  grid-template-columns: 100px 1fr;
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
  text-align: left;
  color: var(--color-text-primary);
}

.auth-submit-btn {
  width: 100%;
  height: 48px;
  margin-top: var(--spacing-md);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

/* 登录按钮 - 深绿色/青绿色 */
.auth-submit-btn--login {
  border-color: #16a085 !important;
  font-weight: var(--font-semibold);
  color: white !important;
  background-color: #16a085 !important;
}

.auth-submit-btn--login:disabled {
  opacity: 0.6;
}

.auth-submit-btn--login:hover:not(:disabled) {
  border-color: #138d75 !important;
  background-color: #138d75 !important;
}

/* 注册按钮 - 黄色 */
.auth-submit-btn--register {
  border-color: #ffd700 !important;
  font-weight: var(--font-bold);
  color: #000 !important;
  background-color: #ffd700 !important;
}

.auth-submit-btn--register:disabled {
  opacity: 0.6;
}

.auth-submit-btn--register:hover:not(:disabled) {
  border-color: #ffed4e !important;
  background-color: #ffed4e !important;
}

.auth-footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-xs);
  height: 20px;

  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 20px;
  margin: var(--spacing-md) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* 占位链接（保持高度一致） */
.auth-footer-links--placeholder {
  height: 20px;

  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 20px;
  visibility: hidden; /* 隐藏但占据空间 */
}

/* Button variant="text" 的自定义样式 */
.auth-link {
  min-width: auto;
  padding: 0;
  font-size: var(--text-sm);
}

/* 主要链接 - 亮色（黄色） */
.auth-link--primary {
  font-weight: var(--font-semibold);
  color: #ffd700 !important;
}

.auth-link--primary:hover {
  text-decoration: underline;
  color: #ffed4e !important;
  background: transparent !important;
}

/* 次要链接 - 灰色 */
.auth-link--forgot {
  font-weight: var(--font-normal);
  color: var(--color-text-secondary) !important;
}

.auth-link--forgot:hover {
  text-decoration: underline;
  color: var(--color-text-primary) !important;
  background: transparent !important;
}

.auth-divider {
  display: flex;
  align-items: center;
  height: 20px;

  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 20px;
  margin: var(--spacing-lg) 0;
  text-align: center;
}

.auth-divider::before,
.auth-divider::after {
  flex: 1;
  height: 1px;
  background: var(--color-border);
  content: '';
}

.divider-text {
  padding: 0 var(--spacing-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
}

/* 占位分隔线（保持高度一致） */
.auth-divider--placeholder {
  height: 20px;

  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 20px;
  visibility: hidden; /* 隐藏但占据空间 */
  pointer-events: none;
}

.auth-divider--placeholder::before,
.auth-divider--placeholder::after {
  background: transparent; /* 隐藏线条 */
}

.social-login {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  height: 48px;

  /* 固定高度，确保登录/注册切换时高度一致 */
  min-height: 48px;
}

/* 占位社交登录区域（保持高度一致） */
.social-login--placeholder {
  height: 48px;

  /* 确保占位元素高度与实际元素完全一致 */
  min-height: 48px;
  visibility: hidden; /* 隐藏但占据空间 */
  pointer-events: none;
}

.social-btn-placeholder {
  flex: 1;
  height: 48px; /* 与 .auth-submit-btn 高度一致 */
}

.social-btn {
  flex: 1;
  min-width: 0; /* 允许按钮缩小 */
}

.social-icon {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: var(--font-bold);
}

.social-icon--google {
  border: 2px solid #4285f4;
  color: #4285f4;
  background: transparent;
}

.social-icon--microsoft {
  border: 2px solid #00a1f1;
  color: #00a1f1;
  background: transparent;
}

.auth-fineprint {
  margin: var(--spacing-md) 0 0;
  font-size: var(--text-xs);
  line-height: 1.6;
  text-align: center;
  color: var(--color-text-tertiary);
}
</style>
