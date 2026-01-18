# 手机扫码分享功能修复说明

## 问题描述

手机扫描分享海报上的二维码后，显示"网页无法打开"错误：
```
net::ERR_HTTP_RESPONSE_CODE_FAILURE
位于 https://acuitybookmarks.com/share?data=...
```

## 根本原因

1. 二维码中的链接指向 `https://acuitybookmarks.com/share`
2. 该域名还未部署到生产环境
3. 手机访问时服务器无响应

## 修复方案

### ✅ 已完成的修改

1. **修改 ShareService**
   - 文件：`frontend/src/application/share/share-service.ts`
   - 添加环境变量支持：`VITE_SHARE_BASE_URL`
   - 开发环境可配置本地 IP 地址

2. **创建配置示例**
   - 文件：`frontend/.env.development.local.example`
   - 提供配置模板和说明

3. **创建自动配置脚本**
   - 文件：`scripts/setup-local-share.sh`
   - 自动检测本地 IP 并配置环境变量

4. **创建详细文档**
   - 文件：`website/MOBILE-SHARE-TESTING.md`
   - 包含完整的测试步骤和常见问题

## 快速开始

### 方法 1：使用自动配置脚本（推荐）

```bash
# 运行配置脚本
./scripts/setup-local-share.sh

# 启动官网开发服务器
cd website && bun run dev

# 重新构建扩展
cd frontend && bun run build
```

### 方法 2：手动配置

1. **获取本地 IP 地址**

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

示例输出：`192.168.1.100`

2. **创建配置文件**

```bash
cd frontend
cp .env.development.local.example .env.development.local
```

3. **编辑配置文件**

编辑 `frontend/.env.development.local`：

```env
VITE_SHARE_BASE_URL=http://192.168.1.100:3001/share
```

**注意：** 将 `192.168.1.100` 替换为你的实际 IP

4. **启动服务**

```bash
# 启动官网（终端 1）
cd website && bun run dev

# 重新构建扩展（终端 2）
cd frontend && bun run build
```

## 测试步骤

1. 打开扩展管理页面（Alt+B）
2. 选择几个书签
3. 点击"分享"按钮
4. 点击"下载图片"保存海报
5. 用手机扫描海报上的二维码

**预期结果：**
- 手机浏览器打开 `http://你的IP:3001/share?data=...`
- 显示书签列表
- 可以点击书签访问链接

## 技术细节

### 环境变量配置

```typescript
// frontend/src/application/share/share-service.ts

private getBaseUrl(): string {
  // 生产环境：使用正式域名
  if (import.meta.env.PROD) {
    return 'https://acuitybookmarks.com/share'
  }

  // 开发环境：使用环境变量或默认值
  return import.meta.env.VITE_SHARE_BASE_URL 
      || 'http://localhost:3001/share'
}
```

### 配置优先级

1. **生产环境**：`https://acuitybookmarks.com/share`（硬编码）
2. **开发环境**：
   - 优先：`VITE_SHARE_BASE_URL`（环境变量）
   - 默认：`http://localhost:3001/share`

## 常见问题

### Q: 手机和电脑不在同一局域网怎么办？

**A:** 有两个选择：

1. **使用内网穿透**（临时方案）
   ```bash
   # 安装 ngrok
   brew install ngrok  # macOS
   
   # 启动穿透
   ngrok http 3001
   
   # 将生成的 https://xxx.ngrok.io 配置到 VITE_SHARE_BASE_URL
   ```

2. **部署官网到生产环境**（长期方案）
   - 部署到 Vercel/Netlify/Cloudflare Pages
   - 配置域名 `acuitybookmarks.com`
   - 启用 HTTPS

### Q: 修改配置后需要重新生成二维码吗？

**A:** 是的。修改 `VITE_SHARE_BASE_URL` 后需要：
1. 重新构建扩展（`bun run build`）
2. 重新生成分享海报
3. 用新的二维码测试

### Q: 为什么不能用 localhost？

**A:** 手机无法访问电脑的 `localhost`，必须使用：
- 局域网 IP 地址（如 `192.168.1.100`）
- 或公网域名（如 `acuitybookmarks.com`）

## 验证清单

- [ ] 运行配置脚本或手动配置环境变量
- [ ] 启动官网开发服务器（`bun run dev`）
- [ ] 重新构建扩展（`bun run build`）
- [ ] 生成分享海报
- [ ] 手机扫码测试
- [ ] 确认手机能打开分享页面
- [ ] 确认书签列表正确显示

## 相关文档

- [详细测试指南](./website/MOBILE-SHARE-TESTING.md)
- [分享功能测试](./website/TESTING-SHARE-FEATURE.md)
- [移动端测试](./website/MOBILE-TESTING.md)

## 代码质量检查

```bash
# 前端类型检查
cd frontend && bun run typecheck
# ✅ 通过

# 前端代码规范
cd frontend && bun run lint
# ✅ 通过
```

---

**修复日期**: 2025-01-13  
**修复内容**: 添加开发环境本地 IP 支持，方便手机扫码测试  
**影响范围**: 仅开发环境，生产环境不受影响
