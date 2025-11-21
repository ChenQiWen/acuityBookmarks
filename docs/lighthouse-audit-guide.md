# Lighthouse 审计指南

## 📊 项目配置

### Frontend (Chrome Extension)

- **配置文件**: `frontend/lighthouserc.json`
- **命令**: `bun run audit:frontend`
- **测试页面**: popup.html, management.html, settings.html, auth.html 等
- **特点**: 跳过 SEO/PWA 审计，专注性能和可访问性

### Website (官网)

- **配置文件**: `website/lighthouserc.json`
- **命令**: `bun run audit:website`
- **测试页面**: /, /features, /pricing, /about, /download 等
- **特点**: 完整审计（包括 SEO/PWA）

---

## ⚠️ 当前问题

Website 审计遇到以下问题：

### 1. 认证页面预渲染失败

```
/login, /register, /reset-password
```

这些页面依赖 Supabase 客户端，无法在静态生成时预渲染。

**解决方案**:

- 已在 `nuxt.config.ts` 中配置跳过这些页面
- Lighthouse 配置中移除这些页面

### 2. 缺少页面

```
/terms (服务条款)
/privacy (隐私政策)
```

**解决方案**: 需要创建这些页面

---

## ✅ 使用方法

### Extension 审计

```bash
# 审计 Chrome Extension
bun run audit:frontend

# 输出报告在 frontend/.lighthouseci/
```

### Website 审计

```bash
# 审计官网
bun run audit:website

# 输出报告在 website/.lighthouseci/
```

---

## 🎯 审计标准

### Extension

- 性能: ≥80 (popup ≥90)
- 可访问性: ≥90
- 最佳实践: ≥90
- SEO: 关闭

### Website

- 性能: ≥90 (首页 ≥95)
- 可访问性: ≥95
- 最佳实践: ≥95
- SEO: ≥95
- PWA: ≥80

---

## 🔧 待办事项

### 高优先级

1. ✅ 配置 Nuxt 跳过认证页面预渲染
2. ✅ 更新 Lighthouse 配置移除认证页面
3. ⏳ 创建 `/terms` 和 `/privacy` 页面
4. ⏳ 验证 Website 审计能正常运行

### 低优先级

1. 配置 Lighthouse CI Server 查看历史趋势
2. 集成到 GitHub Actions
3. 设置性能预算（budget）

---

## 📝 注意事项

### 认证页面

- `/login`, `/register`, `/reset-password` 等页面是客户端渲染（CSR）
- 这些页面不会被预渲染到静态文件
- 用户访问时由 Nuxt 动态渲染
- Lighthouse 无法测试这些页面（需要真实服务器运行）

### 替代方案

如果需要测试认证页面：

1. 启动开发服务器: `bun run dev:website`
2. 使用 Chrome DevTools Lighthouse 手动测试
3. 或配置 Lighthouse CI 连接到运行中的服务器

---

## 🎉 最佳实践

### 开发时

```bash
# 快速检查单个页面
# 使用 Chrome DevTools Lighthouse
```

### 提交前

```bash
# 运行完整审计
bun run audit:frontend
bun run audit:website
```

### CI/CD

```yaml
# GitHub Actions 示例
- name: Audit Frontend
  run: bun run audit:frontend

- name: Audit Website
  run: bun run audit:website
```
