# 书签特征规则字典

## 概述

`trait-rules.ts` 是书签特征系统的核心配置文件，定义了所有特征类型、元数据和检测规则。

## 设计原则

1. **单一数据源**：所有特征定义都在这里，避免重复
2. **易于扩展**：新增特征只需在这里添加
3. **类型安全**：使用 TypeScript 确保类型正确
4. **自文档化**：每个特征都有完整的元数据和检测规则

## 特征类型

当前支持 **6 个特征**：

| 特征 | 名称 | 图标 | 优先级 | 负面特征 | 说明 |
|------|------|------|--------|---------|------|
| `duplicate` | 重复书签 | 🔄 | 1 | 是 | URL 完全相同的书签 |
| `invalid` | 失效书签 | ❌ | 2 | 是 | 无法正常访问的书签 |
| `internal` | 内部书签 | 🔒 | 3 | 否 | 浏览器内部地址 |
| `outdated` | 过时书签 | 📅 | 4 | 是 | 超过 1 年未访问 ⭐ 新增 |
| `untagged` | 未分类书签 | 📂 | 5 | 是 | 直接在根目录或书签栏 ⭐ 新增 |
| `untitled` | 无标题书签 | ✏️ | 6 | 是 | 标题为空或等于 URL ⭐ 新增 |

### 1. duplicate（重复书签）

**定义：** URL 完全相同的书签（从第二个开始）

**检测规则：**
1. URL 完全相同（忽略大小写）
2. 按 dateAdded + index 排序，第一个是原始书签
3. 后续相同 URL 的标记为重复

**元数据：**
- 图标：🔄
- 优先级：1（最高）
- 负面特征：是

**使用场景：**
- 清理重复书签
- 合并书签
- 导出去重

### 2. invalid（失效书签）

**定义：** 无法正常访问的书签

**检测规则：**
1. URL 格式错误：协议不是 http/https
2. URL 格式错误：域名格式不正确
3. URL 格式错误：TLD 不完整（如 .o 而不是 .org）
4. HTTP 4xx 错误：404、403 等客户端错误
5. HTTP 5xx 错误：500、502 等服务器错误
6. 网络错误：DNS 解析失败、连接失败、超时

**元数据：**
- 图标：❌
- 优先级：2
- 负面特征：是

**使用场景：**
- 清理失效书签
- 健康检查
- 质量报告

### 3. internal（内部书签）

**定义：** 浏览器内部地址，仅限本浏览器访问

**检测规则：**
1. chrome:// 协议（Chrome 内部页面）
2. chrome-extension:// 协议（扩展程序页面）
3. about: 协议（浏览器关于页面）
4. file:// 协议（本地文件系统）
5. edge:// 协议（Edge 浏览器）
6. brave:// 协议（Brave 浏览器）

**元数据：**
- 图标：🔒
- 优先级：3
- 负面特征：否

**使用场景：**
- 识别内部书签
- 导出时排除
- 分类管理

### 4. outdated（过时书签）⭐ 新增

**定义：** 超过 1 年未访问的书签

**检测规则：**
1. 超过 365 天未访问（基于 lastVisited）
2. 如果没有 lastVisited，使用 dateAdded 判断
3. 文件夹不检测此特征

**元数据：**
- 图标：📅
- 优先级：4
- 负面特征：是

**使用场景：**
- 清理不再使用的书签
- 定期整理书签库
- 识别过时内容

**示例：**
```typescript
// 检测逻辑
function isOutdatedBookmark(record: BookmarkRecord): boolean {
  const now = Date.now()
  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  
  if (record.lastVisited && record.lastVisited > 0) {
    return now - record.lastVisited > oneYearMs
  }
  
  if (record.dateAdded && record.dateAdded > 0) {
    return now - record.dateAdded > oneYearMs
  }
  
  return false
}
```

### 5. untagged（未分类书签）⭐ 新增

**定义：** 直接在根目录或书签栏，未整理到文件夹

**检测规则：**
1. 直接在根目录（parentId 为 "0"）
2. 直接在书签栏（parentId 为 "1"）
3. 路径深度 <= 1
4. 文件夹不检测此特征

**元数据：**
- 图标：📂
- 优先级：5
- 负面特征：是

**使用场景：**
- 提醒用户整理书签
- 书签健康检查
- 改善书签组织结构

**示例：**
```typescript
// 检测逻辑
function isUntaggedBookmark(record: BookmarkRecord): boolean {
  // 检查 parentId
  if (record.parentId === '0' || record.parentId === '1') {
    return true
  }
  
  // 检查路径深度
  if (record.pathIds && record.pathIds.length <= 1) {
    return true
  }
  
  return false
}
```

### 6. untitled（无标题书签）⭐ 新增

**定义：** 标题为空或等于 URL，未添加有意义的标题

**检测规则：**
1. 标题为空字符串或只包含空格
2. 标题等于 URL（未自定义标题）
3. 标题为默认值（"Untitled"、"无标题"等）
4. 文件夹不检测此特征

**元数据：**
- 图标：✏️
- 优先级：6
- 负面特征：是

**使用场景：**
- 提醒用户添加标题
- 改善书签可读性
- 书签质量检查

**示例：**
```typescript
// 检测逻辑
function isUntitledBookmark(record: BookmarkRecord): boolean {
  const title = record.title?.trim() || ''
  const url = record.url || ''
  
  // 标题为空
  if (!title) return true
  
  // 标题等于 URL
  if (title === url) return true
  
  // 标题为默认值
  const defaultTitles = ['untitled', 'no title', 'new bookmark', '无标题', '新建书签', '未命名']
  if (defaultTitles.includes(title.toLowerCase())) return true
  
  return false
}
```

## API 使用

### 获取特征元数据

```typescript
import { getTraitMetadata } from '@/core/bookmark/trait-rules'

const metadata = getTraitMetadata('duplicate')
console.log(metadata.name)        // "重复书签"
console.log(metadata.description) // "URL 完全相同的书签（从第二个开始）"
console.log(metadata.icon)        // "🔄"
```

### 格式化特征标签

```typescript
import { formatTraitTag } from '@/core/bookmark/trait-rules'

const text1 = formatTraitTag('duplicate', true)  // "🔄 重复书签"
const text2 = formatTraitTag('duplicate', false) // "重复书签"
```

### 获取详细描述

```typescript
import { getTraitDetailedDescription } from '@/core/bookmark/trait-rules'

const description = getTraitDetailedDescription('invalid')
// 返回：
// 无法正常访问的书签
//
// 检测规则：
// 1. URL 格式错误：协议不是 http/https
// 2. URL 格式错误：域名格式不正确
// ...
```

### 排序特征标签

```typescript
import { sortTraitTags } from '@/core/bookmark/trait-rules'

const tags = ['internal', 'duplicate', 'invalid']
const sorted = sortTraitTags(tags)
// 返回：['duplicate', 'invalid', 'internal']（按优先级排序）
```

### 获取负面特征

```typescript
import { getNegativeTraitTags } from '@/core/bookmark/trait-rules'

const negativeTags = getNegativeTraitTags()
// 返回：['duplicate', 'invalid', 'outdated', 'untagged', 'untitled']
```

## 如何新增特征

### 步骤 1：更新类型定义

```typescript
// frontend/src/core/bookmark/trait-rules.ts
export type TraitTag = 'duplicate' | 'invalid' | 'internal' | 'new-trait'
```

### 步骤 2：添加特征元数据

```typescript
export const TRAIT_RULES: Record<TraitTag, TraitMetadata> = {
  // ... 现有特征
  
  'new-trait': {
    id: 'new-trait',
    name: '新特征',
    description: '新特征的描述',
    icon: '🆕',
    priority: 4,
    isNegative: false,
    detectionRules: [
      '检测规则 1',
      '检测规则 2'
    ]
  }
}
```

### 步骤 3：更新优先级顺序

```typescript
export const TRAIT_TAG_ORDER: TraitTag[] = [
  'duplicate',
  'invalid',
  'internal',
  'new-trait'
]
```

### 步骤 4：实现检测逻辑

在 `bookmark-trait-service.ts` 的 `evaluateBookmarkTraits()` 函数中添加检测逻辑：

```typescript
function evaluateBookmarkTraits(
  record: BookmarkRecord,
  metadata: CrawlMetadataRecord | undefined,
  duplicateInfo: { ... }
): BookmarkTraitEvaluation {
  // ... 现有逻辑
  
  // 新特征检测
  if (shouldHaveNewTrait(record, metadata)) {
    addTag('new-trait', '检测到新特征')
  }
  
  // ...
}
```

### 步骤 5：更新查询服务

`bookmarkTraitQueryService` 会自动支持新特征，无需修改。

### 步骤 6：更新 UI

在需要显示特征的地方使用 `formatTraitTag()` 或 `getTraitMetadata()`：

```vue
<template>
  <div v-for="tag in bookmark.traitTags" :key="tag">
    {{ formatTraitTag(tag) }}
  </div>
</template>

<script setup lang="ts">
import { formatTraitTag } from '@/core/bookmark/trait-rules'
</script>
```

## 架构优势

### 1. 单一数据源

所有特征定义都在 `trait-rules.ts` 中，避免了多处重复定义：

❌ **修改前：**
- `bookmark-trait-service.ts` 中定义 `TraitTag`
- `bookmark-record.ts` 中重复定义 `TraitTag`
- `trait-detection-worker.ts` 中再次定义 `TraitTag`

✅ **修改后：**
- 只在 `trait-rules.ts` 中定义一次
- 其他地方通过 `import` 使用

### 2. 易于维护

新增特征只需修改一个文件，所有使用的地方自动更新。

### 3. 自文档化

每个特征都有完整的元数据和检测规则，代码即文档。

### 4. 类型安全

TypeScript 确保所有特征使用都是类型安全的。

## 相关文件

- `frontend/src/domain/bookmark/trait-rules.ts` - 特征规则字典（核心）
- `frontend/src/services/bookmark-trait-service.ts` - 特征检测服务
- `frontend/src/domain/bookmark/bookmark-trait-query-service.ts` - 特征查询服务
- `frontend/src/infrastructure/indexeddb/types/bookmark-record.ts` - 书签记录类型

## 最佳实践

1. **不要硬编码特征名称**：使用 `formatTraitTag()` 而不是直接写 "重复书签"
2. **使用类型安全的 API**：使用 `TraitTag` 类型而不是 `string`
3. **利用元数据**：使用 `TRAIT_RULES` 获取图标、描述等信息
4. **保持一致性**：所有特征相关的代码都应该引用 `trait-rules.ts`

## 示例：完整的特征显示组件

```vue
<template>
  <div class="trait-badge" :class="`trait-${trait}`">
    <span class="trait-icon">{{ metadata.icon }}</span>
    <span class="trait-name">{{ metadata.name }}</span>
    <span 
      v-if="showDescription" 
      class="trait-description"
      :title="detailedDescription"
    >
      {{ metadata.description }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  getTraitMetadata, 
  getTraitDetailedDescription,
  type TraitTag 
} from '@/core/bookmark/trait-rules'

const props = defineProps<{
  trait: TraitTag
  showDescription?: boolean
}>()

const metadata = computed(() => getTraitMetadata(props.trait))
const detailedDescription = computed(() => getTraitDetailedDescription(props.trait))
</script>

<style scoped>
.trait-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.trait-duplicate {
  background-color: #fef3c7;
  color: #92400e;
}

.trait-invalid {
  background-color: #fee2e2;
  color: #991b1b;
}

.trait-internal {
  background-color: #e0e7ff;
  color: #3730a3;
}
</style>
```
