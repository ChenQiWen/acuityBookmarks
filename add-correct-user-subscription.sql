-- 为当前登录用户添加订阅数据
-- 运行在 Supabase SQL 编辑器：https://supabase.com/dashboard/project/cqw547847/sql

-- 首先查找 cqw547847@gmail.com 用户的用户ID
SELECT id, email FROM auth.users WHERE email = 'cqw547847@gmail.com';

-- 如果找到了用户ID，为该用户添加订阅数据
-- （请将下面查询中的 USER_ID 替换为上面查询返回的实际用户ID）

INSERT INTO subscriptions (
  user_id,
  lemon_squeezy_subscription_id,
  lemon_squeezy_variant_id,
  lemon_squeezy_order_id,
  status,
  tier,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at,
  created_at,
  updated_at
) VALUES (
  'USER_ID_HERE',  -- 请替换为实际的用户ID
  'test_sub_12345',
  'test_variant_12345',
  'test_order_12345',
  'active',
  'pro',
  '2025-11-01 00:00:00+00',
  '2025-12-31 23:59:59+00',
  false,
  null,
  NOW(),
  NOW()
) ON CONFLICT (user_id, lemon_squeezy_subscription_id) DO UPDATE SET
  status = EXCLUDED.status,
  tier = EXCLUDED.tier,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  cancelled_at = EXCLUDED.cancelled_at,
  updated_at = EXCLUDED.updated_at;

-- 验证插入结果
SELECT * FROM subscriptions WHERE user_id = 'USER_ID_HERE';