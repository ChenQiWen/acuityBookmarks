# 时间格式化工具 - 国际化最佳实践

## 📋 概述

本工具使用浏览器原生 `Intl` API 实现时间的国际化格式化，**零依赖**，自动适配用户语言环境。

## 🌍 支持的语言

自动检测并支持所有浏览器支持的语言，包括但不限于：

- 🇨🇳 中文 (zh-CN, zh-TW)
- 🇺🇸 英文 (en-US, en-GB)
- 🇯🇵 日文 (ja-JP)
- 🇰🇷 韩文 (ko-KR)
- 🇪🇸 西班牙文 (es-ES)
- 🇫🇷 法文 (fr-FR)
- 🇩🇪 德文 (de-DE)
- 🇷🇺 俄文 (ru-RU)
- ...更多

## 🎯 核心功能

### 1. 相对时间格式化

```typescript
import { formatRelativeTime } from '@/utils/time-formatter'

const timestamp = Date.now() - 3600000 // 1小时前

formatRelativeTime(timestamp)
// 中文: "1小时前"
// 英文: "1 hour ago"
// 日文: "1時間前"
```

### 2. 具体时间格式化

```typescript
import { formatTime } from '@/utils/time-formatter'

const timestamp = Date.now()

formatTime(timestamp)
// 中文: "14:30:25"
// 英文: "2:30:25 PM"  (12小时制)
// 日文: "14:30:25"
```

### 3. 组合格式（推荐用于最近访问）

```typescript
import { formatRecentVisitTime } from '@/utils/time-formatter'

const timestamp = Date.now() - 7200000 // 2小时前

formatRecentVisitTime(timestamp)
// 中文: "2小时前 14:30:25"
// 英文: "2 hours ago 2:30:25 PM"
// 日文: "2時間前 14:30:25"
```

### 4. 完整日期时间格式化

```typescript
import { formatDateTime } from '@/utils/time-formatter'

const timestamp = Date.now()

formatDateTime(timestamp)
// 中文: "2025年1月1日 14:30:25"
// 英文: "Jan 1, 2025, 2:30:25 PM"
// 日文: "2025年1月1日 14:30:25"
```

## 📊 显示效果对比

| 时间差 | 中文 (zh-CN) | 英文 (en-US) | 日文 (ja-JP) |
|--------|-------------|-------------|-------------|
| 30秒前 | `30秒前 14:30:25` | `30 seconds ago 2:30:25 PM` | `30秒前 14:30:25` |
| 5分钟前 | `5分钟前 14:25:10` | `5 minutes ago 2:25:10 PM` | `5分前 14:25:10` |
| 2小时前 | `2小时前 12:30:45` | `2 hours ago 12:30:45 PM` | `2時間前 12:30:45` |
| 3天前 | `3天前 09:15:30` | `3 days ago 9:15:30 AM` | `3日前 09:15:30` |
| 2周前 | `2周前 08:20:15` | `2 weeks ago 8:20:15 AM` | `2週間前 08:20:15` |
| 1个月前 | `1/1 08:20:15` | `1/1 8:20:15 AM` | `1/1 08:20:15` |

## 🔧 技术实现

### 核心 API

1. **Intl.RelativeTimeFormat** - 相对时间格式化
   - 自动本地化（"2小时前" / "2 hours ago"）
   - 支持多种时间单位（秒、分、时、天、周）

2. **Intl.DateTimeFormat** - 日期时间格式化
   - 自动本地化日期格式
   - 自动适配12/24小时制
   - 支持自定义格式选项

3. **navigator.language** - 语言检测
   - 自动获取用户浏览器语言
   - 降级策略：用户语言 → 浏览器语言 → 英语

### 时间单位选择逻辑

```typescript
if (seconds < 60) return rtf.format(-seconds, 'second')  // 秒
if (minutes < 60) return rtf.format(-minutes, 'minute')  // 分钟
if (hours < 24) return rtf.format(-hours, 'hour')        // 小时
if (days < 7) return rtf.format(-days, 'day')            // 天
if (weeks < 4) return rtf.format(-weeks, 'week')         // 周
// 超过4周显示具体日期
```

## 🎨 使用示例

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { formatRecentVisitTime } from '@/utils/time-formatter'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

interface Props {
  bookmark: BookmarkRecord
}

const props = defineProps<Props>()
</script>

<template>
  <div class="bookmark-item">
    <div class="title">{{ bookmark.title }}</div>
    <div class="time">{{ formatRecentVisitTime(bookmark.lastVisited) }}</div>
  </div>
</template>
```

### 在 TypeScript 中使用

```typescript
import { formatRecentVisitTime } from '@/utils/time-formatter'

const bookmarks = await getRecentBookmarks()

bookmarks.forEach(bookmark => {
  console.log(
    `${bookmark.title} - ${formatRecentVisitTime(bookmark.lastVisited)}`
  )
})
```

## 🌟 优势

### ✅ 零依赖
- 不需要安装 day.js、moment.js 等第三方库
- 减少打包体积
- 降低维护成本

### ✅ 自动本地化
- 无需手动配置语言包
- 浏览器原生支持
- 自动适配用户语言

### ✅ 标准化
- 使用 Web 标准 API
- 长期维护保证
- 跨浏览器兼容性好

### ✅ 性能优异
- 原生实现，性能最优
- 无额外解析开销
- 内存占用小

## 🔄 迁移指南

### 从硬编码迁移

**之前：**
```typescript
const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`
}
```

**之后：**
```typescript
import { formatRecentVisitTime } from '@/utils/time-formatter'

// 直接使用，自动国际化
formatRecentVisitTime(timestamp)
```

### 从 day.js 迁移

**之前：**
```typescript
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const time = dayjs(timestamp).fromNow()
```

**之后：**
```typescript
import { formatRelativeTime } from '@/utils/time-formatter'

const time = formatRelativeTime(timestamp)
```

## 📚 参考资料

- [MDN - Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
- [MDN - Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [ECMA-402 国际化 API 规范](https://tc39.es/ecma402/)

## 🐛 已知限制

1. **浏览器兼容性**
   - `Intl.RelativeTimeFormat` 需要 Chrome 71+, Firefox 65+, Safari 14+
   - 对于旧浏览器，可以考虑使用 polyfill

2. **时区处理**
   - 当前实现使用本地时区
   - 如需跨时区支持，建议使用 Luxon 或 date-fns-tz

## 🔮 未来扩展

如果项目需要更复杂的时间处理（如时区转换、复杂日期计算），可以考虑：

1. **day.js** (2KB) - 轻量级，API 简洁
2. **date-fns** (Tree-shaking 友好) - 函数式，TypeScript 支持好
3. **Luxon** (70KB+) - 功能强大，时区处理完善

但对于大多数场景，原生 `Intl` API 已经足够！
