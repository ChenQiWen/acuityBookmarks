# 组件迁移指南

## 🎯 迁移目标

将现有组件从旧的 Store 架构迁移到新的精简 Store 架构，实现：

- 统一的错误处理
- 清晰的职责分离
- 简化的状态管理

## 📋 迁移步骤

### 1. **更新 Store 导入**

#### 旧方式

```typescript
import { useManagementStore } from '@/stores/management-store'
import { useBookmarkStore } from '@/stores/bookmarkStore'
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'
import { useUIStore } from '@/stores/ui-store'
```

#### 新方式

```typescript
import {
  useManagementStore,
  useBookmarkStore,
  usePopupStore,
  useUIStore
} from '@/stores'
```

### 2. **错误处理更新**

#### 旧方式

```typescript
// 在组件中
try {
  await someOperation()
} catch (error) {
  console.error('操作失败:', error)
  // 手动处理错误
}
```

#### 新方式

```typescript
// 在组件中
import { useErrorHandling } from '@/infrastructure/error-handling'

const { handleError } = useErrorHandling()

try {
  await someOperation()
} catch (error) {
  await handleError(error, { component: 'ComponentName' })
}
```

### 3. **状态访问更新**

#### 旧方式

```typescript
const managementStore = useManagementStore()
const isLoading = managementStore.isPageLoading
const lastError = managementStore.lastError
```

#### 新方式

```typescript
const managementStore = useManagementStore()
const isLoading = managementStore.isPageLoading
const hasError = managementStore.hasError
const userErrorMessage = managementStore.userErrorMessage
```

### 4. **方法调用更新**

#### 旧方式

```typescript
// 直接调用Store方法
await managementStore.performCleanup()
await bookmarkStore.fetchRootNodes()
```

#### 新方式

```typescript
// Store方法已经包含错误处理
await managementStore.performCleanup()
await bookmarkStore.fetchRootNodes()
```

## 🔧 具体组件迁移

### 1. **Management.vue 迁移**

#### 主要变更

- 更新 Store 导入
- 移除手动错误处理
- 使用新的错误状态

#### 迁移代码

```typescript
// 旧代码
import { useManagementStore } from '@/stores/management-store'

const managementStore = useManagementStore()
const { isPageLoading, lastError } = storeToRefs(managementStore)

// 新代码
import { useManagementStore } from '@/stores'

const managementStore = useManagementStore()
const { isPageLoading, hasError, userErrorMessage } =
  storeToRefs(managementStore)
```

### 2. **Popup.vue 迁移**

#### 主要变更

- 更新 Store 导入
- 使用新的错误处理
- 简化状态访问

#### 迁移代码

```typescript
// 旧代码
import { usePopupStoreIndexedDB } from '@/stores/popup-store-indexeddb'

const popupStore = usePopupStoreIndexedDB()
const { isLoading, lastError } = storeToRefs(popupStore)

// 新代码
import { usePopupStore } from '@/stores'

const popupStore = usePopupStore()
const { isLoading, hasError, userErrorMessage } = storeToRefs(popupStore)
```

### 3. **其他组件迁移**

#### 通用模式

```typescript
// 1. 更新导入
import { useUIStore } from '@/stores'

// 2. 使用新的错误状态
const uiStore = useUIStore()
const { hasError, userErrorMessage } = storeToRefs(uiStore)

// 3. 移除手动错误处理
// 旧代码中的 try-catch 可以简化，因为Store方法已经包含错误处理
```

## 📝 迁移检查清单

### ✅ 导入更新

- [ ] 更新所有 Store 导入路径
- [ ] 使用新的 Store 名称
- [ ] 移除旧的 Store 导入

### ✅ 错误处理更新

- [ ] 移除手动错误处理代码
- [ ] 使用新的错误状态
- [ ] 添加错误处理 Hook（如需要）

### ✅ 状态访问更新

- [ ] 更新状态属性名称
- [ ] 使用新的计算属性
- [ ] 移除已废弃的状态

### ✅ 方法调用更新

- [ ] 验证方法名称是否变更
- [ ] 检查方法参数是否变更
- [ ] 测试方法功能是否正常

### ✅ 测试验证

- [ ] 功能测试
- [ ] 错误处理测试
- [ ] 性能测试

## 🚨 注意事项

### 1. **向后兼容性**

- 新的 Store 保持了大部分原有接口
- 主要变更在错误处理方面
- 状态属性名称基本保持不变

### 2. **错误处理变更**

- 不再需要手动 try-catch
- 错误状态从 `lastError` 改为 `hasError` + `userErrorMessage`
- 错误处理更加统一和友好

### 3. **性能优化**

- Store 方法已经包含错误处理和重试机制
- 减少了组件中的错误处理代码
- 提高了代码的可维护性

## 🔍 迁移验证

### 1. **功能验证**

```typescript
// 测试基本功能
const store = useManagementStore()
await store.initialize()
expect(store.isPageLoading).toBe(false)
```

### 2. **错误处理验证**

```typescript
// 测试错误处理
const store = useManagementStore()
try {
  await store.performCleanup()
} catch (error) {
  expect(store.hasError).toBe(true)
  expect(store.userErrorMessage).toBeTruthy()
}
```

### 3. **状态同步验证**

```typescript
// 测试状态同步
const store1 = useManagementStore()
const store2 = useManagementStore()
expect(store1.isPageLoading).toBe(store2.isPageLoading)
```

## 📚 参考文档

- [Store 重构总结](./STORE_REFACTOR_SUMMARY.md)
- [错误处理策略](./STORE_ERROR_STRATEGY.md)
- [Store 分析报告](./STORE_ANALYSIS.md)

## 🎯 迁移完成标准

### 1. **代码质量**

- 所有组件使用新的 Store 架构
- 错误处理统一且友好
- 代码简洁且易维护

### 2. **功能完整性**

- 所有原有功能正常工作
- 错误处理更加完善
- 用户体验得到提升

### 3. **性能表现**

- 加载速度不降低
- 错误恢复更加快速
- 状态管理更加高效
