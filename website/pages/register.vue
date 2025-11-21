<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-12"
  >
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">AcuityBookmarks</h1>
        <p class="text-slate-400">创建您的账户</p>
      </div>

      <!-- 注册表单 -->
      <div
        class="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-slate-700/50"
      >
        <!-- 错误提示 -->
        <div
          v-if="error"
          class="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg"
        >
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- 成功提示 -->
        <div
          v-if="success"
          class="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg"
        >
          <p class="text-green-400 text-sm">{{ success }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- 邮箱输入 -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-slate-300 mb-2"
            >
              邮箱地址
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="your@email.com"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              :class="{ 'border-red-500': emailError }"
            />
            <p v-if="emailError" class="mt-2 text-sm text-red-400">
              {{ emailError }}
            </p>
          </div>

          <!-- 密码输入 -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-slate-300 mb-2"
            >
              密码
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="new-password"
              placeholder="至少8位，包含字母和数字"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              :class="{ 'border-red-500': passwordError }"
            />
            <p v-if="passwordError" class="mt-2 text-sm text-red-400">
              {{ passwordError }}
            </p>
            <p v-else class="mt-2 text-sm text-slate-500">
              至少8位，包含字母和数字
            </p>
          </div>

          <!-- 确认密码 -->
          <div>
            <label
              for="confirmPassword"
              class="block text-sm font-medium text-slate-300 mb-2"
            >
              确认密码
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              placeholder="再次输入密码"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              :class="{ 'border-red-500': confirmPasswordError }"
            />
            <p v-if="confirmPasswordError" class="mt-2 text-sm text-red-400">
              {{ confirmPasswordError }}
            </p>
          </div>

          <!-- 注册按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span v-if="!loading">注册</span>
            <span v-else class="flex items-center gap-2">
              <svg
                class="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              注册中...
            </span>
          </button>

          <!-- OAuth 注册 -->
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-slate-800/50 text-slate-400"
                >或使用以下方式注册</span
              >
            </div>
          </div>

          <button
            type="button"
            @click="handleGoogleRegister"
            :disabled="loading"
            class="w-full py-3 px-4 bg-white hover:bg-slate-100 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 font-semibold rounded-lg transition-all flex items-center justify-center gap-3"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            使用 Google 注册
          </button>
        </form>

        <!-- 登录链接 -->
        <div class="mt-6 text-center text-sm text-slate-400">
          已有账户？
          <NuxtLink
            to="/login"
            class="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            立即登录
          </NuxtLink>
        </div>
      </div>

      <!-- 返回首页 -->
      <div class="mt-8 text-center">
        <NuxtLink
          to="/"
          class="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-2"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          返回首页
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  AuthService,
  validateEmail,
  validatePassword
} from '@acuity-bookmarks/auth-core'
import { createClient } from '@supabase/supabase-js'

// SEO 配置
definePageMeta({
  title: '注册',
  description: '创建您的 AcuityBookmarks 账户'
})

useSeoMeta({
  title: '注册 - AcuityBookmarks',
  description: '创建您的 AcuityBookmarks 账户，开始高效管理您的书签',
  ogTitle: '注册 - AcuityBookmarks',
  ogDescription: '创建您的 AcuityBookmarks 账户，开始高效管理您的书签'
})

// 表单状态
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

// 表单验证错误
const emailError = computed(() => {
  if (!email.value) return ''
  const validation = validateEmail(email.value)
  return validation.valid ? '' : validation.message || ''
})

const passwordError = computed(() => {
  if (!password.value) return ''
  const validation = validatePassword(password.value)
  return validation.valid ? '' : validation.message || ''
})

const confirmPasswordError = computed(() => {
  if (!confirmPassword.value) return ''
  if (password.value !== confirmPassword.value) {
    return '两次输入的密码不一致'
  }
  return ''
})

// 初始化 Supabase 和 AuthService
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  error.value = 'Supabase 配置缺失，请联系管理员'
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const authService = new AuthService(supabase)

// 处理注册
const handleSubmit = async () => {
  error.value = ''
  success.value = ''

  // 验证所有字段
  if (emailError.value || passwordError.value || confirmPasswordError.value) {
    error.value = '请检查输入信息'
    return
  }

  loading.value = true

  try {
    await authService.signUp({
      email: email.value,
      password: password.value
    })

    // 注册成功
    success.value = '注册成功！正在跳转...'

    // 延迟跳转，让用户看到成功消息
    setTimeout(async () => {
      await navigateTo('/download')
    }, 1500)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 处理 Google 注册
const handleGoogleRegister = async () => {
  loading.value = true
  error.value = ''

  try {
    const { url } = await authService.getOAuthUrl('google', {
      redirectUrl: `${window.location.origin}/auth/callback`
    })

    // 重定向到 Google 授权页面
    window.location.href = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Google 注册失败'
    loading.value = false
  }
}
</script>
