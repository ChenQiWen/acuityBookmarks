<template>
  <Card>
    <template #header>
      <div class="title-row"><Icon name="mdi-account-circle-outline" /> <span>账户</span></div>
    </template>
    <div class="grid">
      <div class="row">
        <div class="label">登录状态</div>
        <div class="field text-secondary">
          <template v-if="auth.loading">加载中...</template>
          <template v-else-if="!auth.token">未登录</template>
          <template v-else>
            <span>{{ auth.email || '已登录' }}</span>
            <span class="badge" :class="auth.tier === 'pro' ? 'pro' : 'free'">{{ auth.tier.toUpperCase() }}</span>
          </template>
        </div>
      </div>
      <div class="row">
        <template v-if="!auth.token">
          <Button size="sm" color="primary" @click="devLogin">登录（开发用）</Button>
          <Button size="sm" variant="outline" @click="oauthLoginDev" style="margin-left:8px">使用 OAuth（Dev）</Button>
          <Button size="sm" variant="outline" @click="oauthLoginProvider('google')" style="margin-left:8px">使用 Google 登录</Button>
          <Button size="sm" variant="outline" @click="oauthLoginProvider('github')" style="margin-left:8px">使用 GitHub 登录</Button>
          <Button size="sm" variant="text" style="margin-left:8px" @click="openAuthPage">在新页面打开</Button>
        </template>
        <template v-else>
          <Button size="sm" @click="refreshMe">刷新</Button>
          <Button size="sm" color="danger" variant="outline" @click="logout">退出</Button>
        </template>
      </div>
    </div>
  </Card>
</template>
<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { Button, Card, Icon } from '../../components/ui'
import { unifiedBookmarkAPI } from '../../utils/unified-bookmark-api'

type Tier = 'free' | 'pro'
const AUTH_TOKEN_KEY = 'auth.jwt'

const auth = reactive<{ token: string | null; email?: string; tier: Tier; expiresAt: number; loading: boolean }>({
  token: null,
  email: undefined,
  tier: 'free',
  expiresAt: 0,
  loading: true
})

onMounted(async () => {
  const t = await unifiedBookmarkAPI.getSetting<string>(AUTH_TOKEN_KEY)
  if (t) auth.token = t
  await refreshMe()
})

async function refreshMe() {
  try {
    auth.loading = true
    const apiBase = (import.meta as any).env.VITE_API_BASE_URL || (import.meta as any).env.VITE_CLOUDFLARE_WORKER_URL || 'http://localhost:3000'
    const resp = await fetch(`${apiBase}/api/user/me`, { headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined })
    const data = await resp.json().catch(() => ({}))
    if (data && data.success && data.tier) {
      auth.tier = (data.tier === 'pro' ? 'pro' : 'free') as Tier
      auth.email = data.user?.email
      auth.expiresAt = data.expiresAt || 0
    } else {
      auth.tier = 'free'
      auth.email = undefined
      auth.expiresAt = 0
      auth.token = null
      await unifiedBookmarkAPI.deleteSetting(AUTH_TOKEN_KEY)
    }
  } finally {
    auth.loading = false
  }
}

async function devLogin() {
  const apiBase = (import.meta as any).env.VITE_API_BASE_URL || (import.meta as any).env.VITE_CLOUDFLARE_WORKER_URL || 'http://localhost:3000'
  const resp = await fetch(`${apiBase}/api/auth/dev-login?t=${Date.now()}`)
  const data = await resp.json().catch(() => ({}))
  if (data && data.success && data.token) {
    auth.token = data.token
    await unifiedBookmarkAPI.saveSetting(AUTH_TOKEN_KEY, auth.token, 'string', 'JWT auth token')
    await refreshMe()
  }
}

async function logout() {
  auth.token = null
  auth.email = undefined
  auth.tier = 'free'
  auth.expiresAt = 0
  await unifiedBookmarkAPI.deleteSetting(AUTH_TOKEN_KEY)
}

async function oauthLoginDev() {
  try {
    const apiBase = (import.meta as any).env.VITE_API_BASE_URL || (import.meta as any).env.VITE_CLOUDFLARE_WORKER_URL || 'http://localhost:3000'
    // 扩展的 OAuth 重定向 URI（适配 WebAuthFlow）：固定格式 https://<extension-id>.chromiumapp.org/
    const redirectUri = chrome.identity.getRedirectURL('oauth2')
    const codeVerifier = await pkceCreateVerifier()
    const codeChallenge = await pkceChallengeS256(codeVerifier)
    const startResp = await fetch(`${apiBase}/api/auth/start?provider=dev&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(codeChallenge)}&t=${Date.now()}`)
    const startData = await startResp.json().catch(() => ({}))
    if (!(startData && startData.success && startData.authUrl)) return
    const authUrl = String(startData.authUrl)
    const resultUrl = await new Promise<string>((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
          if (!redirectedTo) return reject(new Error('empty redirect'))
          resolve(redirectedTo)
        })
      } catch (e) { reject(e as Error) }
    })
    const u = new URL(resultUrl)
    const code = u.searchParams.get('code')
    if (!code) return
  const cbResp = await fetch(`${apiBase}/api/auth/callback?provider=dev&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${encodeURIComponent(codeVerifier)}`)
    const cbData = await cbResp.json().catch(() => ({}))
    if (cbData && cbData.success && cbData.token) {
      auth.token = cbData.token
      await unifiedBookmarkAPI.saveSetting(AUTH_TOKEN_KEY, auth.token, 'string', 'JWT auth token')
      await refreshMe()
    }
  } catch (e) {
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

async function oauthLoginProvider(provider: 'google'|'github') {
  try {
    const apiBase = (import.meta as any).env.VITE_API_BASE_URL || (import.meta as any).env.VITE_CLOUDFLARE_WORKER_URL || 'http://localhost:3000'
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
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
          if (!redirectedTo) return reject(new Error('empty redirect'))
          resolve(redirectedTo)
        })
      } catch (e) { reject(e as Error) }
    })
    const u = new URL(resultUrl)
    const code = u.searchParams.get('code')
    if (!code) return
    const cbUrl = `${apiBase}/api/auth/callback?provider=${provider}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_verifier=${encodeURIComponent(codeVerifier)}`
    const cbResp = await fetch(cbUrl)
    const cbData = await cbResp.json().catch(() => ({}))
    if (cbData && cbData.success && cbData.token) {
      auth.token = cbData.token
      await unifiedBookmarkAPI.saveSetting(AUTH_TOKEN_KEY, auth.token, 'string', 'JWT auth token')
      await refreshMe()
    }
  } catch (_e) { /* noop */ }
}

function openAuthPage() {
  try {
    const ret = 'settings.html?tab=account'
    const url = chrome?.runtime?.getURL ? chrome.runtime.getURL(`auth.html?return=${encodeURIComponent(ret)}`) : `/auth.html?return=${encodeURIComponent(ret)}`
    window.open(url, '_blank')
  } catch {
    window.open(`/auth.html?return=${encodeURIComponent('settings.html?tab=account')}`, '_blank')
  }
}
</script>
<style scoped>
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.grid{display:flex;flex-direction:column;gap:10px}
.label{width:120px;color:var(--color-text-secondary)}
.row{display:flex;align-items:center;gap:12px}
.text-secondary{color:var(--color-text-secondary)}
.badge{padding:2px 6px;border-radius:10px;font-size:12px;margin-left:8px}
.badge.pro{background:var(--color-primary);color:#fff}
.badge.free{background:#e3e3e3;color:#333}
</style>