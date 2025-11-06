-- ============================================
-- 更新：创建用户资料时自动生成默认昵称
-- ============================================

-- 辅助函数：检查字符串是否可读（包含字母）
CREATE OR REPLACE FUNCTION is_readable_string(str TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 如果字符串包含至少一个字母，认为是可读的
  RETURN str ~ '[a-zA-Z]';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 辅助函数：从邮箱提取用户名部分
CREATE OR REPLACE FUNCTION extract_email_local(email TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 提取 @ 符号前的部分
  RETURN SPLIT_PART(email, '@', 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 辅助函数：格式化昵称（首字母大写，替换分隔符为空格）
CREATE OR REPLACE FUNCTION format_nickname(local_part TEXT)
RETURNS TEXT AS $$
DECLARE
  formatted TEXT;
BEGIN
  -- 替换常见分隔符为空格
  formatted := REPLACE(REPLACE(REPLACE(REPLACE(local_part, '.', ' '), '_', ' '), '-', ' '), '+', ' ');
  -- 去除多余空格
  formatted := REGEXP_REPLACE(formatted, '\s+', ' ', 'g');
  formatted := TRIM(formatted);
  -- 首字母大写（每个单词首字母大写）
  formatted := INITCAP(formatted);
  -- 限制长度
  IF LENGTH(formatted) > 50 THEN
    formatted := LEFT(formatted, 50);
  END IF;
  RETURN formatted;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 辅助函数：生成友好的随机昵称
CREATE OR REPLACE FUNCTION generate_friendly_nickname(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  adjectives TEXT[] := ARRAY['Curious', 'Creative', 'Bright', 'Smart', 'Swift', 'Wise', 'Eager', 'Bold', 'Calm', 'Kind', 'Happy', 'Lucky'];
  nouns TEXT[] := ARRAY['Explorer', 'User', 'Member', 'Thinker', 'Builder', 'Trailblazer', 'Scholar', 'Visionary', 'Innovator', 'Pioneer', 'Learner', 'Creator'];
  adjective TEXT;
  noun TEXT;
  random_suffix TEXT;
BEGIN
  -- 随机选择形容词和名词
  adjective := adjectives[1 + FLOOR(RANDOM() * ARRAY_LENGTH(adjectives, 1))::INTEGER];
  noun := nouns[1 + FLOOR(RANDOM() * ARRAY_LENGTH(nouns, 1))::INTEGER];
  -- 使用用户 ID 的后 6 位作为随机后缀（确保唯一性）
  random_suffix := UPPER(SUBSTRING(REPLACE(user_id::TEXT, '-', '') FROM LENGTH(REPLACE(user_id::TEXT, '-', '')) - 5));
  -- 组合：形容词 + 名词 + 后缀
  RETURN adjective || '_' || noun || '_' || random_suffix;
END;
$$ LANGUAGE plpgsql;

-- 更新函数：创建用户资料时自动生成默认昵称
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  email_local TEXT;
  default_nickname TEXT;
BEGIN
  -- 提取邮箱本地部分
  email_local := extract_email_local(NEW.email);
  
  -- 判断是否可读（包含字母且长度合理）
  IF is_readable_string(email_local) AND LENGTH(email_local) <= 50 THEN
    -- 可读：格式化邮箱前缀
    default_nickname := format_nickname(email_local);
    -- 如果格式化后为空或太短，使用随机昵称
    IF default_nickname IS NULL OR LENGTH(default_nickname) < 2 THEN
      default_nickname := generate_friendly_nickname(NEW.id);
    END IF;
  ELSE
    -- 不可读或太长：生成友好随机昵称
    default_nickname := generate_friendly_nickname(NEW.id);
  END IF;
  
  -- 插入用户资料，包含默认昵称
  INSERT INTO public.user_profiles (id, email, nickname)
  VALUES (NEW.id, NEW.email, default_nickname);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注意：如果触发器已存在，需要先更新函数，触发器会自动使用新函数
-- 如果需要重新创建触发器，执行：
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_new_user();

