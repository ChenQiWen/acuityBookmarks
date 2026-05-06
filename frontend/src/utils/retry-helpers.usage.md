# 重试辅助工具使用示例

## 基本用法

### 1. 使用 `withRetry` 包装异步函数

```typescript
import { withRetry } from '@/utils/retry-helpers'

async function fetchData() {
  const data = await withRetry(
    () => fetch('/api/data').then(res => res.json()),
    {
      maxRetries: 3,
      delay: 1000,
      backoffFactor: 2,
      operationName: '获取数据'
    }
  )
  return data
}
```

**执行流程：**
- 第 1 次尝试：立即执行
- 第 2 次尝试：延迟 1000ms（1秒）
- 第 3 次尝试：延迟 2000ms（2秒）
- 第 4 次尝试：延迟 4000ms（4秒）

---

### 2. 使用 `createRetryWrapper` 创建包装函数

```typescript
import { createRetryWrapper } from '@/utils/retry-helpers'

// 原始函数
async function fetchUser(userId: number) {
  const response = await fetch(`/api/users/${userId}`)
  return response.json()
}

// 创建带重试的版本
const fetchUserWithRetry = createRetryWrapper(fetchUser, {
  maxRetries: 3,
  delay: 500,
  operationName: '获取用户信息'
})

// 使用
const user = await fetchUserWithRetry(123)
```

---

### 3. 自定义重试条件

```typescript
import { withRetry, isNetworkError } from '@/utils/retry-helpers'

const data = await withRetry(
  () => fetchData(),
  {
    maxRetries: 5,
    delay: 1000,
    // 只有网络错误才重试
    shouldRetry: (error) => isNetworkError(error),
    operationName: '获取数据'
  }
)
```

---

## 错误类型判断

### 判断网络错误

```typescript
import { isNetworkError } from '@/utils/retry-helpers'

try {
  await fetch('/api/data')
} catch (error) {
  if (isNetworkError(error)) {
    console.log('网络错误，可以重试')
  }
}
```

### 判断数据库错误

```typescript
import { isDatabaseError } from '@/utils/retry-helpers'

try {
  await indexedDB.open('mydb')
} catch (error) {
  if (isDatabaseError(error)) {
    console.log('数据库错误，可以重试')
  }
}
```

### 通用重试判断

```typescript
import { shouldRetryError } from '@/utils/retry-helpers'

try {
  await someOperation()
} catch (error) {
  if (shouldRetryError(error)) {
    console.log('应该重试')
  } else {
    console.log('不应该重试')
  }
}
```

---

## 实际应用场景

### 场景 1：IndexedDB 查询

```typescript
import { withRetry, shouldRetryError } from '@/utils/retry-helpers'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

async function getAllBookmarks() {
  return withRetry(
    () => indexedDBManager.getAllBookmarks(),
    {
      maxRetries: 3,
      delay: 500,
      shouldRetry: shouldRetryError,
      operationName: '获取所有书签'
    }
  )
}
```

### 场景 2：网络请求

```typescript
import { withRetry, isNetworkError } from '@/utils/retry-helpers'

async function syncBookmarks() {
  return withRetry(
    async () => {
      const response = await fetch('/api/bookmarks/sync', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      return response.json()
    },
    {
      maxRetries: 5,
      delay: 2000,
      backoffFactor: 2,
      shouldRetry: isNetworkError,
      operationName: '同步书签'
    }
  )
}
```

### 场景 3：在 Pinia Store 中使用

```typescript
import { defineStore } from 'pinia'
import { withRetry, shouldRetryError } from '@/utils/retry-helpers'

export const useDataStore = defineStore('data', () => {
  const data = ref(null)
  const isLoading = ref(false)
  const lastError = ref<Error | null>(null)
  
  async function loadData() {
    isLoading.value = true
    lastError.value = null
    
    try {
      data.value = await withRetry(
        () => fetchData(),
        {
          maxRetries: 3,
          delay: 1000,
          shouldRetry: shouldRetryError,
          operationName: '加载数据'
        }
      )
    } catch (error) {
      lastError.value = error instanceof Error ? error : new Error(String(error))
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  return { data, isLoading, lastError, loadData }
})
```

---

## 配置选项

### RetryOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxRetries` | `number` | `3` | 最大重试次数 |
| `delay` | `number` | `1000` | 初始延迟（毫秒） |
| `backoffFactor` | `number` | `2` | 延迟倍增因子（指数退避） |
| `shouldRetry` | `(error: unknown) => boolean` | `() => true` | 是否应该重试的判断函数 |
| `operationName` | `string` | `'operation'` | 操作名称（用于日志） |

---

## 日志输出

重试工具会自动记录日志：

```
[RetryHelper] 🔄 重试 获取数据 (第 1/3 次)，延迟 1000ms
[RetryHelper] ⚠️ 获取数据 失败 (第 1 次尝试)
[RetryHelper] 🔄 重试 获取数据 (第 2/3 次)，延迟 2000ms
[RetryHelper] ✅ 获取数据 重试成功 (第 2 次尝试)
```

---

## 最佳实践

### ✅ 推荐

1. **为每个操作指定有意义的名称**
   ```typescript
   withRetry(() => fetchData(), { operationName: '获取用户书签' })
   ```

2. **根据错误类型决定是否重试**
   ```typescript
   withRetry(() => fetchData(), { shouldRetry: isNetworkError })
   ```

3. **使用合理的重试次数和延迟**
   ```typescript
   // 网络请求：多次重试，较长延迟
   withRetry(() => fetch('/api'), { maxRetries: 5, delay: 2000 })
   
   // 数据库操作：少次重试，较短延迟
   withRetry(() => db.query(), { maxRetries: 3, delay: 500 })
   ```

### ❌ 避免

1. **不要对所有错误都重试**
   ```typescript
   // ❌ 错误：参数错误不应该重试
   withRetry(() => fetchUser(-1), { maxRetries: 10 })
   ```

2. **不要设置过多的重试次数**
   ```typescript
   // ❌ 错误：重试太多次会阻塞用户
   withRetry(() => fetchData(), { maxRetries: 100 })
   ```

3. **不要忽略错误**
   ```typescript
   // ❌ 错误：应该处理最终失败的情况
   withRetry(() => fetchData()).catch(() => {})
   ```

---

## 与其他工具配合使用

### 配合请求去重

```typescript
import { withRetry } from '@/utils/retry-helpers'
import { requestDeduplication } from '@/utils/request-deduplication'

async function fetchData() {
  return requestDeduplication.execute(
    'fetch-data',
    () => withRetry(
      () => fetch('/api/data').then(res => res.json()),
      { maxRetries: 3, operationName: '获取数据' }
    )
  )
}
```

### 配合可取消 Promise

```typescript
import { withRetry } from '@/utils/retry-helpers'
import { createCancellablePromise } from '@/utils/request-deduplication'

const promise = createCancellablePromise((resolve, reject, onCancel) => {
  const controller = new AbortController()
  
  onCancel(() => controller.abort())
  
  withRetry(
    () => fetch('/api/data', { signal: controller.signal }),
    { maxRetries: 3 }
  ).then(resolve, reject)
})

// 取消请求
promise.cancel()
```
