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
          <Avatar
            :src="avatarUrl"
            :text="avatarInitial"
            :size="64"
            variant="circle"
          />
        </div>
      </div>

      <!-- 账号/邮箱 -->
      <div class="row">
        <div class="label">账号</div>
        <div class="field">
          <div class="email-with-provider">
            <span class="email">{{ userEmail || '未设置' }}</span>
            <Badge
              v-if="loginProvider"
              :color="loginProviderColor"
              variant="filled"
              size="sm"
              class="provider-badge"
            >
              <span class="provider-icon-text">{{
                loginProviderIconText
              }}</span>
              {{ loginProviderName }}
            </Badge>
          </div>
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

      <!-- 多因素身份验证 (MFA) -->
      <div class="row">
        <div class="label">双重验证</div>
        <div class="field mfa-field">
          <div v-if="mfaLoading" class="mfa-loading">
            <Icon name="icon-refresh" :spin="true" />
            <span>加载中...</span>
          </div>
          <div v-else-if="mfaError" class="mfa-error">
            <Icon name="icon-error" color="error" />
            <span>{{ mfaError }}</span>
          </div>
          <div v-else class="mfa-content">
            <!-- MFA 状态显示 -->
            <div v-if="!isEnrollingMFA" class="mfa-status">
              <div class="mfa-status-info">
                <Badge
                  :color="isMFAEnabled ? 'success' : 'secondary'"
                  variant="filled"
                  size="sm"
                >
                  {{ isMFAEnabled ? '已启用' : '未启用' }}
                </Badge>
                <span class="mfa-description">
                  {{
                    isMFAEnabled
                      ? '双重验证已启用，登录时需要验证码'
                      : '双重验证未启用，建议启用以提升账户安全性'
                  }}
                </span>
              </div>
              <Button
                v-if="isMFAEnabled"
                size="sm"
                color="error"
                variant="outline"
                :loading="mfaDisabling"
                @click="handleDisableMFA"
              >
                禁用
              </Button>
              <Button
                v-else
                size="sm"
                color="primary"
                variant="outline"
                :loading="mfaLoading"
                @click="handleStartEnrollMFA"
              >
                启用
              </Button>
            </div>

            <!-- MFA 设置向导 -->
            <div v-else class="mfa-enroll-wizard">
              <div class="mfa-wizard-step">
                <h4 class="mfa-wizard-title">步骤 1：扫描二维码</h4>
                <p class="mfa-wizard-description">
                  使用 Google Authenticator、Authy 或其他验证器 App
                  扫描下方二维码
                </p>
                <div v-if="mfaQRCode" class="mfa-qr-code">
                  <img :src="mfaQRCode" alt="MFA QR Code" />
                </div>
                <div v-else class="mfa-qr-loading">
                  <Icon name="icon-refresh" :spin="true" />
                  <span>生成二维码中...</span>
                </div>
              </div>

              <div class="mfa-wizard-step">
                <h4 class="mfa-wizard-title">步骤 2：输入验证码</h4>
                <p class="mfa-wizard-description">
                  在验证器 App 中输入当前显示的 6 位验证码
                </p>
                <div class="mfa-verify-input">
                  <Input
                    v-model="mfaVerificationCode"
                    type="text"
                    placeholder="输入 6 位验证码"
                    :maxlength="6"
                    size="md"
                    :error="!!mfaError"
                    :error-message="mfaError || ''"
                    @keyup.enter="handleVerifyMFA"
                  />
                </div>
                <div class="mfa-wizard-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    @click="handleCancelEnrollMFA"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    :loading="mfaLoading"
                    :disabled="
                      !mfaVerificationCode || mfaVerificationCode.length !== 6
                    "
                    @click="handleVerifyMFA"
                  >
                    验证并启用
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="row">
        <div class="label"></div>
        <div class="field btn-row">
          <Button
            size="md"
            color="error"
            variant="outline"
            :loading="isLoggingOut"
            @click="logout"
          >
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
import { useSupabaseAuth, useSupabaseMFA } from '@/composables'
import { useSubscription } from '@/composables'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { emitEvent, onEvent } from '@/infrastructure/events/event-bus'
import { notificationService } from '@/application/notification/notification-service'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

const NICKNAME_KEY = 'user.nickname'

// 使用 Supabase Auth
const {
  user,
  session,
  signOut: supabaseSignOut,
  isAuthenticated
} = useSupabaseAuth()

// 使用订阅服务获取订阅状态
const { subscriptionStatus } = useSubscription()

// MFA 管理
const {
  loading: mfaLoading,
  error: mfaError,
  qrCode: mfaQRCode,
  verificationCode: mfaVerificationCode,
  isMFAEnabled,
  totpFactor,
  checkMFAStatus,
  startEnrollMFA,
  verifyAndEnableMFA,
  disableMFA
} = useSupabaseMFA()

// MFA 状态
const isEnrollingMFA = ref(false)
const mfaDisabling = ref(false)

const nickname = ref('')
const isEditingNickname = ref(false)
const editingNickname = ref('')
const originalNickname = ref('')
const nicknameInputRef = ref<InstanceType<typeof Input> | null>(null)
const isSavingNickname = ref(false)
const nicknameError = ref<string | null>(null)
const isLoggingOut = ref(false)

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

// 当前登录的 provider（从本地存储读取）
const storedLoginProvider = ref<string | null>(null)

// 登录方式（从 user_metadata 或本地存储获取）
const loginProvider = computed(() => {
  if (!user.value) {
    console.log('[AccountSettings] loginProvider computed: 用户未登录')
    return null
  }

  // 🔑 优先使用本地存储的 provider（最准确，因为是在登录时保存的）
  if (
    storedLoginProvider.value === 'google' ||
    storedLoginProvider.value === 'github'
  ) {
    console.log(
      '[AccountSettings] ✅ loginProvider computed: 使用本地存储的 provider:',
      storedLoginProvider.value
    )
    return storedLoginProvider.value
  }

  // 添加调试日志
  console.log(
    '[AccountSettings] ⚠️ loginProvider computed: 本地存储 provider 为空，回退到 Supabase metadata'
  )
  console.log('[AccountSettings] 用户信息:', {
    app_metadata: user.value.app_metadata,
    user_metadata: user.value.user_metadata,
    email: user.value.email,
    storedProvider: storedLoginProvider.value
  })

  // 优先使用 app_metadata.provider（当前登录方式）
  const appProvider = user.value.app_metadata?.provider
  const userMetadataProvider = user.value.user_metadata?.provider

  // 检查 providers 数组（可能包含多个登录方式）
  const providers = user.value.user_metadata?.providers || []

  console.log('[AccountSettings] Provider 信息:', {
    appProvider,
    userMetadataProvider,
    providers,
    storedProvider: storedLoginProvider.value
  })

  // 其次使用 app_metadata.provider（当前登录方式）
  if (appProvider === 'google' || appProvider === 'github') {
    console.log(
      '[AccountSettings] ⚠️ loginProvider computed: 使用 app_metadata.provider:',
      appProvider
    )
    return appProvider
  }

  // 如果没有 app_metadata.provider，使用 user_metadata.provider
  if (userMetadataProvider === 'google' || userMetadataProvider === 'github') {
    console.log(
      '[AccountSettings] ⚠️ loginProvider computed: 使用 user_metadata.provider:',
      userMetadataProvider
    )
    return userMetadataProvider
  }

  // 如果 providers 数组有值，返回最后一个（通常是最近登录的）
  if (providers.length > 0) {
    const lastProvider = providers[providers.length - 1]
    if (lastProvider === 'google' || lastProvider === 'github') {
      console.log(
        '[AccountSettings] ⚠️ loginProvider computed: 使用 providers 数组最后一个:',
        lastProvider
      )
      return lastProvider
    }
  }

  console.log(
    '[AccountSettings] ❌ loginProvider computed: 未找到有效的 provider'
  )
  return null
})

// 登录方式显示名称
const loginProviderName = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return 'Google'
  if (provider === 'github') return 'GitHub'
  if (provider === 'email') return '邮箱'
  return provider || '未知'
})

// 登录方式图标文本
const loginProviderIconText = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return 'G'
  if (provider === 'github') return '⚡' // 使用 GitHub 的 octocat 符号，或者用 'GH'
  if (provider === 'email') return '@'
  return '?'
})

// 登录方式颜色
const loginProviderColor = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return 'primary'
  if (provider === 'github') return 'secondary'
  if (provider === 'email') return 'info'
  return 'secondary'
})

// 订阅等级
const subscriptionTier = computed(() => {
  return subscriptionStatus.value?.tier || 'free'
})

// 头像 URL（从 user_metadata 获取）
const avatarUrl = computed(() => {
  if (!user.value) return undefined
  // 优先级：avatar_url > picture（Google 头像）
  return (
    user.value.user_metadata?.avatar_url ||
    user.value.user_metadata?.picture ||
    undefined
  )
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
  // 读取本地存储的 provider
  console.log('[AccountSettings] 🔍 开始读取本地存储的 provider...')
  try {
    const savedProvider = await modernStorage.getLocal<string>(
      'current_login_provider'
    )
    storedLoginProvider.value = savedProvider || null
    console.log('[AccountSettings] ✅ 从本地存储读取 provider:', {
      saved: savedProvider,
      stored: storedLoginProvider.value,
      isNull: storedLoginProvider.value === null
    })
  } catch (error) {
    console.error('[AccountSettings] ❌ 读取本地存储 provider 失败:', error)
  }

  if (!isAuthenticated.value) {
    console.log('[AccountSettings] ⚠️ 用户未登录')
    return
  }

  // 加载用户信息和订阅状态
  await refreshUserInfo()

  // 检查 MFA 状态
  try {
    await checkMFAStatus()
  } catch (error) {
    console.warn('[AccountSettings] ⚠️ 检查 MFA 状态失败:', error)
  }

  // 监听页面可见性变化，当从其他页面返回时刷新登录状态
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // ✅ 监听登录事件，实时更新状态
  const unsubscribeLogin = onEvent('auth:logged-in', async () => {
    console.log(
      '[AccountSettings] 📢 收到 auth:logged-in 事件，重新读取 provider...'
    )
    // 重新读取 provider（登录后可能更新）
    try {
      const savedProvider = await modernStorage.getLocal<string>(
        'current_login_provider'
      )
      console.log('[AccountSettings] 🔍 登录后读取 provider:', {
        saved: savedProvider,
        before: storedLoginProvider.value
      })
      storedLoginProvider.value = savedProvider || null
      console.log('[AccountSettings] ✅ 登录后更新 provider:', {
        after: storedLoginProvider.value,
        changed: storedLoginProvider.value !== savedProvider
      })
    } catch (error) {
      console.error('[AccountSettings] ❌ 读取本地存储 provider 失败:', error)
    }

    // 🔑 OAuth 登录后，等待用户信息同步（Google 的 user_metadata 可能需要一点时间）
    console.log('[AccountSettings] 🔄 等待用户信息同步...')
    await new Promise(resolve => setTimeout(resolve, 300))

    // 刷新用户信息（包括昵称和头像）
    await refreshUserInfo()

    // 🔑 如果第一次刷新后还没有昵称/头像，再等待并重试一次
    const currentUser = user.value
    if (
      currentUser &&
      !currentUser.user_metadata?.nickname &&
      !currentUser.user_metadata?.full_name &&
      !currentUser.user_metadata?.picture
    ) {
      console.log('[AccountSettings] ⚠️ 用户信息可能未完全同步，等待后重试...')
      await new Promise(resolve => setTimeout(resolve, 500))
      await refreshUserInfo()
    }
  })

  const unsubscribeLogout = onEvent('auth:logged-out', () => {
    console.log('[AccountSettings] 📢 收到 auth:logged-out 事件')
    nickname.value = ''
    storedLoginProvider.value = null // 清除 provider
    console.log('[AccountSettings] ✅ 已清除 provider')
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

    // 使用 Supabase 的 user_metadata 更新昵称
    // 同时更新 nickname、full_name 和 name，确保 Supabase Dashboard 也能显示
    if (user.value && isSupabaseConfigured()) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          nickname: trimmedNickname,
          full_name: trimmedNickname, // 更新 full_name，这样 Supabase Dashboard 的 Display name 会显示
          name: trimmedNickname // 更新 name，作为备用
        }
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
      } else {
        console.error('[AccountSettings] ❌ 更新昵称失败:', updateError)
        throw updateError
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
    // 🔑 OAuth 登录后，主动刷新用户信息，确保获取到完整的 user_metadata
    // 因为 OAuth 登录时，user_metadata 可能需要一点时间同步
    let currentUser = user.value
    try {
      const {
        data: { user: refreshedUser },
        error: refreshError
      } = await supabase.auth.getUser()
      if (!refreshError && refreshedUser) {
        // 使用刷新后的用户信息（包含最新的 user_metadata）
        currentUser = refreshedUser
        console.log('[AccountSettings] ✅ 已刷新用户信息', {
          hasFullName: !!refreshedUser.user_metadata?.full_name,
          hasPicture: !!refreshedUser.user_metadata?.picture,
          hasNickname: !!refreshedUser.user_metadata?.nickname
        })
      } else if (refreshError) {
        console.warn(
          '[AccountSettings] ⚠️ 刷新用户信息失败，使用当前 user:',
          refreshError
        )
      }
    } catch (refreshErr) {
      console.warn(
        '[AccountSettings] ⚠️ 刷新用户信息异常，使用当前 user:',
        refreshErr
      )
    }

    // 订阅状态由 useSubscription 的 watchEffect 自动加载，无需手动调用

    // 从 user_metadata 获取昵称
    // 优先级：nickname（手动设置） > full_name（Google 全名） > name（Google 名称） > 本地缓存
    let displayName = ''

    if (currentUser?.user_metadata?.nickname) {
      // 优先使用用户手动设置的昵称
      displayName = currentUser.user_metadata.nickname
    } else if (currentUser?.user_metadata?.full_name) {
      // 使用 Google 全名（Display name）
      displayName = currentUser.user_metadata.full_name
      // 自动保存为 nickname、full_name 和 name，确保 Supabase Dashboard 也能显示
      try {
        await supabase.auth.updateUser({
          data: {
            nickname: displayName,
            full_name: displayName,
            name: displayName
          }
        })
        console.log(
          '[AccountSettings] ✅ 已自动将 Google 全名设置为昵称:',
          displayName
        )
      } catch (error) {
        console.warn('[AccountSettings] ⚠️ 自动设置昵称失败:', error)
      }
    } else if (currentUser?.user_metadata?.name) {
      // 使用 Google 名称或其他 provider 的名称
      displayName = currentUser.user_metadata.name
      // 自动保存为 nickname、full_name 和 name
      try {
        await supabase.auth.updateUser({
          data: {
            nickname: displayName,
            full_name: displayName,
            name: displayName
          }
        })
        console.log('[AccountSettings] ✅ 已自动将名称设置为昵称:', displayName)
      } catch (error) {
        console.warn('[AccountSettings] ⚠️ 自动设置昵称失败:', error)
      }
    } else {
      // 尝试从本地存储读取（兼容旧数据）
      const savedNickname =
        await settingsAppService.getSetting<string>(NICKNAME_KEY)
      if (savedNickname) {
        displayName = savedNickname
      } else if (currentUser?.email) {
        // 🔑 如果都没有，从邮箱地址提取用户名作为默认昵称
        // 例如：impensmee74@hotmail.com -> impensmee74
        const emailPrefix = currentUser.email.split('@')[0]
        if (emailPrefix && emailPrefix.length > 0) {
          displayName = emailPrefix
          // 自动保存为 nickname，方便后续使用
          try {
            await supabase.auth.updateUser({
              data: {
                nickname: displayName,
                full_name: displayName,
                name: displayName
              }
            })
            console.log(
              '[AccountSettings] ✅ 已自动将邮箱用户名设置为昵称:',
              displayName
            )
          } catch (error) {
            console.warn('[AccountSettings] ⚠️ 自动设置昵称失败:', error)
          }
        }
      }
    }

    nickname.value = displayName

    // 如果有昵称，同步到本地存储（作为缓存）
    if (displayName) {
      await settingsAppService.saveSetting(
        NICKNAME_KEY,
        displayName,
        'string',
        '用户昵称'
      )
    }
  } catch (error) {
    console.error('[AccountSettings] ❌ 刷新用户信息失败:', error)
  }
}

/**
 * MFA 管理函数
 */

// 开始启用 MFA
async function handleStartEnrollMFA() {
  try {
    isEnrollingMFA.value = true
    await startEnrollMFA()
    await notificationService.notify('请扫描二维码并输入验证码', {
      level: 'info'
    })
  } catch (error) {
    console.error('[AccountSettings] ❌ 开始启用 MFA 失败:', error)
    await notificationService.notify(
      error instanceof Error ? error.message : '启用 MFA 失败',
      { level: 'error' }
    )
    isEnrollingMFA.value = false
  }
}

// 取消启用 MFA
function handleCancelEnrollMFA() {
  isEnrollingMFA.value = false
  mfaVerificationCode.value = ''
}

// 验证并启用 MFA
async function handleVerifyMFA() {
  if (!mfaVerificationCode.value || mfaVerificationCode.value.length !== 6) {
    await notificationService.notify('请输入 6 位验证码', {
      level: 'warning'
    })
    return
  }

  try {
    const success = await verifyAndEnableMFA(mfaVerificationCode.value)
    if (success) {
      isEnrollingMFA.value = false
      await notificationService.notify('✅ 双重验证已启用', {
        level: 'success'
      })
    }
  } catch (error) {
    console.error('[AccountSettings] ❌ 验证 MFA 失败:', error)
    await notificationService.notify(
      error instanceof Error ? error.message : '验证码错误，请重试',
      { level: 'error' }
    )
  }
}

// 禁用 MFA
async function handleDisableMFA() {
  if (!totpFactor.value) {
    await notificationService.notify('未找到 MFA 因子', {
      level: 'warning'
    })
    return
  }

  // 确认操作
  const confirmed = confirm('确定要禁用双重验证吗？禁用后账户安全性会降低。')
  if (!confirmed) {
    return
  }

  try {
    mfaDisabling.value = true
    await disableMFA(totpFactor.value.id)
    await notificationService.notify('双重验证已禁用', {
      level: 'success'
    })
  } catch (error) {
    console.error('[AccountSettings] ❌ 禁用 MFA 失败:', error)
    await notificationService.notify(
      error instanceof Error ? error.message : '禁用 MFA 失败',
      { level: 'error' }
    )
  } finally {
    mfaDisabling.value = false
  }
}

async function logout() {
  if (isLoggingOut.value) return // 防止重复点击

  try {
    isLoggingOut.value = true

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
    isLoggingOut.value = false
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
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
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
  margin-bottom: 6px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  align-items: center;
  gap: var(--spacing-sm);
  grid-template-columns: 140px 1fr;
  max-width: 560px;
}

.form-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.form-input {
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-sm) 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: 10px;
}

.email {
  font-weight: 500;
  color: var(--color-text-primary);
}

.email-with-provider {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.provider-icon-text {
  margin-right: 2px;
  font-size: 12px;
  font-weight: 600;
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
  flex-shrink: 0;
  margin-top: var(--spacing-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.edit-icon:hover {
  color: var(--color-primary);
}

/* MFA 管理样式 */
.mfa-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.mfa-loading,
.mfa-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--spacing-sm);
}

.mfa-error {
  color: var(--color-error);
  background-color: var(--color-error-bg, rgb(239 68 68 / 10%));
}

.mfa-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.mfa-status {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
}

.mfa-status-info {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 200px;
}

.mfa-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.mfa-enroll-wizard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  border-radius: var(--spacing-md);
  background-color: var(--color-bg-subtle, rgb(0 0 0 / 2%));
}

.mfa-wizard-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.mfa-wizard-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.mfa-wizard-description {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.mfa-qr-code {
  display: flex;
  justify-content: center;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
  background-color: var(--color-bg, #fff);
}

.mfa-qr-code img {
  max-width: 200px;
  height: auto;
}

.mfa-qr-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  color: var(--color-text-secondary);
}

.mfa-verify-input {
  max-width: 200px;
}

.mfa-wizard-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>
