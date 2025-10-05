<template>
  <div class="auth-page">
    <Card>
      <template #header>
        <div class="title-row"><Icon name="mdi-lock-outline" /> <span>登录 / 注册</span></div>
      </template>
      <div class="content">
        <div v-if="authError" class="error-banner">{{ authError }}</div>
        <p class="hint">选择一种方式继续：</p>
        <div class="actions">
          <Button color="primary" @click="oauth('google')">使用 Google 登录</Button>
          <Button variant="outline" style="margin-left:8px" @click="oauth('github')">使用 GitHub 登录</Button>
          <Button variant="text" style="margin-left:8px" @click="oauth('dev')">开发者登录</Button>
        </div>
        <p class="fineprint">
          登录即表示你同意我们的服务条款与隐私政策。
        </p>
      </div>
    </Card>
  </div>
</template>
<script setup lang="ts">
import { shallowRef } from 'vue'
import { Button, Card, Icon } from '../components/ui'
import { unifiedBookmarkAPI } from '../utils/unified-bookmark-api'

const AUTH_TOKEN_KEY = 'auth.jwt'
const authError = shallowRef<string>('')
const DEFAULT_TIMEOUT_MS = 20000

async function oauth(provider: 'google'|'github'|'dev') {
  try {
    const apiBase = (import.meta as any).env.VITE_API_BASE_URL || (import.meta as any).env.VITE_CLOUDFLARE_WORKER_URL || 'http://localhost:3000'
    const redirectUri = chrome.identity.getRedirectURL('oauth2')
    const codeVerifier = await pkceCreateVerifier()
    const codeChallenge = await pkceChallengeS256(codeVerifier)
    // Build start URL safely
    const start = new URL('/api/auth/start', apiBase)
    start.searchParams.append('provider', provider)
    start.searchParams.append('redirect_uri', redirectUri)
    start.searchParams.append('code_challenge', codeChallenge)
    start.searchParams.append('scope', '')
    start.searchParams.append('t', String(Date.now()))

    const startData = await safeJsonFetch(start.toString(), DEFAULT_TIMEOUT_MS)
    if (!(startData && startData.success && startData.authUrl)) throw new Error('Auth start failed')
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
    if (!code) throw new Error('No code returned from provider')
    // Build callback URL safely
    const cb = new URL('/api/auth/callback', apiBase)
    cb.searchParams.append('provider', provider)
    cb.searchParams.append('code', code)
    cb.searchParams.append('redirect_uri', redirectUri)
    cb.searchParams.append('code_verifier', codeVerifier)
    const cbData = await safeJsonFetch(cb.toString(), DEFAULT_TIMEOUT_MS)
    if (cbData && cbData.success && cbData.token) {
      authError.value = ''
      await unifiedBookmarkAPI.saveSetting(AUTH_TOKEN_KEY, cbData.token, 'string', 'JWT auth token')
      // 回跳：默认回到 settings 账户分栏
  const params = new window.URLSearchParams(window.location.search)
      const ret = params.get('return') || 'settings.html?tab=account'
      const url = ret.startsWith('http') ? ret : chrome.runtime.getURL(ret)
      // 在扩展里打开并关闭当前页
      try { await chrome.tabs.create({ url }) } catch {}
      try { window.close() } catch {}
    }
  } catch (e: any) {
    console.error('[Auth] oauth failed:', e)
    authError.value = e?.message ? `登录失败：${e.message}` : '登录失败，请稍后重试'
    try {
      // 简易可见反馈（扩展可选）
      chrome?.notifications?.create?.({ type: 'basic', iconUrl: 'icon128.png', title: 'AcuityBookmarks', message: authError.value })
    } catch {}
  }
}

async function safeJsonFetch(url: string, timeoutMs: number) {
  const AC: any = (globalThis as any).AbortController
  const ctrl: any = AC ? new AC() : { abort: () => {}, signal: undefined }
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  try {
    const resp = await fetch(url, { signal: ctrl.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  try { return await resp.json() } catch (_error) { throw new Error('Invalid JSON response') }
  } finally {
    clearTimeout(t)
  }
}

// PKCE helpers
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
</script>
<style scoped>
.auth-page{display:flex;justify-content:center;padding:24px}
.title-row{display:flex;align-items:center;gap:6px;font-weight:600}
.hint{color:var(--color-text-secondary);margin:8px 0}
.fineprint{color:var(--color-text-tertiary);font-size:12px;margin-top:12px}
.actions{display:flex;align-items:center}
.error-banner{background:#fde8e8;color:#b91c1c;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:12px}
</style>
