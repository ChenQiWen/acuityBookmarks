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
            placeholder="至少10位，包含大小写/数字/符号"
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

const {
  signIn,
  signUp,
  signInWithOAuth,
  resetPassword: supabaseResetPassword,
  updatePassword: supabaseUpdatePassword
} = useSupabaseAuth()

// ============================================
// 功能开关：忘记密码功能
// ============================================
// TODO: 配置好 SMTP 后，将此值改为 true 以启用忘记密码功能
// 当前暂时禁用，避免触发 Supabase 邮件发送频率限制
const ENABLE_FORGOT_PASSWORD = false

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
      passwordPlaceholder: '至少10位，包含大小写字母、数字和符号',
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

async function oauth(provider: 'google' | 'github') {
  authError.value = ''

  try {
    loginLoading.value = true
    await signInWithOAuth(provider)

    // 登录成功
    authError.value = ''
    emitEvent('auth:logged-in', {})
    await onAuthSuccessNavigate()
  } catch (e: unknown) {
    console.error('[Auth] OAuth failed:', e)
    const errorMsg = (e as Error)?.message || 'OAuth 登录失败，请稍后重试'
    authError.value = errorMsg
    // Alert 组件已显示错误，不需要 Toast
  } finally {
    loginLoading.value = false
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
      hasSession: !!result.session
    })

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
    await new Promise(resolve => setTimeout(resolve, 300))
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
onMounted(() => {
  try {
    const u = new URL(window.location.href)
    const hash = u.hash.substring(1)
    const params = new URLSearchParams(hash)

    // 如果是邮箱验证回调
    if (params.has('access_token') && params.get('type') !== 'recovery') {
      // Supabase Auth 会自动从 URL hash 中提取 token 并设置 session
      // 等待 Supabase 处理 token，然后触发登录成功事件
      setTimeout(async () => {
        // 检查 session 是否已设置
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (session) {
          emitEvent('auth:logged-in', {})
          // 延迟跳转，让用户看到成功提示
          setTimeout(() => {
            onAuthSuccessNavigate()
          }, 2000)
        }
      }, 500)
    }
    // 如果是密码重置回调
    else if (params.get('type') === 'recovery' && params.has('access_token')) {
      // 密码重置逻辑已在 isResetMode 中处理
    }
  } catch (e) {
    console.error('[Auth] Failed to handle redirect:', e)
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

.auth-container--success {
  grid-template-columns: 1fr;
  max-width: 500px;
  min-height: auto;
  border-radius: var(--radius-lg);
  margin: var(--spacing-6) auto;
}

.auth-success-icon {
  font-size: 64px;
  text-align: center;
  margin-bottom: var(--spacing-md);
}

.auth-message {
  text-align: center;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-md);
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
  position: relative; /* 为绝对定位的 Alert 提供定位上下文 */
}

/* 错误提示 Alert - 绝对定位，不影响布局 */
.auth-error-alert {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - var(--spacing-md) * 2);
  max-width: 400px;
  z-index: 1000;
  margin: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
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

.auth-subtitle {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0 0 var(--spacing-lg) 0;
  line-height: 1.5;
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
