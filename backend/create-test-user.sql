-- ============================================
-- 创建测试用户（如果还没有用户）
-- ============================================
-- 
-- ⚠️ 注意：直接操作 auth.users 表需要超级管理员权限
-- 更推荐的方式：在前端注册一个测试用户

-- ============================================
-- 方式 1：使用 Supabase Auth API 创建（推荐）
-- ============================================
-- 
-- 在前端注册页面注册一个测试用户：
-- 邮箱：test@example.com
-- 密码：test12345678
-- 
-- 然后执行 insert-test-data-quick.sql 即可自动获取用户 ID

-- ============================================
-- 方式 2：直接插入到 auth.users（需要超级管理员权限）
-- ============================================
-- 
-- ⚠️ 警告：这需要直接操作 auth.users 表，可能不安全
-- 仅在开发/测试环境使用

-- 生成一个测试用户 UUID
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_email TEXT := 'test@example.com';
  test_password_hash TEXT := '$2a$10$YourHashedPasswordHere';  -- 需要真实密码哈希
BEGIN
  -- 检查是否已存在用户
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = test_email) THEN
    RAISE NOTICE '用户 % 已存在', test_email;
  ELSE
    -- 插入到 auth.users（需要超级管理员权限）
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      test_user_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      test_email,
      test_password_hash,  -- ⚠️ 需要真实的密码哈希
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      'authenticated'
    );
    
    RAISE NOTICE '✅ 测试用户已创建';
    RAISE NOTICE '   用户 ID: %', test_user_id;
    RAISE NOTICE '   邮箱: %', test_email;
  END IF;
END $$;

-- ============================================
-- 推荐方式：手动注册测试用户
-- ============================================
-- 
-- 最简单的方式：
-- 1. 在前端注册页面注册一个测试用户
-- 2. 执行 insert-test-data-quick.sql（会自动获取用户 ID）
-- 
-- 或者：
-- 1. 使用 Supabase Dashboard → Authentication → Users → Add User
-- 2. 手动添加一个测试用户

