<template>
  <div class="auth-page">
    <Card>
      <template #header>
        <div class="title-row"><Icon name="mdi-lock-outline" /> <span>登录 / 注册</span></div>
      </template>
      <div class="content">
        <div v-if="authError" class="error-banner">{{ authError }}</div>

        <!-- 重置密码模式 -->
        <div v-if="isResetMode" class="form-box">
          <div class="form-title">重置密码</div>
          <label class="label">新密码</label>
          <input class="input" type="password" v-model="resetPassword" placeholder="至少10位，包含大小写/数字/符号" autocomplete="new-password" />
          <div class="row">
            <Button color="primary" :disabled="resetLoading" @click="doResetPassword()">重置密码</Button>
          </div>
        </div>

        <template v-else>
          <p class="hint">选择一种方式继续：</p>
          <div class="actions">
            <Button color="primary" @click="oauth('google')">使用 Google 登录</Button>
            <Button variant="outline" style="margin-left:8px" @click="oauth('github')">使用 GitHub 登录</Button>
            <Button variant="text" style="margin-left:8px" @click="oauth('dev')">开发者登录</Button>
          </div>
          <div class="or">或使用邮箱：</div>
          <div class="forms">
          <div class="form-box">
            <div class="form-title">登录</div>
            <label class="label">邮箱</label>
            <input class="input" type="email" v-model.trim="loginEmail" placeholder="you@example.com" autocomplete="email" />
            <label class="label">密码</label>
            <input class="input" type="password" v-model="loginPassword" placeholder="••••••••••" autocomplete="current-password" />
            <div class="row">
              <Button color="primary" :disabled="loginLoading" @click="login()">登录</Button>
              <Button variant="text" :disabled="loginLoading" @click="forgot()">忘记密码？</Button>
            </div>
          </div>

          <div class="form-box">
            <div class="form-title">注册</div>
            <label class="label">邮箱</label>
            <input class="input" type="email" v-model.trim="regEmail" placeholder="you@example.com" autocomplete="email" />
            <label class="label">密码</label>
            <input class="input" type="password" v-model="regPassword" placeholder="至少10位，包含大小写/数字/符号" autocomplete="new-password" />
            <div class="row">
              <Button variant="outline" :disabled="regLoading" @click="register()">创建账户</Button>
            </div>
          </div>
          </div>
          <div class="fineprint">登录/注册即表示你同意我们的服务条款与隐私政策。</div>
        </template>
      </div>
    </Card>
  </div>
</template>
<script setup lang="ts">
import { shallowRef, ref } from 'vue'
import { Button, Card, Icon } from '../components/ui'
import { unifiedBookmarkAPI } from '../utils/unified-bookmark-api'
import { API_CONFIG } from '../config/constants'
import { saveAuthTokens } from '../utils/auth-gate'

const AUTH_TOKEN_KEY = 'auth.jwt'
const authError = shallowRef<string>('')
const DEFAULT_TIMEOUT_MS = 20000
const loginEmail = ref('')
const loginPassword = ref('')
const regEmail = ref('')
const regPassword = ref('')
const loginLoading = ref(false)
const regLoading = ref(false)

async function oauth(provider: 'google'|'github'|'dev') {
  try {
  const apiBase = API_CONFIG.API_BASE
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

async function safeJsonFetch(url: string, timeoutMs: number, init?: any) {
  const AC: any = (globalThis as any).AbortController
  const ctrl: any = AC ? new AC() : { abort: () => {}, signal: undefined }
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  try {
    const resp = await fetch(url, { ...(init || {}), signal: ctrl.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  try { return await resp.json() } catch (_error) { throw new Error('Invalid JSON response') }
  } finally {
    clearTimeout(t)
  }
}

async function login() {
  authError.value = ''
  if (!loginEmail.value || !loginPassword.value) {
    authError.value = '请输入邮箱和密码'
    return
  }
  loginLoading.value = true
  try {
  const apiBase = API_CONFIG.API_BASE
    const data = await safeJsonFetch(`${apiBase}/api/auth/login`, DEFAULT_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value })
    })
    if (!data || !data.success) throw new Error(data?.error || '登录失败')
    if (data.access_token) await saveAuthTokens(String(data.access_token), data.refresh_token ? String(data.refresh_token) : null)
    await onAuthSuccessNavigate()
  } catch (e: any) {
    authError.value = e?.message || '登录失败，请稍后重试'
  } finally {
    loginLoading.value = false
  }
}

async function register() {
  authError.value = ''
  if (!regEmail.value || !regPassword.value) {
    authError.value = '请输入邮箱和密码'
    return
  }
  regLoading.value = true
  try {
  const apiBase = API_CONFIG.API_BASE
    const data = await safeJsonFetch(`${apiBase}/api/auth/register`, DEFAULT_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail.value, password: regPassword.value })
    })
    if (!data || !data.success) throw new Error(data?.error || '注册失败')
    // 注册成功后直接登录
    const loginData = await safeJsonFetch(`${apiBase}/api/auth/login`, DEFAULT_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail.value, password: regPassword.value })
    })
    if (loginData && loginData.success && loginData.access_token) {
      await saveAuthTokens(String(loginData.access_token), loginData.refresh_token ? String(loginData.refresh_token) : null)
    }
    await onAuthSuccessNavigate()
  } catch (e: any) {
    authError.value = e?.message || '注册失败，请稍后重试'
  } finally {
    regLoading.value = false
  }
}

async function forgot() {
  authError.value = ''
  if (!loginEmail.value) {
    authError.value = '请输入邮箱以找回密码'
    return
  }
  try {
  const apiBase = API_CONFIG.API_BASE
    await safeJsonFetch(`${apiBase}/api/auth/forgot-password`, DEFAULT_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value })
    }).catch(() => ({}))
    authError.value = '如果邮箱存在，我们已发送重置邮件（本地开发为生成一次性令牌）'
  } catch (e: any) {
    authError.value = e?.message || '请求失败，请稍后重试'
  }
}

// === 重置密码（通过 URL ?reset_token=xxx 触发） ===
const resetToken = ref<string>('')
const resetPassword = ref<string>('')
const resetLoading = ref(false)
const isResetMode = (() => {
  try {
    const u = new URL(window.location.href)
    const tok = u.searchParams.get('reset_token')
    if (tok) { resetToken.value = tok; return true }
  } catch {}
  return false
})()

async function doResetPassword() {
  authError.value = ''
  if (!resetToken.value || !resetPassword.value) {
    authError.value = '重置令牌或新密码缺失'
    return
  }
  resetLoading.value = true
  try {
  const apiBase = API_CONFIG.API_BASE
    const data = await safeJsonFetch(`${apiBase}/api/auth/reset-password`, DEFAULT_TIMEOUT_MS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_token: resetToken.value, new_password: resetPassword.value })
    })
    if (!data || !data.success) throw new Error(data?.error || '重置失败')
    authError.value = '密码已重置，请使用新密码登录'
  } catch (e: any) {
    authError.value = e?.message || '重置失败，请稍后重试'
  } finally {
    resetLoading.value = false
  }
}

async function onAuthSuccessNavigate() {
  authError.value = ''
  try {
    const params = new window.URLSearchParams(window.location.search)
    const ret = params.get('return') || 'settings.html?tab=account'
    const url = ret.startsWith('http') ? ret : chrome.runtime.getURL(ret)
    try { await chrome.tabs.create({ url }) } catch {}
    try { window.close() } catch {}
  } catch {}
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
.or{margin:12px 0;color:var(--color-text-tertiary);text-align:center}
.forms{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
.form-box{border:1px solid var(--color-border);border-radius:10px;padding:12px;background:#fff}
.form-title{font-weight:600;margin-bottom:8px}
.label{font-size:12px;color:var(--color-text-secondary);margin-top:8px}
.input{width:100%;padding:8px 10px;border:1px solid var(--color-border);border-radius:8px;margin-top:4px}
.row{display:flex;gap:8px;align-items:center;margin-top:10px}
.fineprint{color:var(--color-text-tertiary);font-size:12px;margin-top:12px}
.actions{display:flex;align-items:center}
.error-banner{background:#fde8e8;color:#b91c1c;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:12px}
@media (max-width: 760px){
  .forms{grid-template-columns:1fr}
}
</style>
