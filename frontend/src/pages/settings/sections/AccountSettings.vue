<template>
  <Card>
    <template #header>
      <div class="title-row">
        <Icon name="icon-account-circle-outline" /> <span>账户</span>
      </div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">登录状态</div>
        <div class="field text-secondary">
          <template v-if="auth.loading">加载中...</template>
          <template v-else-if="!auth.token">未登录</template>
          <template v-else>
            <span>{{ auth.email || '已登录' }}</span>
            <span class="badge" :class="auth.tier === 'pro' ? 'pro' : 'free'">{{
              auth.tier.toUpperCase()
            }}</span>
          </template>
        </div>
      </div>
      <div v-if="section === 'main'" class="row">
        <template v-if="!auth.token">
          <div class="btn-row">
            <Button size="md" color="primary" @click="devLogin">
              <template #prepend><Icon name="icon-login" /></template>
              登录（开发用）
            </Button>
            <Button size="md" variant="ghost" @click="oauthLoginDev">
              <template #prepend><Icon name="icon-open-in-new" /></template>
              使用 OAuth（Dev）
            </Button>
            <Button
              size="md"
              variant="ghost"
              :disabled="!providers.google || !providers.googleHasSecret"
              :title="
                providers.google
                  ? providers.googleHasSecret
                    ? '使用 Google 登录'
                    : '后端缺少 Google Client Secret'
                  : '后端未配置 Google'
              "
              @click="oauthLoginProvider('google')"
            >
              <template #prepend><Icon name="icon-google" /></template>
              使用 Google 登录
            </Button>
            <Button
              size="md"
              variant="ghost"
              :disabled="!providers.github || !providers.githubHasSecret"
              :title="
                providers.github
                  ? providers.githubHasSecret
                    ? '使用 GitHub 登录'
                    : '后端缺少 GitHub Client Secret'
                  : '后端未配置 GitHub'
              "
              @click="oauthLoginProvider('github')"
            >
              <template #prepend><Icon name="icon-github" /></template>
              使用 GitHub 登录
            </Button>
          </div>
          <!-- 避免单独页面，这里不再引导打开新页面，可保留 OAuth 弹窗流程 -->
        </template>
        <template v-else>
          <div class="btn-row">
            <Button size="md" variant="ghost" @click="refreshMe">
              <template #prepend><Icon name="icon-refresh" /></template>
              刷新
            </Button>
            <Button size="md" variant="ghost" @click="goSecurity">
              <template #prepend
                ><Icon name="icon-shield-key-outline"
              /></template>
              修改密码
            </Button>
            <Button size="md" color="error" variant="outline" @click="logout">
              <template #prepend><Icon name="icon-logout-variant" /></template>
              退出
            </Button>
          </div>
        </template>
      </div>

      <!-- 安全：修改密码（同页路由切换） -->
      <div v-if="section === 'security'" class="security-box">
        <div class="row">
          <div class="label">安全设置</div>
          <div class="field">
            <div class="subtitle">修改密码</div>
            <div class="form-grid">
              <label class="form-label">当前密码</label>
              <input
                v-model="oldPwd"
                class="form-input"
                type="password"
                autocomplete="current-password"
                placeholder="当前密码"
              />
              <label class="form-label">新密码</label>
              <input
                v-model="newPwd"
                class="form-input"
                type="password"
                autocomplete="new-password"
                placeholder="至少10位，含大小写/数字/符号（满足其三）"
              />
              <label class="form-label">确认新密码</label>
              <input
                v-model="newPwd2"
                class="form-input"
                type="password"
                autocomplete="new-password"
                placeholder="再次输入新密码"
              />
            </div>
            <div
              v-if="msg"
              :class="msgType === 'error' ? 'msg-error' : 'msg-ok'"
            >
              {{ msg }}
            </div>
            <div class="btn-row">
              <Button size="sm" variant="text" @click="goMain">返回</Button>
              <Button
                size="sm"
                color="primary"
                :disabled="changing || !auth.token"
                @click="changePassword"
                >保存</Button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { Button, Card, Icon } from '@/components'
import { API_CONFIG } from '@/config/constants'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
import type { BasicOk, MeResponse } from '@/types/api'

type Tier = 'free' | 'pro'
const AUTH_TOKEN_KEY = 'auth.jwt'
const AUTH_REFRESH_KEY = 'auth.refresh'
const DEFAULT_TIMEOUT_MS = 20000

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

const providers = reactive<{
  google: boolean
  github: boolean
  dev: boolean
  googleHasSecret: boolean
  githubHasSecret: boolean
}>({
  google: true,
  github: true,
  dev: true,
  googleHasSecret: true,
  githubHasSecret: true
})

onMounted(async () => {
  const t = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
  if (t) auth.token = t
  await refreshMe()
  await probeProviders()
  initRoute()
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})

// === 简易同页路由：账户主视图 / 安全视图 ===
const section = ref<'main' | 'security'>('main')
function onHashChange() {
  try {
    const h = (window.location.hash || '').toLowerCase()
    if (h.includes('#/account/security')) section.value = 'security'
    else section.value = 'main'
  } catch {
    section.value = 'main'
  }
}
function initRoute() {
  onHashChange()
}
function goSecurity() {
  try {
    window.location.hash = '#/account/security'
  } catch {
    section.value = 'security'
  }
}
function goMain() {
  try {
    const url = new URL(window.location.href)
    if (url.hash && url.hash.startsWith('#/account/')) url.hash = '#/account'
    else url.hash = ''
    window.history.replaceState({}, '', url.toString())
  } catch {}
  section.value = 'main'
}

async function refreshMe() {
  try {
    auth.loading = true
    // 使用共享的 MeResponse 类型
    // 优先使用现有 token；为空则尝试从设置中获取
    if (!auth.token) {
      try {
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
      auth.tier = (data.tier === 'pro' ? 'pro' : 'free') as Tier
      auth.email = data.user?.email
      auth.expiresAt = Number(data.expiresAt || 0)
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

async function probeProviders() {
  try {
    const resp = await fetch(
      `${API_CONFIG.API_BASE}/api/auth/providers?t=${Date.now()}`
    )
    const data = await resp.json().catch(() => ({}))
    if (data && data.success && data.providers) {
      providers.google = !!data.providers.google
      providers.github = !!data.providers.github
      providers.dev = !!data.providers.dev
      providers.googleHasSecret = !!data.providers.googleHasSecret
      providers.githubHasSecret = !!data.providers.githubHasSecret
    }
  } catch {
    /* noop */
  }
}

async function devLogin() {
  const resp = await fetch(
    `${API_CONFIG.API_BASE}/api/auth/dev-login?t=${Date.now()}`
  )
  const data = await resp.json().catch(() => ({}))
  if (data && data.success && data.token) {
    auth.token = data.token
    await settingsAppService.saveSetting(
      AUTH_TOKEN_KEY,
      auth.token,
      'string',
      'JWT auth token'
    )
    await refreshMe()
  }
}

async function logout() {
  auth.token = null
  auth.email = undefined
  auth.tier = 'free'
  auth.expiresAt = 0
  await settingsAppService.deleteSetting(AUTH_TOKEN_KEY)
  await settingsAppService.deleteSetting(AUTH_REFRESH_KEY)
}

async function oauthLoginDev() {
  try {
    const apiBase = API_CONFIG.API_BASE
    // 扩展的 OAuth 重定向 URI（适配 WebAuthFlow）：固定格式 https://<extension-id>.chromiumapp.org/
    const redirectUri = chrome.identity.getRedirectURL('oauth2')
    const codeVerifier = await pkceCreateVerifier()
    const codeChallenge = await pkceChallengeS256(codeVerifier)
    const startResp = await fetch(
      `${apiBase}/api/auth/start?provider=dev&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(codeChallenge)}&t=${Date.now()}`
    )
    const startData = await startResp.json().catch(() => ({}))
    if (!(startData && startData.success && startData.authUrl)) return
    const authUrl = String(startData.authUrl)
    const resultUrl = await new Promise<string>((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          redirectedTo => {
            if (chrome.runtime.lastError)
              return reject(new Error(chrome.runtime.lastError.message))
            if (!redirectedTo) return reject(new Error('empty redirect'))
            resolve(redirectedTo)
          }
        )
      } catch (e) {
        reject(e as Error)
      }
    })
    const u = new URL(resultUrl)
    const code = u.searchParams.get('code')
    if (!code) return
    const cbResp = await fetch(
      `${apiBase}/api/auth/callback?provider=dev&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${encodeURIComponent(codeVerifier)}`
    )
    const cbData = await cbResp.json().catch(() => ({}))
    if (cbData && cbData.success && cbData.token) {
      auth.token = cbData.token
      await settingsAppService.saveSetting(
        AUTH_TOKEN_KEY,
        auth.token,
        'string',
        'JWT auth token'
      )
      await refreshMe()
    }
  } catch {
    // swallow errors, keep UI stable
  }
}

// === PKCE helpers ===
async function pkceCreateVerifier(): Promise<string> {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return base64url(bytes)
}
async function pkceChallengeS256(verifier: string): Promise<string> {
  const data = new globalThis.TextEncoder().encode(verifier)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return base64url(new Uint8Array(digest))
}
function base64url(bytes: Uint8Array): string {
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function oauthLoginProvider(provider: 'google' | 'github') {
  try {
    const apiBase = API_CONFIG.API_BASE
    const redirectUri = chrome.identity.getRedirectURL('oauth2')
    const codeVerifier = await pkceCreateVerifier()
    const codeChallenge = await pkceChallengeS256(codeVerifier)
    const startUrl = `${apiBase}/api/auth/start?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(codeChallenge)}&scope=&t=${Date.now()}`
    const startResp = await fetch(startUrl)
    const startData = await startResp.json().catch(() => ({}))
    if (!(startData && startData.success && startData.authUrl)) return
    const authUrl = String(startData.authUrl)
    const resultUrl = await new Promise<string>((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          redirectedTo => {
            if (chrome.runtime.lastError)
              return reject(new Error(chrome.runtime.lastError.message))
            if (!redirectedTo) return reject(new Error('empty redirect'))
            resolve(redirectedTo)
          }
        )
      } catch (e) {
        reject(e as Error)
      }
    })
    const u = new URL(resultUrl)
    const code = u.searchParams.get('code')
    if (!code) return
    const cbUrl = `${apiBase}/api/auth/callback?provider=${provider}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${encodeURIComponent(codeVerifier)}`
    const cbResp = await fetch(cbUrl)
    const cbData = await cbResp.json().catch(() => ({}))
    if (cbData && cbData.success && cbData.token) {
      auth.token = cbData.token
      await settingsAppService.saveSetting(
        AUTH_TOKEN_KEY,
        auth.token,
        'string',
        'JWT auth token'
      )
      await refreshMe()
    }
  } catch {
    /* noop */
  }
}

// === 修改密码 ===
const oldPwd = ref('')
const newPwd = ref('')
const newPwd2 = ref('')
const changing = ref(false)
const msg = ref('')
const msgType = ref<'ok' | 'error'>('ok')

async function changePassword() {
  msg.value = ''
  msgType.value = 'ok'
  if (!auth.token) {
    msg.value = '请先登录'
    msgType.value = 'error'
    return
  }
  if (!oldPwd.value || !newPwd.value || !newPwd2.value) {
    msg.value = '请完整填写表单'
    msgType.value = 'error'
    return
  }
  if (newPwd.value !== newPwd2.value) {
    msg.value = '两次新密码不一致'
    msgType.value = 'error'
    return
  }
  changing.value = true
  try {
    const data = await safeJsonFetch<BasicOk>(
      `${API_CONFIG.API_BASE}/api/auth/change-password`,
      DEFAULT_TIMEOUT_MS,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          oldPassword: oldPwd.value,
          newPassword: newPwd.value
        })
      }
    )
    if (!data || !data.success) throw new Error(data?.error || '修改失败')
    msg.value = '密码已更新'
    msgType.value = 'ok'
    oldPwd.value = ''
    newPwd.value = ''
    newPwd2.value = ''
  } catch (e: unknown) {
    msg.value = (e as Error)?.message || '修改失败'
    msgType.value = 'error'
  } finally {
    changing.value = false
  }
}

// ... (其他代码保持不变)
// ...（移除本地 safeJsonFetch，统一使用 utils/safe-json-fetch）
</script>
<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
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
.msg-error {
  margin-top: var(--spacing-sm);
  color: var(--color-on-error-container);
  background: var(--color-error-container);
  border: 1px solid var(--color-error);
  padding: var(--spacing-1-5) var(--spacing-sm);
  border-radius: var(--spacing-sm);
}
.msg-ok {
  margin-top: var(--spacing-sm);
  color: var(--color-on-success-container);
  background: var(--color-success-container);
  border: 1px solid var(--color-success);
  padding: var(--spacing-1-5) var(--spacing-sm);
  border-radius: var(--spacing-sm);
}
</style>
