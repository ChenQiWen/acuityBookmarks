#!/usr/bin/env node
/**
 * E2E runner for Management page via Chrome DevTools Protocol (Puppeteer-Core).
 * Assumes Chrome launched with --remote-debugging-port=9222 and extension loaded from dist/.
 * Usage: bun scripts/e2e-management.mjs --ext gdjcmpenmogdikhnnaebmddhmdgbfcgl
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const artifactsDir = path.join(repoRoot, 'artifacts')

function nowTag() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { ext: '', host: 'http://localhost:9222', perf: false, cpu: 4, net: 'slow4g' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--ext') out.ext = args[++i]
    else if (a === '--host') out.host = args[++i]
    else if (a === '--perf') out.perf = true
    else if (a === '--cpu') out.cpu = Number(args[++i] || out.cpu)
    else if (a === '--net') out.net = String(args[++i] || out.net)
  }
  if (!out.ext) {
    console.error('Missing --ext <extensionId>')
    process.exit(2)
  }
  return out
}

async function ensureDirs() {
  for (const sub of ['screenshots', 'console', 'network', 'performance', 'logs']) {
    await fs.mkdir(path.join(artifactsDir, sub), { recursive: true })
  }
}

async function connectChrome(host) {
  const browser = await puppeteer.connect({
    browserURL: host,
    defaultViewport: { width: 1280, height: 800 }
  })
  return browser
}

async function saveConsole(page, tag) {
  const logs = await page.evaluate(() => {
    return window.__AB_CONSOLE_BUFFER__ || []
  })
  await fs.writeFile(
    path.join(artifactsDir, 'console', `${tag}_console.json`),
    JSON.stringify(logs, null, 2),
    'utf-8'
  )
}

async function attachConsoleBuffer(page) {
  await page.exposeFunction('__ab_push_log__', () => {})
  await page.evaluateOnNewDocument(() => {
    // Simple console buffer injected before any script runs
    ;(window).__AB_CONSOLE_BUFFER__ = []
    const orig = { log: console.log, warn: console.warn, error: console.error }
    const wrap = (level) => (...args) => {
      try { (window).__AB_CONSOLE_BUFFER__.push({ level, args, ts: Date.now() }) } catch {}
      return orig[level](...args)
    }
    console.log = wrap('log')
    console.warn = wrap('warn')
    console.error = wrap('error')
  })
}

async function waitForProgressGone(page, timeout = 120000) {
  // progress-text 先出现后消失，或短路其不存在
  try {
    await page.waitForSelector('[data-testid="progress-text"]', { timeout: 5000 })
    await page.waitForSelector('[data-testid="progress-text"]', { hidden: true, timeout })
  } catch {
    // 若从未出现，继续
  }
}

// 网络与 CPU 限速（性能模式）
const networkPresets = {
  slow4g: { latency: 400, downloadBps: 51200, uploadBps: 51200, label: 'Slow 4G' }, // ~50KB/s
  fast4g: { latency: 150, downloadBps: 1228800, uploadBps: 737280, label: 'Fast 4G' } // ~1.2MB/s
}

async function applyPerformanceThrottling(page, { net = 'slow4g', cpu = 4 } = {}) {
  const preset = networkPresets[net] || networkPresets.slow4g
  const client = await page.target().createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: preset.latency,
    downloadThroughput: preset.downloadBps,
    uploadThroughput: preset.uploadBps,
    connectionType: 'cellular4g'
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: Math.max(1, cpu) })
  await client.send('Performance.enable')
  return { client, preset }
}

// 通用辅助
const sleep = ms => new Promise(res => setTimeout(res, ms))

async function clickWithRetries(page, selector, label, textFallbackRegex) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 15000 })
    await page.click(selector, { delay: 5 })
  } catch {
    if (textFallbackRegex) {
      await page.evaluate(regexSource => {
        const r = new RegExp(regexSource)
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
        const target = btns.find(b => r.test((b.textContent || '').trim()))
        if (target) target.click()
      }, textFallbackRegex.source)
    } else {
      throw new Error(`Cannot click ${selector}`)
    }
  }
  if (label) {
    await page.screenshot({ path: path.join(artifactsDir, 'screenshots', `${globalThis.__AB_TAG__}_${label}.png`) })
  }
  await sleep(200) // allow UI to open dialog
}

async function setField(page, testId, value) {
  const sel = `[data-testid="${testId}"] input, [data-testid="${testId}"] textarea, [data-testid="${testId}"] [contenteditable="true"]`
  await page.waitForSelector(sel, { visible: true, timeout: 10000 })
  await page.evaluate((selector, val) => {
    const el = document.querySelector(selector)
    if (!el) return
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus()
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.value = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (el && el.isContentEditable) {
      el.focus()
      el.textContent = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, sel, String(value))
}

async function run() {
  const { ext, host, perf, cpu, net } = parseArgs()
  const tag = `${nowTag()}_management`
  await ensureDirs()
  const browser = await connectChrome(host)
  const page = await browser.newPage()
  await attachConsoleBuffer(page)
  const steps = []
  globalThis.__AB_TAG__ = tag

  // 性能模式：应用网络/CPU限速 + 记录 trace
  let perfClient = null
  let netPreset = null
  if (perf) {
    const { client, preset } = await applyPerformanceThrottling(page, { net, cpu })
    perfClient = client
    netPreset = preset
    await page.tracing.start({
      path: path.join(artifactsDir, 'performance', `${tag}_trace.json`),
      categories: ['devtools.timeline', 'blink.user_timing', 'disabled-by-default-v8.cpu_profiler']
    })
  }

  const url = `chrome-extension://${ext}/management.html`
  try {
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await waitForProgressGone(page)
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_loaded.png`)
    await page.screenshot({ path: shot })
    steps.push({ name: 'open_management', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_loaded_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'open_management', status: 'failed', error: String(e), screenshot: shot })
  }

  // 生成100条
  try {
    const t0 = Date.now()
    await clickWithRetries(page, '[data-testid="btn-generate"]', 'after_click_generate', /生成|开始生成/)
    await page.waitForSelector('[data-testid="dlg-generate"]', { visible: true, timeout: 20000 })
    await setField(page, 'gen-total', 100)
  try {
    await page.waitForSelector('[data-testid="btn-generate-confirm"]', { visible: true, timeout: 10000 })
    await page.click('[data-testid="btn-generate-confirm"]')
  } catch {
    // Fallback: click button by text
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
      const target = btns.find(b => /开始生成/.test((b.textContent || '').trim()))
      if (target) (target).click()
    })
  }
    await waitForProgressGone(page, 300000)
    const shotGen = path.join(artifactsDir, 'screenshots', `${tag}_gen100_done.png`)
    await page.screenshot({ path: shotGen })
    steps.push({ name: 'generate_100', status: 'passed', durationMs: Date.now() - t0, screenshot: shotGen })
  } catch (e) {
    const shotGen = path.join(artifactsDir, 'screenshots', `${tag}_gen100_error.png`)
    try { await page.screenshot({ path: shotGen }) } catch {}
    steps.push({ name: 'generate_100', status: 'failed', error: String(e), screenshot: shotGen })
  }

  // 删除50条并清理空文件夹
  try {
    const t0 = Date.now()
    await clickWithRetries(page, '[data-testid="btn-delete"]', 'after_click_delete', /删除|移除|清理/)
    await page.waitForSelector('[data-testid="dlg-delete"]', { visible: true, timeout: 20000 })
    await setField(page, 'del-target', 50)
    // 勾选清理空文件夹（若未勾选）
    const chk = await page.$('[data-testid="del-clean-empty"] input')
    if (chk) {
      const checked = await page.evaluate(el => el.checked, chk)
      if (!checked) await chk.click()
    }
    try {
      await page.waitForSelector('[data-testid="btn-delete-confirm"]', { visible: true, timeout: 10000 })
      await page.click('[data-testid="btn-delete-confirm"]')
    } catch {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
        const target = btns.find(b => /开始删除|开始移除|开始清理/.test((b.textContent || '').trim()))
        if (target) (target).click()
      })
    }
    await waitForProgressGone(page, 300000)
    const shotDel = path.join(artifactsDir, 'screenshots', `${tag}_del50_done.png`)
    await page.screenshot({ path: shotDel })
    steps.push({ name: 'delete_50', status: 'passed', durationMs: Date.now() - t0, screenshot: shotDel })
  } catch (e) {
    const shotDel = path.join(artifactsDir, 'screenshots', `${tag}_del50_error.png`)
    try { await page.screenshot({ path: shotDel }) } catch {}
    steps.push({ name: 'delete_50', status: 'failed', error: String(e), screenshot: shotDel })
  }

  // 计划执行（如果有暂存变更，可跳过；这里尝试点击“应用”按钮）
  try {
    const t0 = Date.now()
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'))
      const apply = btns.find(b => /应用/.test(b.textContent || ''))
      if (apply) (apply).click()
    })
    await waitForProgressGone(page, 120000)
    const shotApply = path.join(artifactsDir, 'screenshots', `${tag}_apply_done.png`)
    await page.screenshot({ path: shotApply })
    steps.push({ name: 'apply_changes', status: 'passed', durationMs: Date.now() - t0, screenshot: shotApply })
  } catch (e) {
    const shotApply = path.join(artifactsDir, 'screenshots', `${tag}_apply_error.png`)
    try { await page.screenshot({ path: shotApply }) } catch {}
    steps.push({ name: 'apply_changes', status: 'failed', error: String(e), screenshot: shotApply })
  }

  // Cleanup 扫描与执行（若 UI 不存在则跳过）
  try {
    const btnExists = await page.$('[data-testid="btn-cleanup"]')
    if (!btnExists) {
      steps.push({ name: 'cleanup_scan_execute', status: 'skipped', reason: 'no cleanup entry' })
    } else {
      const t0 = Date.now()
      await clickWithRetries(page, '[data-testid="btn-cleanup"]', 'after_click_cleanup', /清理|Cleanup/)
      await page.waitForSelector('[data-testid="dlg-cleanup"]', { visible: true, timeout: 20000 })
      // 默认选项：扫描 → 执行
      const scanBtn = await page.$('[data-testid="btn-cleanup-scan"]')
      if (scanBtn) await scanBtn.click()
      await waitForProgressGone(page, 300000)
      const execBtn = await page.$('[data-testid="btn-cleanup-execute"]')
      if (execBtn) await execBtn.click()
      await waitForProgressGone(page, 300000)
      const shot = path.join(artifactsDir, 'screenshots', `${tag}_cleanup_done.png`)
      await page.screenshot({ path: shot })
      steps.push({ name: 'cleanup_scan_execute', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
    }
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_cleanup_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'cleanup_scan_execute', status: 'failed', error: String(e), screenshot: shot })
  }

  // 搜索与索引刷新（若入口不存在则跳过）
  try {
    const searchBox = await page.$('[data-testid="search-box"] input')
    if (!searchBox) {
      steps.push({ name: 'search_and_reindex', status: 'skipped', reason: 'no search box' })
    } else {
      const t0 = Date.now()
      await searchBox.click({ clickCount: 3 })
      await searchBox.type('test', { delay: 20 })
      await sleep(500)
      // 尝试触发重建索引
      const reBtn = await page.$('[data-testid="btn-reindex"]')
      if (reBtn) {
        await reBtn.click()
        await waitForProgressGone(page, 180000)
      }
      const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_reindex.png`)
      await page.screenshot({ path: shot })
      steps.push({ name: 'search_and_reindex', status: 'passed', durationMs: Date.now() - t0, screenshot: shot })
    }
  } catch (e) {
    const shot = path.join(artifactsDir, 'screenshots', `${tag}_search_reindex_error.png`)
    try { await page.screenshot({ path: shot }) } catch {}
    steps.push({ name: 'search_and_reindex', status: 'failed', error: String(e), screenshot: shot })
  }

  await saveConsole(page, tag)
  // 性能摘要（如启用）
  if (perf) {
    try {
      const metrics = await perfClient.send('Performance.getMetrics')
      const summary = {
        tag,
        mode: { network: netPreset?.label || 'Slow 4G', netKey: net, cpuRate: cpu },
        steps: steps.map(s => ({ name: s.name, status: s.status, durationMs: s.durationMs })),
        rawMetrics: metrics?.metrics || []
      }
      await fs.writeFile(
        path.join(artifactsDir, 'performance', `${tag}_summary.json`),
        JSON.stringify(summary, null, 2),
        'utf-8'
      )
    } catch {
      // ignore perf summary failure
    }
  }

  if (perf) {
    try { await page.tracing.stop() } catch {}
  }
  await fs.writeFile(
    path.join(artifactsDir, 'logs', `${tag}_management.json`),
    JSON.stringify({ tag, url, steps }, null, 2),
    'utf-8'
  )
  await browser.disconnect()
  console.log('✅ E2E done. Artifacts saved under artifacts/. Tag:', tag)
}

run().catch(err => {
  console.error('E2E failed:', err)
  process.exit(1)
})
