# Supabase 安全性说明

## 🔐 关于 Supabase 密钥的安全性

### ✅ ANON KEY 是安全的（公开的）

**重要概念：`VITE_SUPABASE_ANON_KEY`（匿名密钥）是设计上就公开的，可以安全地暴露在前端代码中。**

#### 为什么是安全的？

1. **Row Level Security (RLS) 保护**
   - Supabase 使用数据库级别的行级安全策略来保护数据
   - 即使有人知道你的 ANON KEY，也无法访问受保护的数据
   - 只有通过认证的用户才能访问他们有权访问的数据

2. **设计理念**
   - Supabase 的 ANON KEY 类似于其他 SaaS 服务的公开 API 密钥：
     - Firebase: `apiKey`（公开）
     - Stripe: `publishableKey`（公开）
     - AWS Cognito: `User Pool ID`（公开）
   - 这些密钥都是设计上公开的，真正的安全通过权限控制实现

3. **实际保护机制**
   ```
   客户端请求 → ANON KEY（公开）→ Supabase API → RLS 策略检查 → 数据库
                                                      ↓
                                                用户认证状态
                                                用户权限
                                                数据过滤
   ```

### ⚠️ 真正需要保密的是 SERVICE_ROLE_KEY

**`SUPABASE_SERVICE_ROLE_KEY`（服务角色密钥）必须严格保密！**

- **只能在后端使用**，绝对不要放在前端代码或环境变量中
- 这个密钥可以绕过所有 RLS 策略，拥有完整的数据库访问权限
- 如果泄露，攻击者可以无限制访问数据库

### 📋 密钥对比

| 密钥类型           | 使用位置 | 是否公开 | 权限级别    | 安全措施        |
| ------------------ | -------- | -------- | ----------- | --------------- |
| `ANON KEY`         | 前端     | ✅ 公开  | 受 RLS 限制 | RLS 策略 + 认证 |
| `SERVICE_ROLE_KEY` | 后端     | ❌ 保密  | 完全权限    | 仅后端环境变量  |

---

## 🔧 如何正确配置

### 1. 前端配置（`.env.local`）

```bash
# ✅ 这些可以安全地放在前端环境变量中
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**说明：**

- `.env.local` 文件应该添加到 `.gitignore`（避免提交敏感信息到 Git）
- 但 ANON KEY 即使提交到 Git 也是安全的（因为它是公开的）
- 添加到 `.gitignore` 主要是为了避免泄露项目 URL 等元信息

### 2. 后端配置（`wrangler.toml` 或 Cloudflare Dashboard）

```toml
[env.production.vars]
# ✅ 这些在后端使用
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ⚠️ 保密！
```

**说明：**

- SERVICE_ROLE_KEY 只在后端环境变量中配置
- 绝对不要提交到 Git
- 使用 Cloudflare Workers Secrets 或其他安全的密钥管理服务

---

## 🛡️ 最佳安全实践

### 1. 数据库安全（RLS 策略）

在 Supabase Dashboard → Database → Policies 中设置：

```sql
-- 示例：用户只能访问自己的数据
CREATE POLICY "Users can only see their own data"
ON user_profiles
FOR SELECT
USING (auth.uid() = id);
```

### 2. 环境变量管理

```bash
# ✅ 添加到 .gitignore
.env.local
.env.production.local

# ✅ 创建示例文件（不包含真实密钥）
.env.example
```

### 3. 代码审查

- 定期检查是否有 SERVICE_ROLE_KEY 泄露到前端代码
- 使用工具扫描代码库（如 `git-secrets`）

---

## 📚 参考资源

- [Supabase 安全最佳实践](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
- [环境变量安全指南](https://supabase.com/docs/guides/api/rest/security)

---

## ✅ 安全检查清单

- [ ] ANON KEY 配置在前端 `.env.local` 中
- [ ] SERVICE_ROLE_KEY 只配置在后端环境变量中
- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] 数据库表已启用 RLS 策略
- [ ] 所有 RLS 策略已测试
- [ ] 代码中没有硬编码的 SERVICE_ROLE_KEY
