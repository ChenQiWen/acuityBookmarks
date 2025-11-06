/**
 * Lemon Squeezy 集成处理
 *
 * 职责：
 * - 创建支付链接
 * - 处理 Webhook 事件
 * - 同步订阅状态到 Supabase
 */

/**
 * 创建支付链接
 *
 * POST /api/lemon-squeezy/checkout
 * Body: { variant_id, user_id, email }
 */
export async function handleCreateCheckout(request, env) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const body = await request.json()
    const { variant_id, user_id, email } = body

    if (!variant_id || !user_id || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    // 获取 Lemon Squeezy API Key
    const lemonSqueezyApiKey = env.LEMON_SQUEEZY_API_KEY
    if (!lemonSqueezyApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lemon Squeezy API key not configured'
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    // 获取 Store ID
    const storeId = env.LEMON_SQUEEZY_STORE_ID
    if (!storeId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lemon Squeezy Store ID not configured'
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    // 创建 Checkout
    const checkoutUrl = `https://api.lemonsqueezy.com/v1/checkouts`
    const checkoutResponse = await fetch(checkoutUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lemonSqueezyApiKey}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: null,
            product_options: {
              name: 'AcuityBookmarks Pro',
              description: 'Pro subscription for AcuityBookmarks',
              media: [],
              redirect_url: `${env.SUPABASE_URL}/auth/v1/callback`,
              receipt_button_text: 'Go to Dashboard',
              receipt_link_url: '',
              receipt_thank_you_note: 'Thank you for subscribing!'
            },
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
              desc: true,
              discount: true,
              dark: false,
              subscription_preview: true,
              button_color: '#1677ff'
            },
            checkout_data: {
              email,
              custom: {
                user_id,
                variant_id
              }
            },
            expires_at: null,
            preview: false,
            test_mode: env.LEMON_SQUEEZY_TEST_MODE === 'true'
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: variant_id
              }
            }
          }
        }
      })
    })

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text()
      console.error('[Lemon Squeezy] Create checkout failed:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create checkout' }),
        {
          status: checkoutResponse.status,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    const checkoutData = await checkoutResponse.json()
    const checkoutUrlResult = checkoutData?.data?.attributes?.url

    if (!checkoutUrlResult) {
      return new Response(
        JSON.stringify({ success: false, error: 'No checkout URL returned' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, checkout_url: checkoutUrlResult }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Lemon Squeezy] Create checkout error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * 查询订阅状态
 *
 * GET /api/lemon-squeezy/subscription?user_id=xxx
 */
export async function handleGetSubscription(request, env) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user_id parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    // 从 Supabase 查询订阅状态
    const supabase = await import('./utils/supabase.js')
    const subscription = await supabase.getUserSubscription(env, userId)

    if (!subscription) {
      return new Response(
        JSON.stringify({
          success: true,
          subscription: {
            id: null,
            status: 'expired',
            tier: 'free',
            current_period_end: new Date().toISOString(),
            cancel_at_period_end: false
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id || null,
          status: subscription.status || 'expired',
          tier: subscription.tier || 'free',
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Lemon Squeezy] Get subscription error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * 处理 Lemon Squeezy Webhook
 *
 * POST /api/lemon-squeezy/webhook
 */
export async function handleWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    // 验证 Webhook 签名
    const signature = request.headers.get('x-signature')
    const webhookSecret = env.LEMON_SQUEEZY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('[Lemon Squeezy] Webhook secret not configured')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Webhook secret not configured'
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    const body = await request.text()

    // 验证签名（Lemon Squeezy 使用 HMAC SHA256）
    // Cloudflare Workers 使用 Web Crypto API
    const encoder = new TextEncoder()
    const keyData = encoder.encode(webhookSecret)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(body)
    )
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (signature !== calculatedSignature) {
      console.error('[Lemon Squeezy] Invalid webhook signature')
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    }

    const payload = JSON.parse(body)
    const eventName = payload.meta?.event_name
    const eventData = payload.data

    console.log('[Lemon Squeezy] Webhook received:', eventName)

    // 同步到 Supabase 数据库
    const supabase = await import('./utils/supabase.js')

    // 根据事件类型处理
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_cancelled':
      case 'subscription_resumed':
      case 'subscription_expired':
        await syncSubscriptionToSupabase(eventData, env, supabase)
        break
      case 'order_created':
      case 'subscription_payment_success':
      case 'subscription_payment_failed':
      case 'subscription_payment_recovered':
        await syncPaymentToSupabase(eventData, payload, env, supabase)
        break
      default:
        console.log('[Lemon Squeezy] Unhandled event:', eventName)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('[Lemon Squeezy] Webhook error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * 同步订阅信息到 Supabase
 */
async function syncSubscriptionToSupabase(subscriptionData, env, supabase) {
  try {
    const subscription = subscriptionData.attributes
    const userId = subscription.custom?.user_id || subscription.user_email

    if (!userId) {
      console.error('[Lemon Squeezy] No user_id found in subscription data')
      return
    }

    // 确定 tier（可以根据 variant_id 或其他字段判断）
    const variantId =
      subscription.variant_id?.toString() ||
      subscriptionData.relationships?.variant?.data?.id
    const monthlyVariantId = env?.LEMON_SQUEEZY_VARIANT_ID_MONTHLY
    const yearlyVariantId = env?.LEMON_SQUEEZY_VARIANT_ID_YEARLY
    const tier =
      variantId === monthlyVariantId || variantId === yearlyVariantId
        ? 'pro'
        : 'free'

    // 确定状态
    let status = 'active'
    if (subscription.cancelled_at) {
      status = 'cancelled'
    } else if (
      subscription.ends_at &&
      new Date(subscription.ends_at) < new Date()
    ) {
      status = 'expired'
    } else if (subscription.status === 'past_due') {
      status = 'past_due'
    } else if (subscription.status === 'paused') {
      status = 'paused'
    }

    // 转换时间戳为 ISO 字符串（Supabase 需要 TIMESTAMPTZ）
    const currentPeriodStart = subscription.current_billing_cycle?.starts_at
      ? new Date(subscription.current_billing_cycle.starts_at).toISOString()
      : new Date().toISOString()
    const currentPeriodEnd =
      subscription.current_billing_cycle?.ends_at || subscription.renews_at
        ? new Date(
            subscription.current_billing_cycle?.ends_at ||
              subscription.renews_at
          ).toISOString()
        : new Date().toISOString()
    const cancelledAt = subscription.cancelled_at
      ? new Date(subscription.cancelled_at).toISOString()
      : null

    // Supabase 会自动生成 UUID，我们使用 lemon_squeezy_subscription_id 作为唯一约束
    // 不需要手动生成 subscriptionId

    // 插入或更新订阅记录到 Supabase
    await supabase.upsertSubscription(env, {
      user_id: userId,
      lemon_squeezy_subscription_id: subscriptionData.id,
      lemon_squeezy_order_id: subscription.order_id?.toString() || null,
      lemon_squeezy_variant_id: variantId || null,
      status,
      tier,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end:
        Boolean(subscription.cancelled_at) && !subscription.ends_at,
      cancelled_at: cancelledAt
    })

    console.log('[Supabase] Subscription synced successfully')
  } catch (error) {
    console.error('[Lemon Squeezy] Sync subscription error:', error)
  }
}

/**
 * 取消订阅
 *
 * POST /api/lemon-squeezy/subscription/cancel
 * Body: { subscription_id }
 */
export async function handleCancelSubscription(request, env) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const body = await request.json()
    const { subscription_id } = body

    if (!subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing subscription_id' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    const supabase = await import('./utils/supabase.js')
    await supabase.updateSubscriptionCancelStatus(env, subscription_id, true)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('[Lemon Squeezy] Cancel subscription error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * 恢复订阅
 *
 * POST /api/lemon-squeezy/subscription/resume
 * Body: { subscription_id }
 */
export async function handleResumeSubscription(request, env) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'content-type': 'application/json' }
      }
    )
  }

  try {
    const body = await request.json()
    const { subscription_id } = body

    if (!subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing subscription_id' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    const supabase = await import('./utils/supabase.js')
    await supabase.updateSubscriptionCancelStatus(env, subscription_id, false)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch (error) {
    console.error('[Lemon Squeezy] Resume subscription error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * 同步支付记录到 Supabase
 */
async function syncPaymentToSupabase(paymentData, payload, env, supabase) {
  try {
    const order = paymentData.attributes || {}
    const subscriptionId =
      order.subscription_id ||
      payload.data?.relationships?.subscription?.data?.id

    // 从 Supabase 查找对应的订阅记录以获取 user_id
    let userId = null
    let subscriptionRecordId = null

    if (subscriptionId) {
      const subscription = await supabase.getSubscriptionByLemonSqueezyId(
        env,
        subscriptionId
      )
      if (subscription) {
        userId = subscription.user_id
        subscriptionRecordId = subscription.id
      }
    }

    // 如果找不到订阅，尝试从订单的 custom 字段获取 user_id
    if (!userId && order.custom?.user_id) {
      userId = order.custom.user_id
    }

    if (!userId) {
      console.error('[Supabase] No user_id found for payment')
      return
    }

    // 确定支付状态
    let status = 'pending'
    if (order.status === 'paid') {
      status = 'paid'
    } else if (order.status === 'refunded') {
      status = 'refunded'
    } else if (order.status === 'failed') {
      status = 'failed'
    }

    // Supabase 会自动生成 UUID，不需要手动生成 payment ID
    await supabase.insertPaymentRecord(env, {
      user_id: userId,
      subscription_id: subscriptionRecordId,
      lemon_squeezy_order_id: order.id?.toString() || paymentData.id,
      lemon_squeezy_payment_id: order.payment_id?.toString() || null,
      amount: order.total || 0,
      currency: order.currency || 'USD',
      status,
      payment_method: order.payment_method || null,
      event_type: payload.meta?.event_name || 'unknown',
      metadata: payload
    })

    console.log('[Supabase] Payment synced successfully')
  } catch (error) {
    console.error('[Lemon Squeezy] Sync payment error:', error)
  }
}
