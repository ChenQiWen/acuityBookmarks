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
          <Avatar :text="avatarInitial" :size="64" variant="circle" />
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
        <div class="field nickname-field-wrapper">
          <div class="nickname-field">
            <Input
              ref="nicknameInputRef"
              v-model="editingNickname"
              :readonly="!isEditingNickname"
              :borderless="!isEditingNickname"
              :error="!!nicknameError"
              :error-message="nicknameError || ''"
              variant="outlined"
              type="text"
              :placeholder="nickname || '未设置昵称'"
              size="md"
              @input="handleNicknameInput"
              @blur="handleNicknameBlur"
            />
            <Icon
              v-if="!isEditingNickname"
              name="icon-edit"
              class="edit-icon"
              @click="startEditNickname"
            />
          </div>
        </div>
      </div>

      <!-- 会员等级 -->
      <div class="row">
        <div class="label">会员等级</div>
        <div class="field">
          <Badge
            :color="auth.tier === 'pro' ? 'primary' : 'secondary'"
            variant="filled"
            size="sm"
          >
            {{ auth.tier === 'pro' ? 'PRO' : 'FREE' }}
          </Badge>
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
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from 'vue'

defineOptions({
  name: 'AccountSettings'
})
import { Avatar, Badge, Button, Icon, Input } from '@/components'
import { API_CONFIG } from '@/config/constants'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
import { emitEvent, onEvent } from '@/infrastructure/events/event-bus'
import { notificationService } from '@/application/notification/notification-service'
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
const isEditingNickname = ref(false)
const editingNickname = ref('')
const originalNickname = ref('')
const nicknameInputRef = ref<InstanceType<typeof Input> | null>(null)
const isSavingNickname = ref(false)
const nicknameError = ref<string | null>(null)

// 同步编辑昵称与显示昵称
watch(
  nickname,
  newVal => {
    if (!isEditingNickname.value) {
      editingNickname.value = newVal || ''
    }
  },
  { immediate: true }
)

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

  // 加载用户信息（包括昵称）
  await refreshMe()

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

// 开始编辑昵称
function startEditNickname() {
  isEditingNickname.value = true
  editingNickname.value = nickname.value || ''
  originalNickname.value = nickname.value || ''
  nicknameError.value = null // 清除之前的错误
  // 聚焦输入框
  nextTick(() => {
    // Input 组件内部有 input 元素，通过 DOM 查询获取
    const wrapper = nicknameInputRef.value?.$el as HTMLElement | undefined
    const inputElement = wrapper?.querySelector(
      'input'
    ) as HTMLInputElement | null
    if (inputElement) {
      inputElement.focus()
      inputElement.select()
    }
  })
}

// 处理输入框输入（清除错误信息）
function handleNicknameInput() {
  // 用户开始输入时清除错误信息
  if (nicknameError.value) {
    nicknameError.value = null
  }
}

// 处理输入框失去焦点
async function handleNicknameBlur() {
  await performSaveNickname()
}

/**
 * 验证昵称
 *
 * 校验规则：
 * 1. 不能为空
 * 2. 长度：2-20 个字符
 * 3. 不能为纯数字
 * 4. 不能包含连续空格
 * 5. 不能包含控制字符和不可见字符
 * 6. 不能以特殊符号开头或结尾
 *
 * @param nickname - 要验证的昵称
 * @returns 验证结果，如果通过返回 null，否则返回错误消息
 */
function validateNickname(nickname: string): string | null {
  const trimmed = nickname.trim()

  // 1. 空值检查
  if (trimmed.length === 0) {
    return '昵称不能为空'
  }

  // 2. 最小长度检查（至少2个字符）
  if (trimmed.length < 2) {
    return '昵称至少需要 2 个字符'
  }

  // 3. 最大长度检查（最多20个字符）
  if (trimmed.length > 20) {
    return '昵称长度不能超过 20 个字符'
  }

  // 4. 纯数字检查（避免与账号ID混淆）
  if (/^\d+$/.test(trimmed)) {
    return '昵称不能为纯数字'
  }

  // 5. 连续空格检查（禁止多个连续空格）
  if (/\s{2,}/.test(trimmed)) {
    return '昵称不能包含连续空格'
  }

  // 6. 特殊控制字符检查
  // 允许：中文、英文、数字、常见标点符号（_-.·等）、emoji
  // 禁止：控制字符（\x00-\x1F）、删除字符（\x7F）、零宽字符（\u200B-\u200D\uFEFF）等
  const invalidCharPattern = /[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/
  if (invalidCharPattern.test(trimmed)) {
    return '昵称包含不允许的字符，请移除特殊字符后重试'
  }

  // 7. 首尾字符检查（不能以特殊符号开头或结尾）
  // 允许的符号在中间使用，但不能作为首尾字符
  const startEndPattern = /^[_\-.·]|[_\-.·]$/
  if (startEndPattern.test(trimmed)) {
    return '昵称不能以下划线、连字符或点号开头或结尾'
  }

  return null
}

// 执行保存昵称
async function performSaveNickname() {
  if (isSavingNickname.value) {
    return
  }

  if (!auth.token) {
    console.warn('[AccountSettings] 未登录，无法保存昵称')
    isEditingNickname.value = false
    return
  }

  const trimmedNickname = editingNickname.value.trim()

  // 清除之前的错误
  nicknameError.value = null

  // 如果没有变化，直接退出编辑模式并同步显示值
  if (trimmedNickname === originalNickname.value) {
    editingNickname.value = nickname.value || ''
    isEditingNickname.value = false
    return
  }

  // 验证昵称
  const validationError = validateNickname(trimmedNickname)
  if (validationError) {
    nicknameError.value = validationError
    // 验证失败时保持编辑模式，让用户修改
    return
  }

  try {
    isSavingNickname.value = true

    // 调用后端接口保存昵称
    const response = await safeJsonFetch<{
      success: boolean
      nickname: string
    }>(`${API_CONFIG.API_BASE}/api/user/nickname`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({ nickname: trimmedNickname })
    })

    if (response && response.success) {
      console.log('[AccountSettings] ✅ 昵称保存成功:', response.nickname)
      nickname.value = trimmedNickname
      originalNickname.value = trimmedNickname
      nicknameError.value = null // 清除错误信息
      // 同时保存到本地存储（作为缓存）
      await settingsAppService.saveSetting(
        NICKNAME_KEY,
        trimmedNickname,
        'string',
        '用户昵称'
      )
      await notificationService.notifySuccess('昵称保存成功', '保存成功')
      isEditingNickname.value = false // 退出编辑模式
    } else {
      console.error('[AccountSettings] ❌ 昵称保存失败')
      nicknameError.value = '昵称保存失败，请稍后重试'
      // 保持编辑模式，让用户重试
    }
  } catch (error) {
    console.error('[AccountSettings] ❌ 保存昵称时出错:', error)
    const errorMessage =
      error instanceof Error ? error.message : '保存昵称时出错，请稍后重试'
    nicknameError.value = errorMessage
    // 保持编辑模式，让用户重试
  } finally {
    isSavingNickname.value = false
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
      // 从后端获取昵称
      if (data.user?.nickname) {
        nickname.value = data.user.nickname
        // 同步到本地存储（作为缓存）
        await settingsAppService.saveSetting(
          NICKNAME_KEY,
          data.user.nickname,
          'string',
          '用户昵称'
        )
      } else {
        // 如果没有昵称，尝试从本地存储读取（兼容旧数据）
        const savedNickname =
          await settingsAppService.getSetting<string>(NICKNAME_KEY)
        if (savedNickname) {
          nickname.value = savedNickname
        }
      }
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

.email {
  color: var(--color-text-primary);
  font-weight: 500;
}

.nickname-field-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.nickname-field {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.nickname-field :deep(.acuity-input-wrapper) {
  flex: 1;
  max-width: 400px;
}

/* borderless 模式下的样式调整 */
.nickname-field :deep(.acuity-input-container--borderless) {
  background: transparent;
}

.nickname-field :deep(.acuity-input-container--borderless .acuity-input) {
  font-weight: 500;
  cursor: default;
}

.nickname-field
  :deep(.acuity-input-container--borderless .acuity-input[readonly]) {
  cursor: default;
  user-select: none;
}

.edit-icon {
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 0.2s;
  flex-shrink: 0;
  margin-top: var(--spacing-xs);
}

.edit-icon:hover {
  color: var(--color-primary);
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
