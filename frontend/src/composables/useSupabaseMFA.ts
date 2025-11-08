/**
 * Supabase MFA 管理 Composable
 *
 * 功能：
 * - 检查 MFA 状态
 * - 启用 MFA（TOTP）
 * - 禁用 MFA
 * - 验证 MFA 设置
 */

import { ref, computed } from 'vue'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'

/**
 * MFA 因子类型
 */
interface MFAFactor {
  id: string
  friendly_name?: string
  factor_type: 'phone' | 'totp' | 'webauthn'
  status: 'verified' | 'unverified'
  created_at: string
  updated_at: string
}

/**
 * 注册 MFA 的返回数据
 */
interface MFAEnrollData {
  id: string
  type: 'totp'
  friendly_name?: string
  totp: {
    qr_code: string
    secret: string
    uri: string
  }
}

export function useSupabaseMFA() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const factors = ref<MFAFactor[]>([])
  const enrollingFactor = ref<MFAEnrollData | null>(null)
  const qrCode = ref<string | null>(null)
  const verificationCode = ref<string>('')
  const challengeId = ref<string | null>(null)

  /**
   * 检查 MFA 状态
   */
  const checkMFAStatus = async () => {
    if (!isSupabaseConfigured()) {
      error.value = 'Supabase 未配置'
      return
    }

    try {
      loading.value = true
      error.value = null

      const { data, error: factorsError } =
        await supabase.auth.mfa.listFactors()

      if (factorsError) {
        throw factorsError
      }

      // Supabase 返回的数据结构是 { all: [...] }
      factors.value = (data?.all || []) as MFAFactor[]
      console.log('[useSupabaseMFA] MFA 状态:', {
        factors: factors.value,
        hasMFA: factors.value.length > 0
      })
    } catch (err) {
      console.error('[useSupabaseMFA] ❌ 检查 MFA 状态失败:', err)
      error.value = err instanceof Error ? err.message : '检查 MFA 状态失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 开始启用 MFA（生成二维码）
   */
  const startEnrollMFA = async () => {
    if (!isSupabaseConfigured()) {
      error.value = 'Supabase 未配置'
      return
    }

    try {
      loading.value = true
      error.value = null
      qrCode.value = null
      enrollingFactor.value = null

      // 开始注册 TOTP 因子
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AcuityBookmarks'
      })

      if (enrollError) {
        throw enrollError
      }

      // Supabase 返回的数据结构是 { id, type, totp: { qr_code, secret, uri } }
      enrollingFactor.value = data as MFAEnrollData
      qrCode.value = data?.totp?.qr_code || null

      console.log('[useSupabaseMFA] ✅ MFA 注册开始:', {
        factorId: data?.id,
        hasQRCode: !!qrCode.value
      })
    } catch (err) {
      console.error('[useSupabaseMFA] ❌ 开始启用 MFA 失败:', err)
      error.value = err instanceof Error ? err.message : '启用 MFA 失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 验证并完成 MFA 设置
   */
  const verifyAndEnableMFA = async (code: string) => {
    if (!isSupabaseConfigured() || !enrollingFactor.value) {
      error.value = '请先开始启用 MFA'
      return
    }

    try {
      loading.value = true
      error.value = null

      // 先创建 challenge（验证需要 challengeId）
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollingFactor.value.id
        })

      if (challengeError) {
        throw challengeError
      }

      if (!challengeData?.id) {
        throw new Error('无法创建验证挑战')
      }

      challengeId.value = challengeData.id

      // 验证验证码（需要 challengeId）
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollingFactor.value.id,
        challengeId: challengeId.value,
        code
      })

      if (verifyError) {
        throw verifyError
      }

      // 验证成功后，刷新 MFA 状态
      await checkMFAStatus()

      // 清除临时数据
      qrCode.value = null
      enrollingFactor.value = null
      verificationCode.value = ''
      challengeId.value = null

      console.log('[useSupabaseMFA] ✅ MFA 验证成功并已启用')
      return true
    } catch (err) {
      console.error('[useSupabaseMFA] ❌ 验证 MFA 失败:', err)
      error.value = err instanceof Error ? err.message : '验证码错误，请重试'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 禁用 MFA
   */
  const disableMFA = async (factorId: string) => {
    if (!isSupabaseConfigured()) {
      error.value = 'Supabase 未配置'
      return
    }

    try {
      loading.value = true
      error.value = null

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId
      })

      if (unenrollError) {
        throw unenrollError
      }

      // 刷新 MFA 状态
      await checkMFAStatus()

      console.log('[useSupabaseMFA] ✅ MFA 已禁用')
    } catch (err) {
      console.error('[useSupabaseMFA] ❌ 禁用 MFA 失败:', err)
      error.value = err instanceof Error ? err.message : '禁用 MFA 失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 计算属性：是否已启用 MFA
   */
  const isMFAEnabled = computed(() => {
    return factors.value.length > 0
  })

  /**
   * 计算属性：TOTP 因子
   */
  const totpFactor = computed(() => {
    return factors.value.find(
      (factor: MFAFactor) => factor.factor_type === 'totp'
    )
  })

  return {
    // 状态
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    factors: computed(() => factors.value),
    qrCode: computed(() => qrCode.value),
    verificationCode,
    isMFAEnabled,
    totpFactor,

    // 方法
    checkMFAStatus,
    startEnrollMFA,
    verifyAndEnableMFA,
    disableMFA
  }
}
