<template>
  <Dropdown
    placement="bottom-end"
    offset="sm"
    :close-on-content-click="false"
    class="user-menu"
  >
    <template #trigger>
      <button
        class="user-menu__trigger"
        :title="isLoggedIn ? '账号管理' : '登录 / 注册'"
        :aria-label="isLoggedIn ? '账号管理' : '登录 / 注册'"
      >
        <Avatar
          v-if="isLoggedIn"
          :src="avatarUrl"
          :text="avatarInitial"
          :size="32"
          variant="circle"
          class="user-menu__avatar"
        />
        <Icon v-else name="icon-login" :size="30" class="user-menu__icon" />
      </button>
    </template>

    <!-- 已登录菜单 -->
    <div v-if="isLoggedIn" class="user-menu__panel">
      <!-- 用户信息头部 -->
      <div class="user-menu__header">
        <Avatar
          :src="avatarUrl"
          :text="avatarInitial"
          :size="40"
          variant="circle"
        />
        <div class="user-menu__info">
          <span class="user-menu__name">{{ displayName }}</span>
          <span class="user-menu__email">{{ userEmail }}</span>
        </div>
        <Badge
          :color="isPro ? 'primary' : 'secondary'"
          variant="filled"
          size="sm"
          class="user-menu__plan-badge"
        >
          {{ isPro ? 'PRO' : 'FREE' }}
        </Badge>
      </div>

      <Divider />

      <!-- 操作列表 -->
      <div class="user-menu__actions">
        <button class="user-menu__item" @click="handleOpenAccount">
          <Icon name="icon-account" :size="16" />
          <span>账户中心</span>
        </button>
        <button class="user-menu__item" @click="handleOpenSubscription">
          <Icon name="icon-crown" :size="16" />
          <span>{{ isPro ? '管理订阅' : '升级到 PRO' }}</span>
        </button>
      </div>

      <Divider />

      <div class="user-menu__actions">
        <button class="user-menu__item user-menu__item--danger" :disabled="isLoggingOut" @click="handleLogout">
          <Icon name="icon-logout-variant" :size="16" />
          <span>{{ isLoggingOut ? '退出中...' : '退出登录' }}</span>
        </button>
      </div>
    </div>

    <!-- 未登录菜单 -->
    <div v-else class="user-menu__panel user-menu__panel--guest">
      <div class="user-menu__guest-header">
        <Icon name="icon-account" :size="32" class="user-menu__guest-icon" />
        <p class="user-menu__guest-title">登录后解锁更多功能</p>
      </div>
      <div class="user-menu__actions">
        <button class="user-menu__item user-menu__item--primary" @click="handleLogin">
          <Icon name="icon-login" :size="16" />
          <span>登录 / 注册</span>
        </button>
      </div>
    </div>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Dropdown from '@/components/base/Dropdown/Dropdown.vue'
import Avatar from '@/components/base/Avatar/Avatar.vue'
import Badge from '@/components/base/Badge/Badge.vue'
import Icon from '@/components/base/Icon/Icon.vue'
import Divider from '@/components/base/Divider/Divider.vue'
import { useSupabaseAuth } from '@/composables'
import { useSubscription } from '@/composables'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({ name: 'UserMenu' })

const { user, isAuthenticated, signOut } = useSupabaseAuth()
const { isPro } = useSubscription()

const isLoggedIn = computed(() => isAuthenticated.value)
const isLoggingOut = ref(false)

/** 用户邮箱 */
const userEmail = computed(() => user.value?.email ?? '')

/** 显示名称：full_name > name > 邮箱前缀 */
const displayName = computed(() => {
  if (!user.value) return ''
  const meta = user.value.user_metadata
  return (
    meta?.full_name ||
    meta?.name ||
    user.value.email?.split('@')[0] ||
    ''
  )
})

/** 头像 URL */
const avatarUrl = computed(() => {
  if (!user.value) return undefined
  const meta = user.value.user_metadata
  return meta?.avatar_url || meta?.picture || meta?.avatar || meta?.photo || undefined
})

/** 头像首字母 */
const avatarInitial = computed(() => {
  if (displayName.value) return displayName.value.charAt(0).toUpperCase()
  if (userEmail.value) return userEmail.value.charAt(0).toUpperCase()
  return '?'
})

/** 打开账户中心 */
async function handleOpenAccount() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('account.html')
      : '/account.html'
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('UserMenu', '打开账户中心失败', error)
  }
}

/** 打开订阅页 */
async function handleOpenSubscription() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('subscription.html')
      : '/subscription.html'
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('UserMenu', '打开订阅页失败', error)
  }
}

/** 登录 */
async function handleLogin() {
  try {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('auth.html')
      : '/auth.html'
    if (chrome?.tabs?.create) {
      await chrome.tabs.create({ url })
    } else {
      window.open(url, '_blank')
    }
  } catch (error) {
    logger.error('UserMenu', '打开登录页失败', error)
  }
}

/** 退出登录 */
async function handleLogout() {
  if (isLoggingOut.value) return
  try {
    isLoggingOut.value = true
    await signOut()
    emitEvent('auth:logged-out', {})
  } catch (error) {
    logger.error('UserMenu', '退出登录失败', error)
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<style scoped>
.user-menu__trigger {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-1);
  border: none;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.user-menu__trigger:hover .user-menu__avatar {
  opacity: 0.85;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}

.user-menu__trigger:hover .user-menu__icon {
  color: var(--color-text-primary);
}

/* 面板 */
.user-menu__panel {
  min-width: 240px;
  padding: var(--spacing-2) 0;
}

.user-menu__panel--guest {
  padding: var(--spacing-4);
}

/* 已登录头部 */
.user-menu__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
}

.user-menu__info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-1);
  min-width: 0;
}

.user-menu__name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu__email {
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 操作列表 */
.user-menu__actions {
  padding: var(--spacing-1) var(--spacing-2);
}

.user-menu__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  text-align: left;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.user-menu__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-menu__item:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.user-menu__item--danger {
  color: var(--md-sys-color-error);
}

.user-menu__item--primary {
  font-weight: var(--font-medium);
  color: var(--md-sys-color-primary);
}

/* 未登录状态 */
.user-menu__guest-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-3);
  text-align: center;
}

.user-menu__guest-icon {
  color: var(--color-text-secondary);
}

.user-menu__guest-title {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
