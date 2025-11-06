<template>
  <div v-if="isAuthenticated" class="settings-section">
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
          <span class="email">{{ userEmail || '未设置' }}</span>
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
            :color="subscriptionTier === 'pro' ? 'primary' : 'secondary'"
            variant="filled"
            size="sm"
          >
            {{ subscriptionTier === 'pro' ? 'PRO' : 'FREE' }}
          </Badge>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="row">
        <div class="label"></div>
        <div class="field btn-row">
          <Button size="md" variant="ghost" @click="refreshUserInfo">
            <template #prepend
              ><Icon name="icon-refresh" :spin="loading"
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
  ref,
  watch
} from 'vue'

defineOptions({
  name: 'AccountSettings'
})
import { Avatar, Badge, Button, Icon, Input } from '@/components'
import { useSupabaseAuth } from '@/composables'
import { useSubscription } from '@/composables'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { emitEvent, onEvent } from '@/infrastructure/events/event-bus'
import { notificationService } from '@/application/notification/notification-service'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'

const NICKNAME_KEY = 'user.nickname'

// 使用 Supabase Auth
const {
  user,
  session,
  signOut: supabaseSignOut,
  isAuthenticated,
  loading: authLoading
} = useSupabaseAuth()

// 使用订阅服务获取订阅状态
const { subscriptionStatus, loadSubscription } = useSubscription()

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

// 用户邮箱
const userEmail = computed(() => {
  return user.value?.email || ''
})

// 订阅等级
const subscriptionTier = computed(() => {
  return subscriptionStatus.value?.tier || 'free'
})

// 加载状态
const loading = computed(() => {
  return authLoading.value
})

// 头像首字母（从邮箱或昵称提取）
const avatarInitial = computed(() => {
  if (nickname.value) {
    return nickname.value.charAt(0).toUpperCase()
  }
  if (userEmail.value) {
    return userEmail.value.charAt(0).toUpperCase()
  }
  return '?'
})

onMounted(async () => {
  if (!isAuthenticated.value) {
    console.log('[AccountSettings] ⚠️ 用户未登录')
    return
  }

  // 加载用户信息和订阅状态
  await refreshUserInfo()

  // 监听页面可见性变化，当从其他页面返回时刷新登录状态
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // ✅ 监听登录事件，实时更新状态
  const unsubscribeLogin = onEvent('auth:logged-in', async () => {
    console.log('[AccountSettings] 📢 收到 auth:logged-in 事件')
    await refreshUserInfo()
  })

  const unsubscribeLogout = onEvent('auth:logged-out', () => {
    console.log('[AccountSettings] 📢 收到 auth:logged-out 事件')
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
  if (!document.hidden && isAuthenticated.value) {
    refreshUserInfo()
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

  const currentSession = session.value
  if (!currentSession?.access_token) {
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

    // 方式1：尝试使用 Supabase 直接更新用户资料（如果后端支持）
    if (user.value && isSupabaseConfigured()) {
      // 先尝试通过 Supabase 的 user_metadata 更新（临时方案）
      // 理想情况下应该通过后端 API 更新 user_profiles 表
      const { error: updateError } = await supabase.auth.updateUser({
        data: { nickname: trimmedNickname }
      })

      if (!updateError) {
        console.log('[AccountSettings] ✅ 昵称保存成功:', trimmedNickname)
        nickname.value = trimmedNickname
        originalNickname.value = trimmedNickname
        nicknameError.value = null
        // 同时保存到本地存储（作为缓存）
        await settingsAppService.saveSetting(
          NICKNAME_KEY,
          trimmedNickname,
          'string',
          '用户昵称'
        )
        await notificationService.notifySuccess('昵称保存成功', '保存成功')
        isEditingNickname.value = false
        return
      }
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

/**
 * 刷新用户信息
 * 从 Supabase 和订阅服务获取最新信息
 */
async function refreshUserInfo() {
  if (!isAuthenticated.value || !user.value || !session.value) {
    console.log('[AccountSettings] ⚠️ 用户未登录，无法刷新信息')
    return
  }

  try {
    // 加载订阅状态
    await loadSubscription()

    // 从 Supabase 获取用户资料（包括昵称）
    let profile = null
    if (isSupabaseConfigured()) {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('nickname')
        .eq('id', user.value.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 表示没有找到记录，这是正常的（新用户）
        console.warn('[AccountSettings] 获取用户资料失败:', profileError)
      } else {
        profile = data
      }
    }

    // 设置昵称（优先使用数据库中的，否则使用 user_metadata，最后使用本地缓存）
    if (profile?.nickname) {
      nickname.value = profile.nickname
      // 同步到本地存储（作为缓存）
      await settingsAppService.saveSetting(
        NICKNAME_KEY,
        profile.nickname,
        'string',
        '用户昵称'
      )
    } else if (user.value.user_metadata?.nickname) {
      nickname.value = user.value.user_metadata.nickname
      await settingsAppService.saveSetting(
        NICKNAME_KEY,
        user.value.user_metadata.nickname,
        'string',
        '用户昵称'
      )
    } else {
      // 尝试从本地存储读取（兼容旧数据）
      const savedNickname =
        await settingsAppService.getSetting<string>(NICKNAME_KEY)
      if (savedNickname) {
        nickname.value = savedNickname
      } else {
        nickname.value = ''
      }
    }
  } catch (error) {
    console.error('[AccountSettings] ❌ 刷新用户信息失败:', error)
  }
}

async function logout() {
  try {
    // 使用 Supabase 登出
    await supabaseSignOut()

    // 清除本地缓存的昵称
    await settingsAppService.deleteSetting(NICKNAME_KEY)

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
  } catch (error) {
    console.error('[AccountSettings] ❌ 登出失败:', error)
    // 即使登出失败，也尝试跳转到登录页面
    try {
      window.location.href = chrome.runtime.getURL('auth.html')
    } catch (e) {
      console.error('[AccountSettings] Failed to navigate to auth page:', e)
    }
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
