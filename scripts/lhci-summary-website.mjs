#!/usr/bin/env bun
// Generate Lighthouse summary for Website (includes SEO, PWA)
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, '.lighthouseci')

// Website thresholds - stricter than extension
const THRESHOLDS = {
  performance: 0.9,
  accessibility: 0.95,
  bestPractices: 0.95,
  seo: 0.95,
  pwa: 0.8
}

const HOME_THRESHOLDS = {
  performance: 0.95,
  accessibility: 0.95,
  bestPractices: 0.95,
  seo: 0.95,
  pwa: 0.8
}

function findJsonReports(dir) {
  try {
    const all = readdirSync(dir).filter((f) => f.endsWith('.json'))
    return all
      .filter((f) => !/^manifest\.json$/.test(f))
      .map((f) => join(dir, f))
  } catch {
    return []
  }
}

function pickScores(lhr) {
  const cat = lhr.categories
  const s = (x) => (x && typeof x.score === 'number' ? Math.round(x.score * 100) : '—')
  return {
    performance: s(cat.performance),
    accessibility: s(cat.accessibility),
    bestPractices: s(cat['best-practices'] || cat.bestPractices),
    seo: s(cat.seo),
    pwa: s(cat.pwa)
  }
}

function isHomePage(url) {
  try {
    const u = new URL(url)
    return u.pathname === '/' || u.pathname === '/index.html'
  } catch {
    return /^\/$|^\/index\.html$/.test(url)
  }
}

function statusEmoji(score, threshold) {
  if (typeof score !== 'number') return '❓'
  return score >= Math.round(threshold * 100) ? '✅' : '❌'
}

function avg(nums) {
  const arr = nums.filter((n) => typeof n === 'number')
  if (!arr.length) return '—'
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

const files = findJsonReports(OUT_DIR)

const rows = []
for (const file of files) {
  try {
    const json = JSON.parse(readFileSync(file, 'utf-8'))
    if (!json || !json.categories) continue
    const url = json.requestedUrl || json.finalUrl || '—'
    const reportUrl = json.reportUrl || null // Google Cloud Storage URL if uploaded
    const { performance, accessibility, bestPractices, seo, pwa } = pickScores(json)
    rows.push({ url, reportUrl, performance, accessibility, bestPractices, seo, pwa, isHome: isHomePage(url) })
  } catch {}
}

if (rows.length === 0) {
  console.log('No Lighthouse JSON reports found. Run "bun run audit:website" first.')
  process.exit(0)
}

rows.sort((a, b) => a.url.localeCompare(b.url))

const marker = '<!-- LHCI-WEBSITE-SUMMARY -->'

// Averages
const avgPerf = avg(rows.map((r) => r.performance))
const avgA11y = avg(rows.map((r) => r.accessibility))
const avgBP = avg(rows.map((r) => r.bestPractices))
const avgSEO = avg(rows.map((r) => r.seo))
const avgPWA = avg(rows.map((r) => r.pwa))

let md = `${marker}\n\n### 🌐 Website Lighthouse 评分摘要\n\n`
md += `**总体均值：** 性能 ${avgPerf} · 可访问性 ${avgA11y} · 最佳实践 ${avgBP} · SEO ${avgSEO} · PWA ${avgPWA}\n\n`
md += '> 注：首页性能阈值更严格（≥95），其他页面为 ≥90；可访问性/最佳实践/SEO 阈值均为 ≥95。\n\n'

// 按页面分组显示报告链接
const reportsByPage = new Map();
for (const report of rows) {
  const url = new URL(report.url);
  const path = url.pathname === '/' ? '首页' : url.pathname.replace(/\//g, '');
  if (!reportsByPage.has(path)) {
    reportsByPage.set(path, []);
  }
  reportsByPage.get(path).push(report);
}

md += `#### 📊 各页面报告链接\n\n`;
for (const [page, pageReports] of reportsByPage) {
  const report = pageReports[0];
  if (report.reportUrl) {
    // 显示 Google Cloud Storage 链接
    md += `- **${page}**: [查看报告](${report.reportUrl})\n`;
  } else {
    // 如果没有上传链接，显示本地路径提示
    md += `- **${page}**: 本地报告 (运行 \`open website/.lighthouseci/*.report.html\`)\n`;
  }
}
md += '\n'

md += '| 页面 | 性能 | 可访问性 | 最佳实践 | SEO | PWA | 说明 |\n'
md += '|---|---:|---:|---:|---:|---:|---|\n'

for (const r of rows) {
  const t = r.isHome ? HOME_THRESHOLDS : THRESHOLDS
  const perfS = `${r.performance} ${statusEmoji(r.performance, t.performance)}`
  const a11yS = `${r.accessibility} ${statusEmoji(r.accessibility, t.accessibility)}`
  const bpS = `${r.bestPractices} ${statusEmoji(r.bestPractices, t.bestPractices)}`
  const seoS = `${r.seo} ${statusEmoji(r.seo, t.seo)}`
  const pwaS = `${r.pwa} ${statusEmoji(r.pwa, t.pwa)}`
  const note = r.isHome ? '首页（严格阈值）' : ''
  md += `| ${r.url} | ${perfS} | ${a11yS} | ${bpS} | ${seoS} | ${pwaS} | ${note} |\n`
}

md += '\n#### 核心 Web Vitals 指标\n\n'
md += '- **FCP** (First Contentful Paint): 首次内容绘制 < 1.5s (首页) / < 2s (其他)\n'
md += '- **LCP** (Largest Contentful Paint): 最大内容绘制 < 2s (首页) / < 2.5s (其他)\n'
md += '- **CLS** (Cumulative Layout Shift): 累积布局偏移 < 0.1\n'
md += '- **TBT** (Total Blocking Time): 总阻塞时间 < 300ms\n\n'

md += '报告：构建 artifacts 中含 HTML/JSON；已上传至临时公共存储。\n'

console.log(md)
