-- Fix test subscription date to satisfy query conditions
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/cqw547847/sql

UPDATE subscriptions
SET current_period_end = '2025-12-31 23:59:59+00'
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';

-- Verify the update
SELECT user_id, status, tier, current_period_end, created_at
FROM subscriptions
WHERE user_id = 'd4e93785-9e47-4002-a117-c83d92c887f6';