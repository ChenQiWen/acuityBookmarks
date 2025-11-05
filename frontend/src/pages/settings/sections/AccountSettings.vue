<template>
  <div v-if="auth.token" class="settings-section">
    <h3 class="section-subtitle">
      <Icon name="icon-account" />
      <span>账户</span>
    </h3>
    <div class="grid">
      <!-- 用户头像 -->
      <div class="row">
        <div class="label">头像</div>
        <div class="field">
          <div class="avatar-container">
            <div class="avatar">
              {{ avatarInitial }}
            </div>
          </div>
        </div>
      </div>

      <!-- 账号/邮箱 -->
      <div class="row">
        <div class="label">账号</div>
        <div class="field">
          <span class="email">{{ auth.email || '未设置' }}</span>
        </div>
      </div>

      <!-- 昵称 -->
      <div class="row">
        <div class="label">昵称</div>
        <div class="field">
          <input
            v-model="nickname"
            class="form-input"
            type="text"
            placeholder="未设置昵称"
            @blur="saveNickname"
          />
        </div>
      </div>

      <!-- 会员等级 -->
      <div class="row">
        <div class="label">会员等级</div>
        <div class="field">
          <span class="badge" :class="auth.tier === 'pro' ? 'pro' : 'free'">{{
            auth.tier === 'pro' ? 'PRO' : 'FREE'
          }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="row">
        <div class="label"></div>
        <div class="field btn-row">
          <Button size="md" variant="ghost" @click="refreshMe">
            <template #prepend
              ><Icon name="icon-refresh" :spin="auth.loading"
            /></template>
            刷新
          </Button>
          <Button size="md" color="error" variant="outline" @click="logout">
            <template #prepend><Icon name="icon-logout-variant" /></template>
            退出登录
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  computed,
  defineOptions,
  onMounted,
  onUnmounted,
  reactive,
  ref
} from 'vue'

defineOptions({
  name: 'AccountSettings'
})
import { Button, Icon } from '@/components'
import { API_CONFIG } from '@/config/constants'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
import { emitEvent, onEvent } from '@/infrastructure/events/event-bus'
import type { MeResponse } from '@/types/api'

type Tier = 'free' | 'pro'
const AUTH_TOKEN_KEY = 'auth.jwt'
const AUTH_REFRESH_KEY = 'auth.refresh'
const NICKNAME_KEY = 'user.nickname'

const auth = reactive<{
  token: string | null
  email?: string
  tier: Tier
  expiresAt: number
  loading: boolean
}>({
  token: null,
  email: undefined,
  tier: 'free',
  expiresAt: 0,
  loading: true
})

const nickname = ref('')

// 头像首字母（从邮箱或昵称提取）
const avatarInitial = computed(() => {
  if (nickname.value) {
    return nickname.value.charAt(0).toUpperCase()
  }
  if (auth.email) {
    return auth.email.charAt(0).toUpperCase()
  }
  return '?'
})

onMounted(async () => {
  // ✅ 延迟一小段时间，确保从其他页面跳转过来时 IndexedDB 已同步
  await new Promise(resolve => setTimeout(resolve, 100))

  // ✅ 多次尝试读取 token，确保 IndexedDB 事务已提交
  let token: string | null = null
  for (let i = 0; i < 5; i++) {
    token = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
    if (token) {
      auth.token = token
      console.log('[AccountSettings] ✅ 成功读取 token，尝试次数:', i + 1)
      break
    }
    // 如果没读取到，等待一段时间后重试
    if (i < 4) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  if (!token) {
    console.log('[AccountSettings] ⚠️ 未读取到 token，可能未登录')
    return // 未登录时直接返回，不加载用户信息
  }

  // 加载用户信息
  await refreshMe()
  // 加载昵称
  const savedNickname =
    await settingsAppService.getSetting<string>(NICKNAME_KEY)
  if (savedNickname) {
    nickname.value = savedNickname
  }

  // 监听页面可见性变化，当从其他页面返回时刷新登录状态
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // ✅ 监听登录事件，实时更新状态
  const unsubscribeLogin = onEvent('auth:logged-in', async () => {
    console.log('[AccountSettings] 📢 收到 auth:logged-in 事件')
    // 延迟一小段时间，确保 IndexedDB 已同步
    await new Promise(resolve => setTimeout(resolve, 300))

    // ✅ 多次尝试读取 token，确保 IndexedDB 事务已提交
    let newToken: string | null = null
    for (let i = 0; i < 5; i++) {
      newToken = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
      if (newToken) {
        console.log(
          '[AccountSettings] ✅ 事件触发后成功读取 token，尝试次数:',
          i + 1
        )
        auth.token = newToken
        await refreshMe()
        // 加载昵称
        const savedNickname =
          await settingsAppService.getSetting<string>(NICKNAME_KEY)
        if (savedNickname) {
          nickname.value = savedNickname
        }
        return
      }
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!newToken) {
      console.warn('[AccountSettings] ⚠️ 事件触发后仍未读取到 token')
    }
  })

  const unsubscribeLogout = onEvent('auth:logged-out', () => {
    console.log('[AccountSettings] 📢 收到 auth:logged-out 事件')
    auth.token = null
    auth.email = undefined
    auth.tier = 'free'
    auth.expiresAt = 0
    nickname.value = ''
  })

  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    unsubscribeLogin()
    unsubscribeLogout()
  })
})

// 处理页面可见性变化
function handleVisibilityChange() {
  // 当页面从隐藏变为可见时，重新检查登录状态
  // 这可以捕获从注册页面返回的情况
  if (!document.hidden && auth.token) {
    refreshMe()
  }
}

// 保存昵称
async function saveNickname() {
  if (nickname.value.trim()) {
    await settingsAppService.saveSetting(
      NICKNAME_KEY,
      nickname.value.trim(),
      'string',
      '用户昵称'
    )
  } else {
    // 如果昵称为空，删除设置
    await settingsAppService.deleteSetting(NICKNAME_KEY)
  }
}

async function refreshMe() {
  try {
    auth.loading = true
    // 使用共享的 MeResponse 类型
    // 优先使用现有 token；为空则尝试从设置中获取
    if (!auth.token) {
      try {
        // 重新从 IndexedDB 读取 token（可能在其他页面刚保存）
        auth.token = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
      } catch {
        auth.token = null
      }
    }
    let data: MeResponse | null = null
    if (auth.token) {
      data = await safeJsonFetch<MeResponse>(
        `${API_CONFIG.API_BASE}/api/user/me?t=${Date.now()}`,
        {
          headers: { Authorization: `Bearer ${auth.token}` }
        }
      )
    }
    if (data && data.success) {
      const tierSource = data.user?.tier || 'free'
      auth.tier = (tierSource === 'pro' ? 'pro' : 'free') as Tier
      auth.email = data.user?.email
      auth.expiresAt = Number(data.user?.expiresAt || 0)
    } else {
      auth.tier = 'free'
      auth.email = undefined
      auth.expiresAt = 0
      auth.token = null
      await settingsAppService.deleteSetting(AUTH_TOKEN_KEY)
    }
  } finally {
    auth.loading = false
  }
}

async function logout() {
  // 清除所有认证信息
  auth.token = null
  auth.email = undefined
  auth.tier = 'free'
  auth.expiresAt = 0
  await settingsAppService.deleteSetting(AUTH_TOKEN_KEY)
  await settingsAppService.deleteSetting(AUTH_REFRESH_KEY)

  // 发送退出登录事件，通知其他组件更新状态
  emitEvent('auth:logged-out', {})

  // 跳转到登录页面
  try {
    const authUrl = chrome.runtime.getURL('auth.html')
    // 在扩展页面中，直接使用 window.location.href 导航最可靠
    window.location.href = authUrl
  } catch (e) {
    console.error('[AccountSettings] Failed to navigate to auth page:', e)
    // 降级方案：使用相对路径
    window.location.href = 'auth.html'
  }
}
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.label {
  width: 120px;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.text-secondary {
  color: var(--color-text-secondary);
}
.badge {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  margin-left: var(--spacing-sm);
}
.badge.pro {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}
.badge.free {
  background: var(--color-surface-variant);
  color: var(--color-text-secondary);
}
/* 安全子视图样式 */
.security-box {
  margin-top: 6px;
}
.subtitle {
  font-weight: 600;
  margin-bottom: 6px;
}
.form-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--spacing-sm);
  align-items: center;
  max-width: 560px;
}
.form-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.form-input {
  width: 100%;
  padding: var(--spacing-sm) 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: 10px;
  align-items: center;
}

.avatar-container {
  display: flex;
  align-items: center;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
}

.email {
  color: var(--color-text-primary);
  font-weight: 500;
}

.form-input {
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-sm) 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
  font-size: 14px;
}
</style>
