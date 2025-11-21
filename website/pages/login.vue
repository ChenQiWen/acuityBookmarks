<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-12"
  >
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">AcuityBookmarks</h1>
        <p class="text-slate-400">登录您的账户</p>
      </div>

      <!-- 登录表单 -->
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
            />
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
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <!-- 忘记密码链接 -->
          <div class="flex justify-end">
            <NuxtLink
              to="/reset-password"
              class="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              忘记密码？
            </NuxtLink>
          </div>

          <!-- 登录按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span v-if="!loading">登录</span>
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
              登录中...
            </span>
          </button>

          <!-- OAuth 登录 -->
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-slate-800/50 text-slate-400"
                >或使用以下方式登录</span
              >
            </div>
          </div>

          <button
            type="button"
            @click="handleGoogleLogin"
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
            使用 Google 登录
          </button>
        </form>

        <!-- 注册链接 -->
        <div class="mt-6 text-center text-sm text-slate-400">
          还没有账户？
          <NuxtLink
            to="/register"
            class="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            立即注册
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
import { ref } from 'vue'
import { AuthService, validateEmail } from '@acuity-bookmarks/auth-core'
import { createClient } from '@supabase/supabase-js'

// SEO 配置
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

// 表单状态
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

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

// 处理登录
const handleSubmit = async () => {
  error.value = ''

  // 验证邮箱
  const emailValidation = validateEmail(email.value)
  if (!emailValidation.valid) {
    error.value = emailValidation.message || '邮箱格式不正确'
    return
  }

  loading.value = true

  try {
    await authService.signIn({
      email: email.value,
      password: password.value
    })

    // 登录成功，跳转到下载页面
    await navigateTo('/download')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 处理 Google 登录
const handleGoogleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const { url } = await authService.getOAuthUrl('google', {
      redirectUrl: `${window.location.origin}/auth/callback`
    })

    // 重定向到 Google 授权页面
    window.location.href = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Google 登录失败'
    loading.value = false
  }
}
</script>
