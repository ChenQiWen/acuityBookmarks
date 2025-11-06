-- ============================================
-- AcuityBookmarks Supabase 测试数据
-- ============================================
-- 
-- 使用说明：
-- 1. 如果有现有用户，将下面的 USER_ID_1 和 USER_ID_2 替换为真实的 Supabase 用户 UUID
-- 2. 如果没有用户，可以先注册一个测试用户，然后获取其 ID
-- 3. 由于 RLS 策略，需要使用 Service Role Key 权限执行此脚本
--    或者在 Supabase Dashboard → Table Editor → 临时禁用 RLS 执行
--
-- 获取用户 ID：
-- SELECT id, email FROM auth.users LIMIT 5;

-- ============================================
-- 步骤 1：设置测试用户 ID（请替换为你的真实用户 ID）
-- ============================================
-- 方式 1：使用变量（PostgreSQL 14+）
-- DO $$
-- DECLARE
--   user_id_1 UUID;
--   user_id_2 UUID;
-- BEGIN
--   -- 获取第一个用户
--   SELECT id INTO user_id_1 FROM auth.users LIMIT 1;
--   -- 如果没有用户，创建一个测试用户 UUID（仅用于测试）
--   IF user_id_1 IS NULL THEN
--     user_id_1 := '00000000-0000-0000-0000-000000000001'::UUID;
--   END IF;
--   user_id_2 := '00000000-0000-0000-0000-000000000002'::UUID;
-- END $$;

-- 方式 2：直接替换（推荐）
-- 请将下面的 UUID 替换为你的真实用户 ID
-- 可以在 Supabase Dashboard → Authentication → Users 查看

-- ============================================
-- 步骤 2：插入测试订阅数据
-- ============================================

-- 测试用户 1：活跃的 Pro 订阅
INSERT INTO public.subscriptions (
  user_id,
  lemon_squeezy_subscription_id,
  lemon_squeezy_order_id,
  lemon_squeezy_variant_id,
  status,
  tier,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at
) VALUES (
  -- 请替换为真实的用户 UUID
  '00000000-0000-0000-0000-000000000001'::UUID,  -- user_id（测试用，请替换）
  'test_sub_001',                                -- lemon_squeezy_subscription_id
  'test_order_001',                              -- lemon_squeezy_order_id
  'test_variant_monthly',                         -- lemon_squeezy_variant_id
  'active',                                      -- status
  'pro',                                         -- tier
  NOW() - INTERVAL '10 days',                    -- current_period_start（10天前开始）
  NOW() + INTERVAL '20 days',                    -- current_period_end（20天后结束）
  false,                                         -- cancel_at_period_end
  NULL                                           -- cancelled_at
) ON CONFLICT (lemon_squeezy_subscription_id) DO UPDATE SET
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW();

-- 测试用户 2：已取消的订阅（将在周期结束时取消）
INSERT INTO public.subscriptions (
  user_id,
  lemon_squeezy_subscription_id,
  lemon_squeezy_order_id,
  lemon_squeezy_variant_id,
  status,
  tier,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at
) VALUES (
  -- 请替换为真实的用户 UUID（可以是同一个用户或不同用户）
  '00000000-0000-0000-0000-000000000001'::UUID,  -- user_id（测试用，请替换）
  'test_sub_002',                                -- lemon_squeezy_subscription_id
  'test_order_002',                              -- lemon_squeezy_order_id
  'test_variant_yearly',                         -- lemon_squeezy_variant_id
  'active',                                      -- status（仍然是 active，但会在周期结束时取消）
  'pro',                                         -- tier
  NOW() - INTERVAL '5 days',                     -- current_period_start（5天前开始）
  NOW() + INTERVAL '25 days',                     -- current_period_end（25天后结束）
  true,                                          -- cancel_at_period_end（已取消，将在周期结束时停止）
  NOW() - INTERVAL '2 days'                       -- cancelled_at（2天前取消）
) ON CONFLICT (lemon_squeezy_subscription_id) DO UPDATE SET
  status = EXCLUDED.status,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  updated_at = NOW();

-- 测试用户 3：已过期的订阅
INSERT INTO public.subscriptions (
  user_id,
  lemon_squeezy_subscription_id,
  lemon_squeezy_order_id,
  lemon_squeezy_variant_id,
  status,
  tier,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at
) VALUES (
  -- 请替换为真实的用户 UUID
  '00000000-0000-0000-0000-000000000001'::UUID,  -- user_id（测试用，请替换）
  'test_sub_003',                                -- lemon_squeezy_subscription_id
  'test_order_003',                              -- lemon_squeezy_order_id
  'test_variant_monthly',                        -- lemon_squeezy_variant_id
  'expired',                                     -- status（已过期）
  'pro',                                         -- tier
  NOW() - INTERVAL '60 days',                    -- current_period_start（60天前开始）
  NOW() - INTERVAL '30 days',                    -- current_period_end（30天前已结束）
  false,                                         -- cancel_at_period_end
  NULL                                           -- cancelled_at
) ON CONFLICT (lemon_squeezy_subscription_id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================
-- 步骤 3：插入测试支付记录数据
-- ============================================

-- 获取订阅 ID（用于关联支付记录）
DO $$
DECLARE
  sub_id_1 UUID;
  sub_id_2 UUID;
  test_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;  -- 请替换为真实用户 ID
BEGIN
  -- 获取订阅 ID
  SELECT id INTO sub_id_1 FROM public.subscriptions 
  WHERE lemon_squeezy_subscription_id = 'test_sub_001' LIMIT 1;
  
  SELECT id INTO sub_id_2 FROM public.subscriptions 
  WHERE lemon_squeezy_subscription_id = 'test_sub_002' LIMIT 1;

  -- 支付记录 1：成功的支付
  INSERT INTO public.payment_records (
    user_id,
    subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_payment_id,
    amount,
    currency,
    status,
    payment_method,
    event_type,
    metadata
  ) VALUES (
    test_user_id,
    sub_id_1,
    'test_order_001',
    'test_payment_001',
    999,                    -- $9.99（以分为单位）
    'USD',
    'paid',
    'card',
    'subscription_created',
    '{"test": true, "source": "test_data"}'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- 支付记录 2：成功的月度续费
  INSERT INTO public.payment_records (
    user_id,
    subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_payment_id,
    amount,
    currency,
    status,
    payment_method,
    event_type,
    metadata
  ) VALUES (
    test_user_id,
    sub_id_1,
    'test_order_001_renew',
    'test_payment_002',
    999,                    -- $9.99（月度续费）
    'USD',
    'paid',
    'card',
    'subscription_payment_success',
    '{"test": true, "renewal": true}'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- 支付记录 3：失败的支付
  INSERT INTO public.payment_records (
    user_id,
    subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_payment_id,
    amount,
    currency,
    status,
    payment_method,
    event_type,
    metadata
  ) VALUES (
    test_user_id,
    sub_id_2,
    'test_order_002',
    'test_payment_003',
    9999,                   -- $99.99（年度订阅）
    'USD',
    'failed',
    'card',
    'subscription_payment_failed',
    '{"test": true, "error": "insufficient_funds"}'::jsonb
  ) ON CONFLICT DO NOTHING;

  -- 支付记录 4：已退款
  INSERT INTO public.payment_records (
    user_id,
    subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_payment_id,
    amount,
    currency,
    status,
    payment_method,
    event_type,
    metadata
  ) VALUES (
    test_user_id,
    sub_id_1,
    'test_order_001_refund',
    'test_payment_004',
    999,                    -- $9.99（退款金额）
    'USD',
    'refunded',
    'card',
    'subscription_refunded',
    '{"test": true, "refund_reason": "user_request"}'::jsonb
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE '测试数据插入完成！';
  RAISE NOTICE '订阅 ID 1: %', sub_id_1;
  RAISE NOTICE '订阅 ID 2: %', sub_id_2;
END $$;

-- ============================================
-- 步骤 4：验证数据插入
-- ============================================

-- 查看插入的订阅数据
SELECT 
  id,
  user_id,
  lemon_squeezy_subscription_id,
  status,
  tier,
  current_period_start,
  current_period_end,
  cancel_at_period_end
FROM public.subscriptions
ORDER BY created_at DESC
LIMIT 10;

-- 查看插入的支付记录
SELECT 
  id,
  user_id,
  subscription_id,
  lemon_squeezy_order_id,
  amount,
  currency,
  status,
  event_type,
  created_at
FROM public.payment_records
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 清理测试数据（如果需要）
-- ============================================

-- 删除测试数据（取消注释以执行）
-- DELETE FROM public.payment_records WHERE lemon_squeezy_order_id LIKE 'test_%';
-- DELETE FROM public.subscriptions WHERE lemon_squeezy_subscription_id LIKE 'test_%';

