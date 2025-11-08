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
import type { AuthFactor } from '@supabase/supabase-js'

export function useSupabaseMFA() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const factors = ref<AuthFactor[]>([])
  const enrollingFactor = ref<AuthFactor | null>(null)
  const qrCode = ref<string | null>(null)
  const verificationCode = ref<string>('')

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

      factors.value = data.factors || []
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

      enrollingFactor.value = data.factor
      qrCode.value = data.qr_code || null

      console.log('[useSupabaseMFA] ✅ MFA 注册开始:', {
        factorId: data.factor?.id,
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

      // 验证验证码
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollingFactor.value.id,
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
    return factors.value.find(factor => factor.factor_type === 'totp')
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
