# Store 统一错误处理策略

## 🎯 设计目标

### 1. **统一性**

- 所有Store使用相同的错误处理模式
- 统一的错误类型和分类
- 一致的错误消息格式

### 2. **用户友好**

- 提供清晰的错误提示
- 支持错误恢复操作
- 避免技术术语暴露给用户

### 3. **开发友好**

- 便于调试和日志记录
- 支持错误追踪和监控
- 易于扩展和维护

## 🏗️ 错误处理架构

### 1. **错误类型定义**

```typescript
// 基础错误类型
export enum StoreErrorType {
  // 网络相关
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 数据相关
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',

  // 权限相关
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  // 业务逻辑相关
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',

  // 系统相关
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'LOW', // 不影响核心功能
  MEDIUM = 'MEDIUM', // 影响部分功能
  HIGH = 'HIGH', // 影响核心功能
  CRITICAL = 'CRITICAL' // 系统无法正常工作
}

// 错误恢复策略
export enum RecoveryStrategy {
  NONE = 'NONE', // 无恢复策略
  RETRY = 'RETRY', // 自动重试
  FALLBACK = 'FALLBACK', // 降级处理
  MANUAL = 'MANUAL' // 需要用户手动处理
}
```

### 2. **统一错误类**

```typescript
export class StoreError extends Error {
  constructor(
    public type: StoreErrorType,
    public severity: ErrorSeverity,
    public recoveryStrategy: RecoveryStrategy,
    public userMessage: string,
    public technicalMessage: string,
    public context?: Record<string, unknown>,
    public originalError?: Error
  ) {
    super(technicalMessage)
    this.name = 'StoreError'
  }

  // 创建用户友好的错误消息
  static createUserFriendlyMessage(
    type: StoreErrorType,
    context?: Record<string, unknown>
  ): string {
    const messages = {
      [StoreErrorType.NETWORK_ERROR]: '网络连接异常，请检查网络设置',
      [StoreErrorType.TIMEOUT_ERROR]: '操作超时，请稍后重试',
      [StoreErrorType.DATA_VALIDATION_ERROR]: '数据格式错误，请检查输入',
      [StoreErrorType.DATA_NOT_FOUND]: '未找到相关数据',
      [StoreErrorType.DATA_SYNC_ERROR]: '数据同步失败，请刷新页面',
      [StoreErrorType.PERMISSION_DENIED]: '权限不足，请检查权限设置',
      [StoreErrorType.AUTHENTICATION_ERROR]: '身份验证失败，请重新登录',
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: '操作失败，请重试',
      [StoreErrorType.OPERATION_FAILED]: '操作执行失败',
      [StoreErrorType.SYSTEM_ERROR]: '系统错误，请联系技术支持',
      [StoreErrorType.UNKNOWN_ERROR]: '未知错误，请重试'
    }

    return messages[type] || messages[StoreErrorType.UNKNOWN_ERROR]
  }
}
```

### 3. **错误处理服务**

```typescript
export class StoreErrorHandler {
  private static instance: StoreErrorHandler
  private errorHistory: StoreError[] = []
  private maxHistorySize = 100

  static getInstance(): StoreErrorHandler {
    if (!StoreErrorHandler.instance) {
      StoreErrorHandler.instance = new StoreErrorHandler()
    }
    return StoreErrorHandler.instance
  }

  // 处理错误
  async handleError(
    error: Error | StoreError,
    context?: Record<string, unknown>
  ): Promise<StoreError> {
    const storeError = this.normalizeError(error, context)

    // 记录错误
    this.recordError(storeError)

    // 记录日志
    this.logError(storeError)

    // 执行恢复策略
    await this.executeRecoveryStrategy(storeError)

    return storeError
  }

  // 标准化错误
  private normalizeError(
    error: Error | StoreError,
    context?: Record<string, unknown>
  ): StoreError {
    if (error instanceof StoreError) {
      return error
    }

    // 根据错误类型和消息推断错误类型
    const errorType = this.inferErrorType(error)
    const severity = this.inferSeverity(errorType)
    const recoveryStrategy = this.inferRecoveryStrategy(errorType)

    return new StoreError(
      errorType,
      severity,
      recoveryStrategy,
      StoreError.createUserFriendlyMessage(errorType, context),
      error.message,
      context,
      error
    )
  }

  // 推断错误类型
  private inferErrorType(error: Error): StoreErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('network') || message.includes('fetch')) {
      return StoreErrorType.NETWORK_ERROR
    }
    if (message.includes('timeout')) {
      return StoreErrorType.TIMEOUT_ERROR
    }
    if (message.includes('permission') || message.includes('denied')) {
      return StoreErrorType.PERMISSION_DENIED
    }
    if (message.includes('auth') || message.includes('token')) {
      return StoreErrorType.AUTHENTICATION_ERROR
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return StoreErrorType.DATA_VALIDATION_ERROR
    }
    if (message.includes('not found') || message.includes('404')) {
      return StoreErrorType.DATA_NOT_FOUND
    }

    return StoreErrorType.UNKNOWN_ERROR
  }

  // 推断严重程度
  private inferSeverity(type: StoreErrorType): ErrorSeverity {
    const severityMap = {
      [StoreErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.TIMEOUT_ERROR]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_VALIDATION_ERROR]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_NOT_FOUND]: ErrorSeverity.LOW,
      [StoreErrorType.DATA_SYNC_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.PERMISSION_DENIED]: ErrorSeverity.HIGH,
      [StoreErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: ErrorSeverity.MEDIUM,
      [StoreErrorType.OPERATION_FAILED]: ErrorSeverity.MEDIUM,
      [StoreErrorType.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
      [StoreErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
    }

    return severityMap[type] || ErrorSeverity.MEDIUM
  }

  // 推断恢复策略
  private inferRecoveryStrategy(type: StoreErrorType): RecoveryStrategy {
    const strategyMap = {
      [StoreErrorType.NETWORK_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.DATA_VALIDATION_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.DATA_NOT_FOUND]: RecoveryStrategy.FALLBACK,
      [StoreErrorType.DATA_SYNC_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.PERMISSION_DENIED]: RecoveryStrategy.MANUAL,
      [StoreErrorType.AUTHENTICATION_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: RecoveryStrategy.RETRY,
      [StoreErrorType.OPERATION_FAILED]: RecoveryStrategy.RETRY,
      [StoreErrorType.SYSTEM_ERROR]: RecoveryStrategy.MANUAL,
      [StoreErrorType.UNKNOWN_ERROR]: RecoveryStrategy.RETRY
    }

    return strategyMap[type] || RecoveryStrategy.RETRY
  }

  // 记录错误
  private recordError(error: StoreError): void {
    this.errorHistory.push(error)
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }
  }

  // 记录日志
  private logError(error: StoreError): void {
    const logLevel = this.getLogLevel(error.severity)
    logger[logLevel]('StoreErrorHandler', error.technicalMessage, {
      type: error.type,
      severity: error.severity,
      context: error.context,
      originalError: error.originalError
    })
  }

  // 获取日志级别
  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error'
      default:
        return 'warn'
    }
  }

  // 执行恢复策略
  private async executeRecoveryStrategy(error: StoreError): Promise<void> {
    switch (error.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        // 自动重试逻辑
        break
      case RecoveryStrategy.FALLBACK:
        // 降级处理逻辑
        break
      case RecoveryStrategy.MANUAL:
        // 需要用户手动处理
        break
      case RecoveryStrategy.NONE:
      default:
        // 无恢复策略
        break
    }
  }

  // 获取错误历史
  getErrorHistory(): StoreError[] {
    return [...this.errorHistory]
  }

  // 清除错误历史
  clearErrorHistory(): void {
    this.errorHistory = []
  }
}
```

## 🔧 Store 错误处理集成

### 1. **错误处理中间件**

```typescript
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const storeError = await StoreErrorHandler.getInstance().handleError(
        error as Error,
        context
      )
      throw storeError
    }
  }) as T
}
```

### 2. **Store 错误状态管理**

```typescript
export interface StoreErrorState {
  lastError: StoreError | null
  errorHistory: StoreError[]
  isRecovering: boolean
  recoveryProgress: number
}

export function createErrorState(): StoreErrorState {
  return {
    lastError: null,
    errorHistory: [],
    isRecovering: false,
    recoveryProgress: 0
  }
}
```

### 3. **错误处理 Hook**

```typescript
export function useStoreErrorHandling() {
  const errorHandler = StoreErrorHandler.getInstance()

  const handleError = async (
    error: Error | StoreError,
    context?: Record<string, unknown>
  ) => {
    return await errorHandler.handleError(error, context)
  }

  const clearErrors = () => {
    errorHandler.clearErrorHistory()
  }

  const getErrorHistory = () => {
    return errorHandler.getErrorHistory()
  }

  return {
    handleError,
    clearErrors,
    getErrorHistory
  }
}
```

## 📋 实施步骤

### 1. **创建错误处理基础设施**

- [ ] 创建错误类型定义
- [ ] 实现StoreError类
- [ ] 实现StoreErrorHandler服务
- [ ] 创建错误处理中间件

### 2. **集成到现有Store**

- [ ] 更新bookmarkStore.ts
- [ ] 更新management-store.ts
- [ ] 更新popup-store-indexeddb.ts
- [ ] 更新ui-store.ts

### 3. **测试和验证**

- [ ] 单元测试
- [ ] 集成测试
- [ ] 错误场景测试
- [ ] 用户体验测试

## 🎯 预期收益

### 1. **开发体验**

- 统一的错误处理模式
- 更好的错误调试信息
- 简化的错误处理代码

### 2. **用户体验**

- 清晰的错误提示
- 自动错误恢复
- 更好的错误反馈

### 3. **系统稳定性**

- 更好的错误监控
- 自动错误恢复
- 减少系统崩溃
