# 📢 AcuityBookmarks 三层通知系统使用指南

> 统一管理所有用户通知，提供一致、非侵入式的通知体验

---

## 🎯 系统架构

```
┌─────────────────────────────────────────────────┐
│      统一通知入口: NotificationService.notify()     │
├─────────────────────────────────────────────────┤
│                                                 │
│  🔴 Level 1: Badge 徽章通知                       │
│  ├─ API: chrome.action.setBadgeText()          │
│  ├─ 特点: 持续显示、低打扰                          │
│  └─ 场景: 未读计数、后台任务状态                    │
│                                                 │
│  🎨 Level 2: 页面通知                             │
│  ├─ API: Notification 组件 (Ant Design 风格)    │
│  ├─ 特点: 即时反馈、中等打扰、支持 key 更新         │
│  └─ 场景: 操作反馈、状态更新                       │
│                                                 │
│  🔔 Level 3: System 系统通知                      │
│  ├─ API: chrome.notifications.create()         │
│  ├─ 特点: 系统级别、高打扰                         │
│  └─ 场景: 重要事件、后台任务完成                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📊 三层通知对比

| 维度         | Badge            | Toast        | System                  |
| ------------ | ---------------- | ------------ | ----------------------- |
| **显示位置** | 扩展图标右上角   | 页面内右上角 | 操作系统通知中心        |
| **持续时间** | 持久（手动清除） | 2-10秒       | 5-10秒                  |
| **打扰程度** | 低 ⭐            | 中 ⭐⭐      | 高 ⭐⭐⭐               |
| **可见性**   | 全局可见         | 仅页面内     | 全系统可见              |
| **自定义度** | 文本+颜色        | 完全自定义   | 系统默认样式            |
| **权限要求** | ❌ 不需要        | ❌ 不需要    | ✅ 需要 `notifications` |

---

## 🚀 快速开始

### 基础用法

```typescript
import { notificationService } from '@/application/notification/notification-service'

// 简单通知（仅 Toast）
await notificationService.notify('书签已删除')

// 成功通知
await notificationService.notifySuccess('同步完成')

// 警告通知
await notificationService.notifyWarning('发现 3 个重复书签')

// 错误通知
await notificationService.notifyError('网络连接失败')
```

---

## 📘 核心 API

### 1. `notify()` - 统一通知入口

#### 方法签名

```typescript
async notify(
  message: string,
  opts?: NotificationOptions
): Promise<Result<void, Error>>
```

#### 参数说明

| 参数      | 类型                  | 必需 | 说明         |
| --------- | --------------------- | ---- | ------------ |
| `message` | `string`              | ✅   | 通知消息文本 |
| `opts`    | `NotificationOptions` | ❌   | 通知配置选项 |

#### 配置选项 (`NotificationOptions`)

```typescript
interface NotificationOptions {
  // === 基础配置 ===
  level?: 'info' | 'success' | 'warning' | 'error' // 通知级别
  title?: string // 标题（系统通知使用）
  timeoutMs?: number // 显示时长（毫秒）
  priority?: 'low' | 'normal' | 'high' // 优先级

  // === Badge 徽章配置 ===
  updateBadge?: boolean // 是否更新徽章
  badgeText?: string // 徽章文本（简化配置）
  badgeColor?: string // 徽章颜色（简化配置）
  badge?: {
    // 徽章详细配置
    text: string
    color?: string
    level?: 'info' | 'success' | 'warning' | 'error'
    autoClear?: boolean // 是否自动清除
    clearDelay?: number // 自动清除延迟（毫秒）
  }
}
```

---

## 💡 使用场景与示例

### 场景 1️⃣: 书签 CRUD 操作（仅 Toast）

```typescript
// ✅ 操作反馈：即时、轻量
await notificationService.notify('书签已删除', {
  level: 'success',
  timeoutMs: 3000
})

await notificationService.notify('书签已创建', {
  level: 'success'
})
```

**为什么不用徽章或系统通知？**

- ✅ 用户正在页面内操作，Toast 足够
- ✅ 高频操作，不应该过度打扰

---

### 场景 2️⃣: 健康扫描发现问题（Badge + Toast）

```typescript
// ✅ 持久提醒 + 即时反馈
await notificationService.notify('发现 5 个健康问题', {
  level: 'warning',
  updateBadge: true, // ✨ 更新徽章
  badgeText: '5' // ✨ 显示数字 5
})
```

**效果**：

- 🔴 扩展图标显示：`5`（橙色徽章）
- 🎨 页面显示 Toast："发现 5 个健康问题"

**清除徽章**：

```typescript
// 用户点击查看问题后
await notificationService.clearBadge()
```

---

### 场景 3️⃣: 后台同步中（仅 Badge）

```typescript
// ✅ 状态指示，不打扰用户
await notificationService.notify('正在同步书签...', {
  updateBadge: true,
  badgeText: '↻', // 同步图标
  badgeColor: '#1677ff', // 蓝色
  badge: {
    text: '↻',
    autoClear: false // 不自动清除
  }
})
```

**同步完成后**：

```typescript
// 清除"同步中"徽章
await notificationService.clearBadge()

// 显示成功 Toast
await notificationService.notifySuccess('书签同步完成，已更新 50 条')
```

---

### 场景 4️⃣: 后台任务完成（Badge + System）

```typescript
// ✅ 页面隐藏时自动切换为系统通知
await notificationService.notify('书签同步完成', {
  level: 'success',
  priority: 'high', // 高优先级
  updateBadge: true, // 更新徽章
  badgeText: '✓', // 完成标记
  badge: {
    text: '✓',
    autoClear: true, // ✨ 自动清除
    clearDelay: 5000 // 5秒后清除
  }
})
```

**智能决策**：

- 页面**可见**时：显示 Toast + 更新徽章
- 页面**隐藏**时：显示系统通知 + 更新徽章

---

### 场景 5️⃣: 爬虫运行状态

```typescript
// 开始爬取
await notificationService.updateBadge('...', '#faad14') // 黄色省略号

// 爬取进度
await notificationService.showBadgeCount(15, 'info') // 显示 "15"

// 爬取完成
await notificationService.notify('爬取完成，已更新 50 个书签', {
  level: 'success',
  updateBadge: true,
  badgeText: '50',
  badge: {
    text: '50',
    autoClear: true,
    clearDelay: 10000 // 10秒后自动清除
  }
})
```

---

### 场景 6️⃣: 错误提示（三层全开）

```typescript
// ✅ 确保用户一定看到错误
await notificationService.notify('书签数据库损坏', {
  level: 'error',
  priority: 'high',
  updateBadge: true, // 持久徽章提醒
  badgeText: '!', // 感叹号
  badgeColor: '#ff4d4f' // 红色
})
```

**效果**：

- 🔴 徽章：`!`（红色）
- 🎨 Toast：错误提示（页面可见时）
- 🔔 System：系统通知（页面隐藏时）

---

## 🎛️ 高级功能

### 自定义徽章颜色

```typescript
await notificationService.notify('自定义状态', {
  updateBadge: true,
  badgeText: '⚡',
  badgeColor: '#9c27b0' // 紫色
})
```

### 仅更新徽章（不显示 Toast/System）

```typescript
// 方式1：直接调用 Badge API
await notificationService.updateBadge('5', '#ff4d4f')

// 方式2：通过 notify + 禁用 Toast/System
const service = notificationService
service.setConfig({
  enablePageToasts: false,
  enableSystemNotifications: false
})

await service.notify('', {
  updateBadge: true,
  badgeText: '5'
})
```

### 徽章计数（超过99显示"99+"）

```typescript
await notificationService.showBadgeCount(150, 'error')
// 显示：99+（红色）
```

### 配置全局行为

```typescript
import { notificationService } from '@/application/notification/notification-service'

// 禁用某一层通知
notificationService.setConfig({
  enableBadge: false, // 禁用徽章
  enablePageToasts: true, // 启用 Toast
  enableSystemNotifications: true // 启用系统通知
})
```

---

## 🎨 徽章颜色规范

系统预定义了4种语义化颜色：

| 级别      | 颜色代码  | 预览 | 使用场景           |
| --------- | --------- | ---- | ------------------ |
| `info`    | `#1677ff` | 🔵   | 信息提示、后台任务 |
| `success` | `#52c41a` | 🟢   | 成功状态、任务完成 |
| `warning` | `#faad14` | 🟠   | 警告提示、需注意   |
| `error`   | `#ff4d4f` | 🔴   | 错误状态、紧急事项 |

**配置位置**：`frontend/src/config/constants.ts` → `NOTIFICATION_CONFIG.BADGE_COLORS`

---

## 🔧 最佳实践

### ✅ 推荐做法

1. **根据场景选择合适的通知层级**

   ```typescript
   // 高频操作：仅 Toast
   await notificationService.notify('书签已复制')

   // 持久状态：Badge + Toast
   await notificationService.notify('发现问题', {
     updateBadge: true,
     badgeText: '3'
   })

   // 重要事件：三层全开
   await notificationService.notify('数据库错误', {
     level: 'error',
     updateBadge: true,
     badgeText: '!'
   })
   ```

2. **徽章及时清除**

   ```typescript
   // ✅ 用户查看问题后立即清除
   await notificationService.clearBadge()

   // ✅ 或使用自动清除
   await notificationService.notify('任务完成', {
     updateBadge: true,
     badgeText: '✓',
     badge: {
       text: '✓',
       autoClear: true,
       clearDelay: 5000
     }
   })
   ```

3. **使用语义化级别**
   ```typescript
   // ✅ 明确的语义
   await notificationService.notifySuccess('操作成功')
   await notificationService.notifyWarning('网络不稳定')
   await notificationService.notifyError('保存失败')
   ```

### ❌ 避免的做法

1. **不要滥用徽章**

   ```typescript
   // ❌ 错误：高频操作不应该更新徽章
   for (let i = 0; i < 100; i++) {
     await notificationService.notify('处理书签...', {
       updateBadge: true,
       badgeText: String(i)
     })
   }

   // ✅ 正确：仅更新最终结果
   await notificationService.notify('已处理 100 个书签', {
     level: 'success'
   })
   ```

2. **不要同时显示多个相同内容的通知**

   ```typescript
   // 系统已内置去重机制（suppressWindowMs: 1200ms）
   // 无需手动判断
   ```

3. **不要在 Service Worker 中直接操作 Toast**
   ```typescript
   // ❌ 错误：Service Worker 中没有 document
   // 使用 notificationService.notify() 会自动处理
   ```

---

## 📖 完整示例：健康扫描工作流

```typescript
import { notificationService } from '@/application/notification/notification-service'

// 1️⃣ 开始扫描：显示徽章状态
await notificationService.notify('正在扫描书签健康状态...', {
  updateBadge: true,
  badgeText: '...',
  badgeColor: '#1677ff'
})

// 2️⃣ 扫描进度：更新徽章计数
let scannedCount = 0
for (const bookmark of bookmarks) {
  await scanBookmark(bookmark)
  scannedCount++

  // 每扫描 10 个更新一次徽章
  if (scannedCount % 10 === 0) {
    await notificationService.updateBadge(String(scannedCount), '#1677ff')
  }
}

// 3️⃣ 扫描完成：显示结果
const issues = getHealthIssues()

if (issues.length > 0) {
  // 发现问题：Badge + Toast
  await notificationService.notify(`发现 ${issues.length} 个健康问题`, {
    level: 'warning',
    updateBadge: true,
    badgeText: String(issues.length),
    badge: {
      text: String(issues.length),
      autoClear: false // 不自动清除，等用户查看
    }
  })
} else {
  // 无问题：仅 Toast + 清除徽章
  await notificationService.notifySuccess('书签健康状态良好')
  await notificationService.clearBadge()
}

// 4️⃣ 用户查看问题后：清除徽章
function handleViewIssues() {
  notificationService.clearBadge()
  // ... 导航到健康管理页面
}
```

---

## 🐛 故障排查

### 徽章不显示

**可能原因**：

1. Badge 功能被禁用
2. `chrome.action` API 不可用
3. 徽章文本为空

**解决方案**：

```typescript
// 检查配置
console.log(notificationService.getConfig().enableBadge)

// 检查 API 可用性
console.log(typeof chrome !== 'undefined' && chrome.action)

// 确保文本不为空
await notificationService.updateBadge('!', '#ff4d4f')
```

### Toast 不显示

**可能原因**：

1. Toast 功能被禁用
2. 在 Service Worker 环境中调用
3. 消息被去重抑制

**解决方案**：

```typescript
// 检查配置
console.log(notificationService.getConfig().enablePageToasts)

// 检查环境
console.log(typeof document !== 'undefined')

// 使用唯一 key 避免去重
await notificationService.notify('消息', {
  key: `unique-${Date.now()}`
})
```

---

## 🔗 相关资源

- **类型定义**：`frontend/src/types/application/notification.ts`
- **配置常量**：`frontend/src/config/constants.ts` → `NOTIFICATION_CONFIG`
- **Notification 组件**：`frontend/src/components/base/Notification/Notification.vue`
- **组合式函数**：`frontend/src/composables/useNotification.ts`
- **服务实现**：`frontend/src/application/notification/notification-service.ts`

---

## 📝 更新日志

### v2.0.0 (2025-01-XX)

- ✨ 新增三层通知系统
- ✨ 新增 Badge 徽章支持
- ✨ 新增智能通知决策
- 🔧 优化 Toast 闪烁问题
- 📖 完善使用文档

---

**Happy Notifying! 🎉**
