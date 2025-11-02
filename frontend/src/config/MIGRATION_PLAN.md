# 🔄 配置系统迁移计划

> 本文档记录了项目中所有需要迁移到统一配置系统的硬编码位置

---

## 📊 迁移统计

| 类别                   | 发现数量 | 已迁移 | 待迁移  |
| ---------------------- | -------- | ------ | ------- |
| setTimeout/setInterval | 20       | 0      | 20      |
| 尺寸配置               | 21       | 0      | 21      |
| 动画配置               | 22       | 0      | 22      |
| 超时配置               | 60       | 0      | 60      |
| **总计**               | **123**  | **0**  | **123** |

---

## 🎯 优先级分类

### 🔴 高优先级（P0）- 频繁使用或影响核心功能

#### 1. 通知服务超时配置

- ✅ **已完成**
- **位置**: `notification-service.ts`, `ToastBar.vue`
- **迁移**: 使用 `NOTIFICATION_CONFIG`

#### 2. API 请求超时

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/services/query-worker-adapter.ts:204, 382`
  - `frontend/src/services/bookmark-sync-service.ts:278`
  - `frontend/src/services/local-crawler-worker.ts:71, 376, 522`
- **建议配置**: `TIMEOUT_CONFIG.API.STANDARD` (10000ms)

#### 3. 爬虫相关超时

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/services/local-crawler-worker.ts:322` - abort timeout (5000ms)
  - `frontend/src/services/crawl-task-scheduler.ts:542, 547, 558` - 任务调度延迟
  - ~~`frontend/src/core/bookmark/services/cleanup-scanner.ts:316`~~ - ❌ 已删除（使用自动检测替代）
- **建议配置**:
  - `TIMEOUT_CONFIG.CRAWLER.REQUEST`
  - `TIMEOUT_CONFIG.DELAY.CRAWLER_BATCH`
  - `TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_WAIT`

### 🟡 中优先级（P1）- 性能优化相关

#### 4. 批次处理延迟

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/stores/bookmark/bookmark-management-store.ts:388, 618, 944, 948`
  - `frontend/src/services/bookmark-sync-service.ts:587`
  - `frontend/src/infrastructure/indexeddb/manager.ts:494`
- **建议配置**:
  - `TIMEOUT_CONFIG.DELAY.MEDIUM` (200ms)
  - `TIMEOUT_CONFIG.DELAY.STANDARD` (500ms)
  - `TIMEOUT_CONFIG.DELAY.IMMEDIATE` (0ms)

#### 5. 书签操作延迟

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/background/bookmarks.ts:47` - 350ms
  - `frontend/src/background/bootstrap.ts:63, 101, 138` - 500ms, 1000ms
- **建议配置**:
  - `TIMEOUT_CONFIG.DELAY.BOOKMARK_OP` (350ms)
  - `TIMEOUT_CONFIG.DELAY.BOOTSTRAP` (500ms)

#### 6. 性能监控间隔

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/composables/useSimplePerformance.ts:315` - 5000ms
- **建议配置**: `TIMEOUT_CONFIG.MONITORING.MEMORY_UPDATE`

### 🟢 低优先级（P2）- UI 动画和样式

#### 7. 动画时长

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/components/base/ToastBar/ToastBar.vue` - 0.24s, 0.2s, 0.3s
  - `frontend/src/components/base/ProgressBar/ProgressBar.vue` - 2s, 1.4s, 2500ms
  - `frontend/src/components/base/Button/Button.vue` - 600ms, 1s
- **建议配置**:
  - `ANIMATION_CONFIG.DURATION.TOAST_ENTER`
  - `ANIMATION_CONFIG.DURATION.TOAST_LEAVE`
  - `ANIMATION_CONFIG.DURATION.RIPPLE`

#### 8. 组件尺寸

- ⏳ **待迁移**
- **文件**:
  - `frontend/src/components/base/ToastBar/ToastBar.vue` - 图标 22px, 16px, 32px
  - `frontend/src/components/composite/BookmarkTree/TreeNode.vue` - 图标 16px, 20px
- **建议配置**:
  - `SIZE_CONFIG.ICON.SM` (16px)
  - `SIZE_CONFIG.ICON.MD` (20px)
  - `SIZE_CONFIG.ICON.NORMAL` (22px)
  - `SIZE_CONFIG.ICON.XL` (32px)

---

## 📝 迁移步骤模板

### 步骤 1：导入配置

```typescript
// 文件顶部添加导入
import {
  TIMEOUT_CONFIG,
  SIZE_CONFIG,
  ANIMATION_CONFIG
} from '@/config/constants'
```

### 步骤 2：替换硬编码

```typescript
// 修改前
setTimeout(callback, 300)

// 修改后
setTimeout(callback, TIMEOUT_CONFIG.DELAY.STANDARD)
```

### 步骤 3：添加注释

```typescript
// ✅ 使用标准延迟确保操作完成
setTimeout(callback, TIMEOUT_CONFIG.DELAY.STANDARD)
```

### 步骤 4：验证

```bash
# 运行测试
bun run typecheck:force
bun run lint:check:force

# 手动测试功能是否正常
```

---

## 🗺️ 详细迁移清单

### A. notification-service.ts

- [x] ✅ `defaultTimeout: 2000` → `NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT`
- [x] ✅ `suppressWindowMs: 1200` → `NOTIFICATION_CONFIG.SUPPRESS_WINDOW`
- [x] ✅ `offsetTop: 90` → `NOTIFICATION_CONFIG.TOAST_OFFSET_TOP`
- [x] ✅ `maxLifetimeMs: 6000` → `NOTIFICATION_CONFIG.MAX_TOAST_LIFETIME`
- [ ] ⏳ `setTimeout(() => this.runNext(), 100)` → `TIMEOUT_CONFIG.DELAY.SHORT`

### B. ToastBar.vue

- [x] ✅ `opts?.timeoutMs ?? 9999000` → `NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT`
- [ ] ⏳ `:size="32"` → `SIZE_CONFIG.PROGRESS.CIRCULAR.SM`
- [ ] ⏳ `:size="22"` → `SIZE_CONFIG.ICON.NORMAL`
- [ ] ⏳ `:size="16"` → `SIZE_CONFIG.ICON.SM`
- [ ] ⏳ `animation: ... 0.24s` → `ANIMATION_CONFIG.DURATION.TOAST_ENTER`
- [ ] ⏳ `animation: ... 0.2s` → `ANIMATION_CONFIG.DURATION.TOAST_LEAVE`

### C. bookmark-management-store.ts

- [ ] ⏳ `setTimeout(resolve, 200)` (Line 388) → `TIMEOUT_CONFIG.DELAY.MEDIUM`
- [ ] ⏳ `setTimeout(resolve, 200)` (Line 618) → `TIMEOUT_CONFIG.DELAY.MEDIUM`
- [ ] ⏳ `setTimeout(resolve, 0)` (Line 944) → `TIMEOUT_CONFIG.DELAY.IMMEDIATE`
- [ ] ⏳ `setTimeout(resolve, 500)` (Line 948) → `TIMEOUT_CONFIG.DELAY.STANDARD`

### D. local-crawler-worker.ts

- [ ] ⏳ `REQUEST_TIMEOUT_MS = 10000` → `TIMEOUT_CONFIG.CRAWLER.REQUEST`
- [ ] ⏳ `setTimeout(() => controller.abort(), 5000)` → `TIMEOUT_CONFIG.CRAWLER.METADATA`
- [ ] ⏳ `{ timeout: 3000 }` → `TIMEOUT_CONFIG.CRAWLER.PARSE`
- [ ] ⏳ `setTimeout(resolve, 1000 * (retryCount + 1))` → `TIMEOUT_CONFIG.RETRY.INTERVAL`

### E. crawl-task-scheduler.ts

- [ ] ⏳ `waitForIdleOrTimeout(5000)` → `TIMEOUT_CONFIG.CRAWLER.IDLE_WAIT`
- [ ] ⏳ `setTimeout(resolve, 1000)` → `TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_WAIT`
- [ ] ⏳ `setTimeout(resolve, 500)` → `TIMEOUT_CONFIG.DELAY.CRAWLER_TASK_RETRY`
- [ ] ⏳ `MAX_GLOBAL_CONCURRENT = 2` → `WORKER_CONFIG.CONCURRENCY.CRAWLER_GLOBAL`
- [ ] ⏳ `MAX_PER_DOMAIN_CONCURRENT = 1` → `WORKER_CONFIG.CONCURRENCY.CRAWLER_PER_DOMAIN`

### F. bookmark-sync-service.ts

- [ ] ⏳ `SYNC_TIMEOUT_MS = 30000` → `TIMEOUT_CONFIG.API.SYNC`
- [ ] ⏳ `setTimeout(resolve, 0)` → `TIMEOUT_CONFIG.DELAY.IMMEDIATE`

### G. query-worker-adapter.ts

- [ ] ⏳ `setTimeout(r, 0)` → `TIMEOUT_CONFIG.DELAY.IMMEDIATE`
- [ ] ⏳ `{ timeout: 5000 }` → `TIMEOUT_CONFIG.API.FAST`
- [ ] ⏳ `{ timeout: 10000 }` → `TIMEOUT_CONFIG.API.STANDARD`

### H. 其他文件

- [ ] ⏳ `frontend/src/application/bookmark/tree-app-service.ts:143`
- [ ] ⏳ `frontend/src/offscreen/main.ts:39`
- [ ] ⏳ `frontend/src/services/bookmark-crawler-trigger.ts:474`
- [ ] ⏳ `frontend/src/services/bookmark-health-service.ts:113`
- [ ] ⏳ `frontend/src/background/offscreen-manager.ts:129`
- [ ] ⏳ `frontend/src/services/smart-recommendation-engine.ts:197, 1689, 1746, 1757`
- [ ] ⏳ `frontend/src/composables/useSimplePerformance.ts:315`

---

## 🚨 注意事项

### 1. 批量替换风险

⚠️ **不要使用全局查找替换**！每个硬编码数字可能有不同的语义：

```typescript
// 这些都是 300，但含义完全不同
setTimeout(fn, 300) // 延迟执行
width: 300 // 尺寸
cacheTime: 300 // 缓存时长（秒）
maxItems: 300 // 数量限制
```

### 2. 向后兼容

确保迁移不会破坏现有功能：

```typescript
// ✅ 保持相同的数值
const oldValue = 10000
const newValue = TIMEOUT_CONFIG.API.STANDARD // 也是 10000
```

### 3. 类型安全

使用 TypeScript 确保类型正确：

```typescript
// ❌ 错误：配置返回数字，但需要字符串
const duration: string = TIMEOUT_CONFIG.DELAY.STANDARD

// ✅ 正确：添加单位
const duration = `${TIMEOUT_CONFIG.DELAY.STANDARD}ms`
```

### 4. 测试覆盖

每次迁移后都要测试：

- ✅ 单元测试通过
- ✅ E2E 测试通过
- ✅ 手动测试核心功能
- ✅ 性能无明显下降

---

## 📈 进度跟踪

### 本周目标（Week 1）

- [x] ✅ 创建配置系统框架
- [x] ✅ 迁移通知系统配置
- [ ] ⏳ 迁移 API 超时配置（P0）
- [ ] ⏳ 迁移爬虫超时配置（P0）

### 下周目标（Week 2）

- [ ] ⏳ 迁移批次处理延迟（P1）
- [ ] ⏳ 迁移书签操作延迟（P1）
- [ ] ⏳ 迁移性能监控配置（P1）

### 后续目标（Week 3+）

- [ ] ⏳ 迁移动画配置（P2）
- [ ] ⏳ 迁移尺寸配置（P2）
- [ ] ⏳ 编写迁移测试用例
- [ ] ⏳ 更新技术文档

---

## 🎯 预期收益

### 短期收益

- ✅ 消除魔法数字，提升代码可读性
- ✅ 统一配置管理，降低维护成本
- ✅ 便于调试和性能优化

### 长期收益

- ✅ 为全局配置开关系统奠定基础
- ✅ 支持用户自定义配置
- ✅ 支持配置导入/导出
- ✅ 支持 A/B 测试不同配置

---

**最后更新**: 2025-10-31
**下次更新**: 每周一更新进度
