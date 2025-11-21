<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4"
  >
    <div class="text-center">
      <div v-if="error" class="space-y-4">
        <div class="text-red-400 text-6xl">✖</div>
        <h1 class="text-2xl font-bold text-white">登录失败</h1>
        <p class="text-slate-400">{{ error }}</p>
        <NuxtLink
          to="/auth"
          class="inline-block mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          返回登录
        </NuxtLink>
      </div>
      <div v-else class="space-y-4">
        <div
          class="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"
        ></div>
        <h1 class="text-2xl font-bold text-white">登录中...</h1>
        <p class="text-slate-400">正在处理您的登录请求</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AuthService } from '@acuity-bookmarks/auth-core'
import { createClient } from '@supabase/supabase-js'

const error = ref('')

// 初始化 Supabase 和 AuthService
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const authService = new AuthService(supabase)

onMounted(async () => {
  try {
    // 获取 URL hash 中的 tokens
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      throw new Error('未获取到授权信息')
    }

    // 设置会话
    await authService.setOAuthSession(accessToken, refreshToken)

    // 登录成功，跳转到下载页面
    await navigateTo('/download')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'OAuth 登录失败'
  }
})
</script>
