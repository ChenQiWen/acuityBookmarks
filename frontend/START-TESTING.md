# 🚀 开始测试 - 一键运行

## ✅ 准备就绪

```
✅ Puppeteer 已安装 (v24.35.0)
✅ 所有依赖已就绪
✅ 测试框架已配置
✅ 文档已完善
```

---

## 🎯 一键运行所有测试

```bash
cd frontend
bun run test:all:complete
```

**就这么简单！** 🎉

---

## 📊 测试内容

这个命令会运行：

### 1️⃣ 单元测试（55 个）⚡ ~1 秒

- ✅ 9 个单元测试（业务逻辑）
- ✅ 5 个集成测试（Vue 组件）
- ✅ 16 个 Chrome API 测试
- ✅ 17 个 Service Worker 单元测试
- ✅ 4 个性能测试
- ✅ 4 个契约测试

### 2️⃣ 构建扩展 📦 ~10 秒

- 生成 `dist/` 目录
- 准备 E2E 测试环境

### 3️⃣ E2E 测试（11 个）🐢 ~30-60 秒

- ✅ 11 个 Service Worker E2E 测试
- 使用真实的 Chrome 浏览器
- 测试 Service Worker 终止和重启

---

## 📈 预期结果

```bash
🧪 运行所有测试...

 ✓ src/tests/unit/bookmark-tree.test.ts (4 tests)
 ✓ src/tests/unit/search-service.test.ts (5 tests)
 ✓ src/tests/integration/BookmarkList.test.ts (5 tests)
 ✓ src/tests/chrome/background-script.test.ts (4 tests)
 ✓ src/tests/chrome/alarms.test.ts (12 tests)
 ✓ src/tests/service-worker/lifecycle.test.ts (17 tests)
 ✓ src/tests/performance/benchmark.test.ts (4 tests)
 ✓ src/tests/contract/api.test.ts (4 tests)

 Test Files  8 passed (8)
      Tests  55 passed (55)

✅ 单元测试完成

vite v7.1.2 building for production...
✓ built in 5.23s

📦 构建完成

 ✓ src/tests/service-worker/termination.test.ts (11 tests)

 Test Files  1 passed (1)
      Tests  11 passed (11)

✅ E2E 测试完成

🎉 所有测试通过！
```

---

## ⏱️ 预计时间

```
单元测试: ~1 秒 ⚡
构建扩展: ~10 秒 📦
E2E 测试: ~30-60 秒 🐢
─────────────────────
总计: ~1-2 分钟 ⏱️
```

---

## 💡 提示

### E2E 测试会打开浏览器

- ✅ 这是正常的
- ✅ 浏览器窗口会可见
- ✅ 测试完成后会自动关闭
- ⚠️ 不要手动关闭浏览器窗口

### 如果测试失败

1. **检查是否构建了扩展**

   ```bash
   bun run build
   ```

2. **查看详细错误信息**

   ```bash
   bun run test:service-worker:e2e --reporter=verbose
   ```

3. **查看文档**
   - [RUN-ALL-TESTS.md](./RUN-ALL-TESTS.md) - 故障排除
   - [TEST-GUIDE.md](./TEST-GUIDE.md) - 详细指南

---

## 📚 其他测试命令

### 只运行单元测试（快速）

```bash
bun run test:run
```

### 只运行 E2E 测试

```bash
bun run build
bun run test:service-worker:e2e
```

### 带 UI 界面运行

```bash
bun run test:ui
```

---

## 🎉 准备好了吗？

运行以下命令开始测试：

```bash
cd frontend
bun run test:all:complete
```

**祝测试顺利！** 🚀

---

**提示**: 第一次运行可能需要下载 Chromium，请耐心等待。
