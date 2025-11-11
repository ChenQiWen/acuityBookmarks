-- 检查订阅数据的完整SQL
-- 在Supabase SQL编辑器中运行：https://supabase.com/dashboard/project/cqw547847/sql

-- 1. 检查所有订阅记录
SELECT
    user_id,
    status,
    tier,
    current_period_start,
    current_period_end,
    created_at,
    updated_at,
    CASE
        WHEN current_period_end > NOW() THEN '有效（未来）'
        WHEN current_period_end = NOW() THEN '即将到期'
        ELSE '已过期'
    END as subscription_status
FROM subscriptions
ORDER BY created_at DESC;

-- 2. 检查特定用户的订阅记录
SELECT * FROM subscriptions
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';

-- 3. 检查当前时间和订阅结束时间对比
SELECT
    NOW() as current_time,
    current_period_end,
    EXTRACT(EPOCH FROM (current_period_end - NOW())) as seconds_until_expiry
FROM subscriptions
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';