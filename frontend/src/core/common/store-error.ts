/**
 * Store 统一错误处理
 *
 * 提供统一的错误类型定义、错误处理服务和错误恢复机制
 */

// 错误类型定义
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

/**
 * 统一错误类
 */
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

  /**
   * 创建用户友好的错误消息
   */
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

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      type: this.type,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      originalError: this.originalError?.message
    }
  }
}

/**
 * Store 错误状态接口
 */
export interface StoreErrorState {
  lastError: StoreError | null
  errorHistory: StoreError[]
  isRecovering: boolean
  recoveryProgress: number
}

/**
 * 创建错误状态
 */
export function createErrorState(): StoreErrorState {
  return {
    lastError: null,
    errorHistory: [],
    isRecovering: false,
    recoveryProgress: 0
  }
}
