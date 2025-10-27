# 术语清理计划

## 📊 现状分析

经过全项目扫描，发现：

- **438 处**"搜索"相关内容
- 分布在 **55 个文件**中

## 🎯 清理原则

### 必须改为"筛选"

1. ✅ **所有中文注释**
2. ✅ **所有 UI 文案**
3. ✅ **用户可见的文档**
4. ✅ **API 对外接口**

### 可以保留"search"

1. ✅ **技术术语**（如 `searchAppService`）- 但需加注释说明
2. ✅ **文件名**（如 `search-app-service.ts`）- 历史遗留
3. ✅ **Worker 名称**（如 `search-worker`）- 底层实现

## 📋 清理清单

### 高优先级（用户可见）

#### 1. UI 文案（28 处）

- `frontend/src/pages/side-panel/SidePanel.vue` (28)
- `frontend/src/pages/management/Management.vue` (11)
- `frontend/src/pages/popup/Popup.vue` (1)

#### 2. 用户文档

- `frontend/src/composables/README.md` (39)
- `frontend/src/services/README.md` (38)
- `frontend/src/pages/popup/README.md` (4)

#### 3. 组件注释

- `frontend/src/components/composite/BookmarkFilter/README.md` (2)
- `frontend/src/components/composite/BookmarkTree/BookmarkTree.vue` (4)

### 中优先级（开发者可见）

#### 4. 服务层注释

- `frontend/src/application/search/search-app-service.ts` (23) ⚠️ 重点
- `frontend/src/core/search/unified-search-service.ts` (14)
- `frontend/src/core/search/engine.ts` (14)
- `frontend/src/services/search-performance-monitor.ts` (26)

#### 5. Store 注释

- `frontend/src/stores/search/search-store.ts` (45) ⚠️ 重点

#### 6. 类型定义注释

- `frontend/src/types/domain/search.d.ts` (51) ⚠️ 重点

### 低优先级（技术术语）

#### 7. Worker 相关（保留，加注释）

- `frontend/src/workers/search-worker.ts` (2)
- `frontend/src/workers/search-worker-types.ts` (2)
- `frontend/src/services/search-worker-adapter.ts` (7)

#### 8. 技术文档

- `frontend/src/infrastructure/indexeddb/README.md` (2)

## 🔧 清理策略

### 策略 A：批量替换规则

```bash
# 中文注释中的"搜索" → "筛选"
- "搜索书签" → "筛选书签"
- "书签搜索" → "书签筛选"
- "搜索功能" → "筛选功能"
- "搜索结果" → "筛选结果"
- "搜索服务" → "筛选服务"
- "搜索框" → "筛选框"
- "搜索条件" → "筛选条件"
- "搜索关键字" → "筛选条件"
- "搜索选项" → "筛选选项"
- "进行搜索" → "执行筛选"
```

### 策略 B：文件级别处理

**优先处理这些文件：**

1. `search-app-service.ts` - 加顶部注释说明
2. `search-store.ts` - 加顶部注释说明
3. `search.d.ts` - 加顶部注释说明
4. `SidePanel.vue` - 清理所有 UI 文案
5. `Management.vue` - 清理所有 UI 文案

## 📝 注释模板

### 对于保留 "search" 命名的文件

```typescript
/**
 * 书签筛选服务（Search App Service）
 *
 * 注意：文件名使用 "search" 是历史遗留的技术术语
 * 实际功能是"筛选"而非"搜索"：
 * - 所有数据都在本地 IndexedDB
 * - 不存在网络请求
 * - 从已有集合中过滤符合条件的书签
 *
 * 对外 API 和文档中统一使用"筛选（Filter）"术语
 */
```

## ⚠️ 需要特别注意的文件

### 1. search-app-service.ts

- ✅ 文件名保留
- ⚠️ 所有注释改为"筛选"
- ⚠️ 加顶部说明注释

### 2. search-store.ts

- ✅ 文件名保留
- ⚠️ 所有注释改为"筛选"
- ⚠️ 加顶部说明注释

### 3. search.d.ts

- ✅ 文件名保留
- ⚠️ 所有注释改为"筛选"
- ⚠️ 加顶部说明注释

### 4. search-worker.ts

- ✅ 文件名保留（底层 Worker）
- ⚠️ 加注释说明

## 🎯 执行顺序

1. **Phase 1：UI 文案**（用户可见）
   - SidePanel.vue
   - Management.vue
   - Popup.vue

2. **Phase 2：核心服务注释**（开发者高频接触）
   - search-app-service.ts
   - search-store.ts
   - search.d.ts

3. **Phase 3：用户文档**
   - README.md 文件
   - 组件文档

4. **Phase 4：其他注释**
   - 其余源文件中的注释

5. **Phase 5：验证**
   - 再次扫描"搜索"关键词
   - 生成清理报告

## 📊 预期结果

- 中文"搜索"词条：**0 个**
- 技术术语 "search"：保留（加注释）
- 用户可见术语：100% "筛选"

---

**开始执行清理！**
