<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-12"
  >
    <div class="max-w-md w-full">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">AcuityBookmarks</h1>
        <p class="text-slate-400">重置您的密码</p>
      </div>

      <!-- 重置密码表单 -->
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
            />
            <p class="mt-2 text-sm text-slate-400">
              我们将向您的邮箱发送重置密码链接
            </p>
          </div>

          <!-- 发送按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span v-if="!loading">发送重置链接</span>
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
              发送中...
            </span>
          </button>
        </form>

        <!-- 返回登录链接 -->
        <div class="mt-6 text-center text-sm text-slate-400">
          记起密码了？
          <NuxtLink
            to="/auth"
            class="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            返回登录
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
  title: '重置密码',
  description: '重置您的 AcuityBookmarks 账户密码'
})

useSeoMeta({
  title: '重置密码 - AcuityBookmarks',
  description: '重置您的 AcuityBookmarks 账户密码',
  ogTitle: '重置密码 - AcuityBookmarks',
  ogDescription: '重置您的 AcuityBookmarks 账户密码'
})

// 表单状态
const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

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

// 处理发送重置邮件
const handleSubmit = async () => {
  error.value = ''
  success.value = ''

  // 验证邮箱
  const emailValidation = validateEmail(email.value)
  if (!emailValidation.valid) {
    error.value = emailValidation.message || '邮箱格式不正确'
    return
  }

  loading.value = true

  try {
    await authService.resetPassword({
      email: email.value,
      redirectUrl: `${window.location.origin}/auth/update-password`
    })

    success.value = '重置密码链接已发送到您的邮箱，请查收'
    email.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
