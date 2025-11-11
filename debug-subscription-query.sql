-- 调试订阅查询问题
-- 运行在 Supabase SQL 编辑器：https://supabase.com/dashboard/project/cqw547847/sql

-- 1. 检查当前时间和格式
SELECT
    NOW() as current_time,
    NOW()::text as current_time_text,
    NOW()::text = '2025-11-11 15:19:40+00' as time_comparison;

-- 2. 检查订阅数据的确切值和格式
SELECT
    user_id,
    status,
    tier,
    current_period_start,
    current_period_start::text as start_time_text,
    current_period_end,
    current_period_end::text as end_time_text,
    created_at,
    created_at::text as created_time_text
FROM subscriptions
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';

-- 3. 模拟Worker的查询条件
SELECT * FROM subscriptions
WHERE
    user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6'
    AND status = 'active'
    AND current_period_end > NOW()
ORDER BY current_period_end DESC
LIMIT 1;

-- 4. 检查时区转换
SELECT
    current_period_end,
    current_period_end > NOW() as is_future,
    current_period_end > '2025-11-11 15:19:40+00' as is_future_compared,
    EXTRACT(EPOCH FROM (current_period_end - NOW())) as seconds_until_expiry
FROM subscriptions
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';