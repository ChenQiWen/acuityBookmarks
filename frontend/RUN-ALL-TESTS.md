# 🧪 运行所有测试 - 快速指南

## ✅ Puppeteer 已安装

```bash
✅ puppeteer@24.35.0 已安装
✅ 所有依赖已就绪
✅ 可以运行完整测试套件
```

---

## 🚀 一键运行所有测试

```bash
cd frontend
bun run test:all:complete
```

这个命令会自动执行：

1. **运行单元测试** (~1 秒)
   - 9 个单元测试
   - 5 个集成测试
   - 16 个 Chrome API 测试
   - 17 个 Service Worker 单元测试
   - 4 个性能测试
   - 4 个契约测试
   - **小计: 55 个测试**

2. **构建扩展** (~10 秒)
   - 生成 `dist/` 目录
   - 准备 E2E 测试环境

3. **运行 E2E 测试** (~30-60 秒)
   - 11 个 Service Worker E2E 测试
   - 使用真实的 Chrome 浏览器
   - 测试 Service Worker 终止和重启

4. **显示测试报告**
   - ✅ 总计: 66 个测试
   - ✅ 预期: 全部通过

---

## 📊 测试覆盖范围

### 单元测试（55 个）

| 类型                    | 数量 | 文件位置                                     |
| ----------------------- | ---- | -------------------------------------------- |
| 单元测试                | 9    | `src/tests/unit/`                            |
| 集成测试                | 5    | `src/tests/integration/`                     |
| Chrome API 测试         | 16   | `src/tests/chrome/`                          |
| Service Worker 单元测试 | 17   | `src/tests/service-worker/lifecycle.test.ts` |
| 性能测试                | 4    | `src/tests/performance/`                     |
| 契约测试                | 4    | `src/tests/contract/`                        |

### E2E 测试（11 个）

| 类型                    | 数量 | 文件位置                                       |
| ----------------------- | ---- | ---------------------------------------------- |
| Service Worker E2E 测试 | 11   | `src/tests/service-worker/termination.test.ts` |

---

## 🎯 分步运行（可选）

如果你想分步运行，可以使用以下命令：

### 步骤 1: 运行单元测试

```bash
bun run test:run
```

**预期输出**:

```
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
```

### 步骤 2: 构建扩展

```bash
bun run build
```

**预期输出**:

```
vite v7.1.2 building for production...
✓ built in 5.23s
```

### 步骤 3: 运行 E2E 测试

```bash
bun run test:service-worker:e2e
```

**预期输出**:

```
✓ src/tests/service-worker/termination.test.ts (11 tests) 45s
  ✓ Service Worker 终止测试 (11)
    ✓ 状态恢复测试 (3)
    ✓ Alarm 触发测试 (1)
    ✓ 消息传递可靠性测试 (3)
    ✓ 消息丢失场景（边界测试） (4)

Test Files  1 passed (1)
     Tests  11 passed (11)
```

---

## ⚠️ 注意事项

### E2E 测试会打开浏览器窗口

E2E 测试会启动一个真实的 Chrome 浏览器窗口，这是正常的：

```
✓ 浏览器窗口会可见（不是 headless 模式）
✓ 窗口会自动加载扩展
✓ 测试完成后会自动关闭
✓ 不要手动关闭浏览器窗口
```

### 测试时间

```
单元测试: ~1 秒 ⚡
构建扩展: ~10 秒 📦
E2E 测试: ~30-60 秒 🐢
总计: ~1-2 分钟 ⏱️
```

---

## 🐛 故障排除

### 问题 1: E2E 测试失败，提示找不到扩展

**错误信息**:

```
Error: Cannot find extension at path: .../dist
```

**解决方案**:

```bash
# 先构建扩展
bun run build

# 然后运行 E2E 测试
bun run test:service-worker:e2e
```

---

### 问题 2: Puppeteer 启动失败

**错误信息**:

```
Error: Failed to launch the browser process
```

**解决方案**:

```bash
# 重新安装 Puppeteer
bun remove puppeteer
bun add -d puppeteer
```

---

### 问题 3: 测试超时

**错误信息**:

```
Error: Test timeout of 30000ms exceeded
```

**解决方案**:
这是正常的，E2E 测试需要更长时间。测试配置已经设置了足够的超时时间。

---

## 📈 测试报告示例

运行 `bun run test:all:complete` 后，你会看到类似的输出：

```bash
🧪 运行所有测试...

 RUN  v4.0.17 /path/to/frontend

 ✓ src/tests/unit/bookmark-tree.test.ts (4 tests) 15ms
 ✓ src/tests/unit/search-service.test.ts (5 tests) 12ms
 ✓ src/tests/integration/BookmarkList.test.ts (5 tests) 234ms
 ✓ src/tests/chrome/background-script.test.ts (4 tests) 8ms
 ✓ src/tests/chrome/alarms.test.ts (12 tests) 45ms
 ✓ src/tests/service-worker/lifecycle.test.ts (17 tests) 719ms
 ✓ src/tests/performance/benchmark.test.ts (4 tests) 156ms
 ✓ src/tests/contract/api.test.ts (4 tests) 23ms

 Test Files  8 passed (8)
      Tests  55 passed (55)
   Start at  02:30:15
   Duration  1.21s

✅ 单元测试完成

vite v7.1.2 building for production...
✓ built in 5.23s

📦 构建完成

 RUN  v4.0.17 /path/to/frontend

 ✓ src/tests/service-worker/termination.test.ts (11 tests) 45s

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  02:30:25
   Duration  45.67s

✅ E2E 测试完成

🎉 所有测试通过！
```

---

## 🎉 开始测试

准备好了吗？运行以下命令：

```bash
cd frontend
bun run test:all:complete
```

**预期结果**: ✅ 66 个测试全部通过

**祝测试顺利！** 🚀

---

## 📚 更多信息

- [测试运行指南](./TEST-GUIDE.md) - 详细的测试指南
- [测试状态报告](./TEST-STATUS.md) - 测试框架状态
- [完整测试文档](./TESTING.md) - 测试策略和最佳实践
