/**
 * Supabase 客户端工具（后端使用）
 *
 * 职责：
 * - 创建 Supabase 管理客户端（使用 service_role key）
 * - 提供订阅和支付记录的 CRUD 操作
 * - 处理 Supabase 错误
 */

import { createClient } from '@supabase/supabase-js'

/**
 * 创建 Supabase 管理客户端
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {object|null} Supabase 客户端实例，如果配置缺失返回 null
 */
export function createSupabaseClient(env) {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Supabase] 配置缺失，无法创建客户端')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * 检查 Supabase 是否已配置
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {boolean} 如果配置完整返回 true
 */
export function hasSupabase(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * 获取用户当前订阅状态
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户 ID (Supabase UUID)
 * @returns {Promise<object|null>} 订阅记录或 null
 */
export async function getUserSubscription(env, userId) {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过查询')
    return null
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Supabase] 查询订阅失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅异常:', error)
    return null
  }
}

/**
 * 获取用户订阅详情
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} userId - 用户 ID
 * @returns {Promise<object|null>} 订阅详情或 null
 */
export async function getSubscriptionDetails(env, userId) {
  if (!hasSupabase(env)) return null

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Supabase] 查询订阅详情失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅详情异常:', error)
    return null
  }
}

/**
 * 插入或更新订阅记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} subscription - 订阅对象
 * @returns {Promise<object>} 更新后的订阅记录
 */
export async function upsertSubscription(env, subscription) {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过插入订阅')
    return { id: subscription.id }
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return { id: subscription.id }

  try {
    // Supabase 会自动生成 UUID，我们使用 lemon_squeezy_subscription_id 作为唯一约束
    // 先检查是否存在
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq(
        'lemon_squeezy_subscription_id',
        subscription.lemon_squeezy_subscription_id
      )
      .maybeSingle()

    const subscriptionData = {
      user_id: subscription.user_id,
      lemon_squeezy_subscription_id: subscription.lemon_squeezy_subscription_id,
      lemon_squeezy_order_id: subscription.lemon_squeezy_order_id || null,
      lemon_squeezy_variant_id: subscription.lemon_squeezy_variant_id || null,
      status: subscription.status,
      tier: subscription.tier,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      cancelled_at: subscription.cancelled_at || null
    }

    let result
    if (existing?.id) {
      // 如果已存在，更新
      const { data, error } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[Supabase] 更新订阅失败:', error)
        throw error
      }
      result = data
    } else {
      // 如果不存在，插入（Supabase 会自动生成 UUID）
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single()

      if (error) {
        console.error('[Supabase] 插入订阅失败:', error)
        throw error
      }
      result = data
    }

    return result
  } catch (error) {
    console.error('[Supabase] 插入订阅异常:', error)
    throw error
  }
}

/**
 * 更新订阅取消状态
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} subscriptionId - 订阅 ID（Supabase UUID 或 lemon_squeezy_subscription_id）
 * @param {boolean} cancelAtPeriodEnd - 是否在周期结束时取消
 * @returns {Promise<object>} 更新后的订阅记录
 */
export async function updateSubscriptionCancelStatus(
  env,
  subscriptionId,
  cancelAtPeriodEnd
) {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过更新订阅')
    return { id: subscriptionId }
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return { id: subscriptionId }

  try {
    // 尝试通过 lemon_squeezy_subscription_id 查找
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('lemon_squeezy_subscription_id', subscriptionId)
      .maybeSingle()

    const targetId = existing?.id || subscriptionId

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetId)
      .select()
      .single()

    if (error) {
      console.error('[Supabase] 更新订阅取消状态失败:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('[Supabase] 更新订阅取消状态异常:', error)
    throw error
  }
}

/**
 * 插入支付记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {object} payment - 支付对象
 * @returns {Promise<object>} 插入的支付记录
 */
export async function insertPaymentRecord(env, payment) {
  if (!hasSupabase(env)) {
    console.warn('[Supabase] 未配置，跳过插入支付记录')
    return { id: payment.id }
  }

  const supabase = createSupabaseClient(env)
  if (!supabase) return { id: payment.id }

  try {
    // Supabase 会自动生成 UUID，但我们可以使用自定义 ID
    // 如果 payment.id 不是 UUID 格式，Supabase 会自动生成新的 UUID
    const paymentData = {
      user_id: payment.user_id,
      subscription_id: payment.subscription_id || null,
      lemon_squeezy_order_id: payment.lemon_squeezy_order_id,
      lemon_squeezy_payment_id: payment.lemon_squeezy_payment_id || null,
      amount: payment.amount,
      currency: payment.currency || 'USD',
      status: payment.status,
      payment_method: payment.payment_method || null,
      event_type: payment.event_type,
      metadata: payment.metadata || null
    }

    // 只有在 payment.id 是有效的 UUID 格式时才设置 id
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (payment.id && uuidRegex.test(payment.id)) {
      paymentData.id = payment.id
    }

    const { data, error } = await supabase
      .from('payment_records')
      .insert(paymentData)
      .select()
      .single()

    if (error) {
      console.error('[Supabase] 插入支付记录失败:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('[Supabase] 插入支付记录异常:', error)
    throw error
  }
}

/**
 * 根据 Lemon Squeezy subscription_id 查找订阅记录
 *
 * @param {object} env - Cloudflare Worker 环境对象
 * @param {string} lemonSqueezySubscriptionId - Lemon Squeezy 订阅 ID
 * @returns {Promise<object|null>} 订阅记录或 null
 */
export async function getSubscriptionByLemonSqueezyId(
  env,
  lemonSqueezySubscriptionId
) {
  if (!hasSupabase(env)) return null

  const supabase = createSupabaseClient(env)
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('lemon_squeezy_subscription_id', lemonSqueezySubscriptionId)
      .maybeSingle()

    if (error) {
      console.error('[Supabase] 查询订阅失败:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Supabase] 查询订阅异常:', error)
    return null
  }
}
