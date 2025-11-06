# 默认昵称生成策略

## 🎯 设计原则

1. **用户友好**：可读、易记、专业
2. **智能判断**：根据邮箱前缀可读性选择策略
3. **唯一性**：确保每个用户都有唯一的昵称
4. **国际化**：面向欧美用户，使用英文格式

## 📋 昵称生成规则

### 策略 1：邮箱前缀可读（包含字母）

**规则**：

- 提取邮箱 `@` 前的部分
- 替换分隔符（`.`、`_`、`-`、`+`）为空格
- 首字母大写（每个单词）

**示例**：

- `john.doe@example.com` → `John Doe`
- `jane_smith@gmail.com` → `Jane Smith`
- `user-name@domain.com` → `User Name`
- `alice+bob@example.com` → `Alice Bob`

### 策略 2：邮箱前缀不可读（纯数字或特殊字符）

**规则**：

- 生成友好的随机昵称
- 格式：`形容词_名词_后缀`
- 后缀使用用户 ID 的后 4 位（确保唯一性）

**示例**：

- `547701@qq.com` → `Curious_Explorer_710c`
- `123456@qq.com` → `Bright_Thinker_1234`
- `user123@example.com` → `Smart_Builder_5678`

### 昵称词库

**形容词库**：

- Curious, Creative, Bright, Smart, Swift
- Wise, Eager, Bold, Calm, Kind

**名词库**：

- Explorer, User, Member, Thinker, Builder
- Trailblazer, Scholar, Visionary, Innovator, Pioneer

## 🔧 实现方式

### 数据库触发器

在 Supabase 中创建触发器函数，当用户注册时自动生成默认昵称：

```sql
-- 在 Supabase SQL Editor 中执行
-- 文件：backend/generate-default-nickname.sql
```

### 优点

1. **自动化**：用户注册时自动生成，无需前端处理
2. **一致性**：所有用户都有默认昵称
3. **可定制**：用户可以随时修改昵称
4. **友好性**：即使是纯数字邮箱，也能生成友好的昵称

## 📝 使用说明

1. 在 Supabase Dashboard → SQL Editor 中执行 `generate-default-nickname.sql`
2. 新注册的用户会自动获得默认昵称
3. 用户可以在设置页面修改昵称

## 🎨 显示效果

- **邮箱前缀可读**：显示为 `John Doe`（更专业）
- **邮箱前缀不可读**：显示为 `Curious_Explorer_710c`（更友好）

## 🔄 后续优化

如果用户量增长，可以考虑：

1. 从更多词库中选择
2. 根据用户行为个性化昵称
3. 支持用户自定义昵称模板
