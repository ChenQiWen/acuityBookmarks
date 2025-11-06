-- ============================================
-- 快速插入测试数据（自动获取用户 ID）
-- ============================================
-- 
-- 使用说明：
-- 1. 此脚本会自动获取第一个存在的用户 ID
-- 2. 如果没有用户，会提示你先注册一个测试用户
-- 3. 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- ============================================
-- 自动获取用户 ID 并插入测试数据
-- ============================================

DO $$
DECLARE
  test_user_id UUID;
  sub_id UUID;
BEGIN
  -- 方式 1：自动获取第一个用户（如果有）
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  -- 如果没有用户，提示并退出
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ 没有找到用户！请先注册一个测试用户，或者使用方式 2 手动创建测试用户。';
  END IF;

  RAISE NOTICE '✅ 找到用户 ID: %', test_user_id;

  -- 插入测试订阅
  INSERT INTO public.subscriptions (
    user_id,
    lemon_squeezy_subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_variant_id,
    status,
    tier,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  ) VALUES (
    test_user_id,
    'test_sub_active_001',
    'test_order_001',
    'test_variant_monthly',
    'active',
    'pro',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '20 days',
    false
  ) ON CONFLICT (lemon_squeezy_subscription_id) DO UPDATE SET
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();

  -- 获取刚插入的订阅 ID
  SELECT id INTO sub_id FROM public.subscriptions 
  WHERE lemon_squeezy_subscription_id = 'test_sub_active_001' LIMIT 1;

  -- 插入支付记录
  INSERT INTO public.payment_records (
    user_id,
    subscription_id,
    lemon_squeezy_order_id,
    lemon_squeezy_payment_id,
    amount,
    currency,
    status,
    payment_method,
    event_type
  ) VALUES (
    test_user_id,
    sub_id,
    'test_order_001',
    'test_payment_001',
    999,  -- $9.99
    'USD',
    'paid',
    'card',
    'subscription_created'
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ 测试数据插入成功！';
  RAISE NOTICE '   用户 ID: %', test_user_id;
  RAISE NOTICE '   订阅 ID: %', sub_id;
END $$;

-- ============================================
-- 验证数据
-- ============================================

SELECT 
  '订阅数据' as type,
  id,
  lemon_squeezy_subscription_id,
  status,
  tier,
  current_period_end
FROM public.subscriptions
WHERE lemon_squeezy_subscription_id = 'test_sub_active_001';

SELECT 
  '支付记录' as type,
  id,
  lemon_squeezy_order_id,
  amount,
  currency,
  status
FROM public.payment_records
WHERE lemon_squeezy_order_id = 'test_order_001';

