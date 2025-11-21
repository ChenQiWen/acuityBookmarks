# Lighthouse CI 配置检查清单

## ✅ 已完成的配置

### 1. 性能预算（Budget）

- [x] Frontend budgets 已配置
- [x] Website budgets 已配置
- [x] 时间指标预算已设置
- [x] 资源大小预算已设置
- [x] 资源数量预算已设置

### 2. GitHub Actions

- [x] Workflow 文件已创建 (`.github/workflows/lighthouse.yml`)
- [x] Frontend 审计任务已配置
- [x] Website 审计任务已配置
- [x] PR 评论功能已配置
- [x] Artifacts 上传已配置
- [x] 并行执行已优化

### 3. LHCI Server 配置

- [x] Frontend upload 配置已更新
- [x] Website upload 配置已更新
- [x] Server 部署文件已创建
- [x] 部署文档已准备

---

## 📋 可选配置（需要时再做）

### LHCI Server 部署

#### 选项 A：使用当前配置（推荐）

- [ ] 无需额外配置
- [ ] 报告自动上传到 Google Cloud Storage
- [ ] 保留 7 天
- [ ] 适合大多数场景

#### 选项 B：部署 LHCI Server（需要历史趋势）

- [ ] 选择部署平台（Cloudflare Workers / Vercel / Docker）
- [ ] 按照 `lhci-server/README.md` 部署
- [ ] 创建项目并获取 Build Token
- [ ] 在 GitHub 添加 Secrets：
  - [ ] `LHCI_SERVER_TOKEN_FRONTEND`
  - [ ] `LHCI_SERVER_TOKEN_WEBSITE`
- [ ] 更新 `lighthouserc.json` 的 `serverBaseUrl`
- [ ] 测试上传功能

---

## 🧪 测试清单

### 本地测试

- [ ] 运行 `bun run audit:frontend` 成功
- [ ] 运行 `bun run audit:website` 成功
- [ ] 报告生成在 `.lighthouseci/` 目录
- [ ] 性能预算检查正常工作

### GitHub Actions 测试

- [ ] Push 到 main 分支触发 workflow
- [ ] Frontend 审计任务成功
- [ ] Website 审计任务成功
- [ ] Artifacts 成功上传
- [ ] PR 评论功能正常（创建测试 PR）

### LHCI Server 测试（如果已部署）

- [ ] 报告成功上传到 Server
- [ ] 可以在 Server 查看报告
- [ ] 历史趋势显示正常
- [ ] 对比功能正常工作

---

## 📚 文档清单

- [x] `docs/lighthouse-audit-guide.md` - 基础使用指南
- [x] `docs/lighthouse-ci-server-setup.md` - Server 部署指南
- [x] `docs/lighthouse-complete-setup.md` - 完整配置总结
- [x] `docs/lighthouse-checklist.md` - 本检查清单
- [x] `lhci-server/README.md` - Server 快速开始

---

## 🎯 验证步骤

### 1. 验证性能预算

```bash
# 运行审计
bun run audit:website

# 检查输出中是否有预算警告
# 例如：⚠️ Budget exceeded for script: 350KB (budget: 300KB)
```

### 2. 验证 GitHub Actions

```bash
# 创建测试分支
git checkout -b test/lighthouse-ci

# 做一个小改动
echo "# Test" >> README.md
git add README.md
git commit -m "test: lighthouse ci"

# Push 并创建 PR
git push origin test/lighthouse-ci
gh pr create --title "Test Lighthouse CI" --body "Testing automated lighthouse audit"

# 检查：
# 1. Actions 页面是否运行
# 2. 两个任务是否都成功
# 3. PR 是否有评论
# 4. Artifacts 是否可下载
```

### 3. 验证报告内容

下载 Artifacts 后检查：

- [ ] HTML 报告可以打开
- [ ] 包含所有测试页面
- [ ] 性能分数正确显示
- [ ] 预算检查结果显示

---

## 🚨 常见问题

### Q1: GitHub Actions 失败怎么办？

**检查：**

1. Chrome 是否正确安装
2. 构建是否成功
3. 端口是否被占用
4. 超时设置是否合理

**解决：**

- 查看 Actions 日志
- 本地重现问题
- 调整 timeout 设置

### Q2: 性能预算总是超标？

**原因：**

- 预算设置过严格
- 代码确实需要优化

**解决：**

1. 分析哪些资源超标
2. 优化代码或调整预算
3. 使用 `warn` 而不是 `error`

### Q3: LHCI Server 上传失败？

**检查：**

1. Server 是否正常运行
2. Token 是否正确配置
3. 网络是否可达

**解决：**

- 检查 Server 日志
- 验证 Token
- 测试网络连接

---

## 🎉 完成标志

当以下所有项都完成时，配置即为完整：

- [x] 本地可以成功运行审计
- [x] GitHub Actions 配置正确
- [x] 性能预算已设置
- [ ] 至少一次成功的 CI 运行
- [ ] PR 评论功能已验证
- [ ] 团队成员了解如何使用

---

## 📞 需要帮助？

查看文档：

- `docs/lighthouse-audit-guide.md` - 基础指南
- `docs/lighthouse-ci-server-setup.md` - Server 部署
- `docs/lighthouse-complete-setup.md` - 完整总结

或运行：

```bash
bun run audit:frontend --help
bun run audit:website --help
```
