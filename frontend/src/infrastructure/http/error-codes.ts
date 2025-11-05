/**
 * 后端错误码到前端文案的映射
 *
 * 前后端约定：后端只返回错误码（error 字段），前端根据错误码显示对应的文案
 * 这样可以：
 * 1. 统一管理所有错误文案
 * 2. 便于国际化（i18n）
 * 3. 减少前后端耦合
 * 4. 前端可以根据上下文显示更友好的错误信息
 */

export interface ErrorCodeMap {
  [key: string]: string
}

/**
 * 认证相关错误码
 */
const AUTH_ERROR_CODES: ErrorCodeMap = {
  // 注册相关
  email_already_registered: '该邮箱已被注册',
  invalid_email: '邮箱格式不正确',
  weak_password: '密码不符合安全要求，必须至少10位，包含大小写字母、数字和符号',

  // 登录相关
  'invalid email or password': '邮箱或密码错误',
  'account temporarily locked': '账户暂时被锁定，请稍后再试',

  // Token 相关
  'invalid refreshToken': '刷新令牌无效',
  'expired refreshToken': '刷新令牌已过期',
  invalid_token: '令牌无效',
  'invalid or expired token': '令牌无效或已过期',
  'invalid old password': '原密码错误',

  // 授权相关
  unauthorized: '未授权，请先登录',
  forbidden: '没有权限访问该资源',

  // 系统错误
  'database not configured': '数据库未配置',
  'missing refreshToken': '缺少刷新令牌',
  'missing code': '缺少授权码',
  'missing code_verifier': '缺少验证码',
  'missing redirect_uri': '缺少重定向地址',
  'invalid redirect_uri': '无效的重定向地址',

  // OAuth 相关
  'dev-login disabled': '开发者登录已禁用',
  'dev auth disabled': '开发者认证已禁用'
}

/**
 * 通用错误码
 */
const GENERAL_ERROR_CODES: ErrorCodeMap = {
  'Method not allowed': '请求方法不允许',
  'missing prompt or messages': '缺少提示或消息',
  'missing text': '缺少文本内容',
  'missing url': '缺少 URL',
  'missing text or vector': '缺少文本或向量',
  'missing vectors': '缺少向量',
  'no valid vectors': '没有有效的向量'
}

/**
 * 所有错误码映射（合并所有错误码）
 */
export const ERROR_CODE_MAP: ErrorCodeMap = {
  ...AUTH_ERROR_CODES,
  ...GENERAL_ERROR_CODES
}

/**
 * 根据错误码获取错误文案
 *
 * @param errorCode - 后端返回的错误码
 * @param fallback - 如果找不到对应的错误码，返回的默认文案
 * @returns 错误文案
 */
export function getErrorMessage(
  errorCode: string | undefined,
  fallback = '请求失败，请稍后重试'
): string {
  if (!errorCode) {
    return fallback
  }

  // 直接匹配错误码
  if (ERROR_CODE_MAP[errorCode]) {
    return ERROR_CODE_MAP[errorCode]
  }

  // 尝试匹配包含错误码的字符串（兼容性处理）
  for (const [code, message] of Object.entries(ERROR_CODE_MAP)) {
    if (errorCode.includes(code)) {
      return message
    }
  }

  // 如果找不到匹配，返回原始错误码或默认文案
  return errorCode || fallback
}

/**
 * 从错误响应中提取错误码
 *
 * @param errorData - 错误响应数据
 * @returns 错误码
 */
export function extractErrorCode(errorData: unknown): string | undefined {
  if (!errorData || typeof errorData !== 'object') {
    return undefined
  }

  const data = errorData as { error?: string; code?: string }
  return data.error || data.code
}
