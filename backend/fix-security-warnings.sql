-- ============================================
-- 修复 Supabase Security Advisor 警告
-- ============================================

-- ============================================
-- 警告 1-3: Function Search Path Mutable
-- ============================================
-- 问题：函数的 search_path 未设置，可能导致 SQL 注入攻击
-- 风险：攻击者可能创建同名函数来劫持函数执行
-- 解决：为所有函数设置 SET search_path = '' 或 SET search_path = public, pg_temp

-- 修复 update_updated_at_column 函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 修复 get_user_subscription_status 函数
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid UUID)
RETURNS TABLE (
  tier TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tier,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end
  FROM public.subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.current_period_end DESC
  LIMIT 1;
END;
$$;

-- 修复 handle_new_user 函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- ============================================
-- 警告 4: Leaked Password Protection Disabled
-- ============================================
-- 问题：泄露密码保护已禁用
-- 风险：用户可能使用已被泄露的密码，账户容易被攻击
-- 解决：需要在 Supabase Dashboard 中手动启用
-- 
-- 步骤：
-- 1. 进入 Supabase Dashboard
-- 2. 打开 Settings → Auth → Password
-- 3. 启用 "Check for leaked passwords" 选项
-- 
-- 注意：此设置无法通过 SQL 修改，必须在 Dashboard 中配置

