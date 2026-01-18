# Chrome 崩溃问题排查指南

## 问题描述

在使用 AcuityBookmarks 扩展时，Chrome 浏览器崩溃，显示：
```
Exception Type: EXC_BREAKPOINT (SIGTRAP)
Termination Reason: Namespace SIGNAL, code 5 Trace/BPT trap: 5
```

## 可能的原因

### 1. 内存不足
- **症状**：处理大量书签（2万+）时崩溃
- **原因**：Vue 响应式系统、IndexedDB 查询、Canvas 绘制等操作占用大量内存

### 2. 扩展冲突
- **症状**：安装多个扩展后崩溃
- **原因**：Vue DevTools、React DevTools 等开发工具与扩展冲突

### 3. Chrome 版本问题
- **症状**：特定 Chrome 版本崩溃
- **原因**：Chrome 本身的 bug 或兼容性问题

### 4. 无限循环或递归
- **症状**：点击某个功能后立即崩溃
- **原因**：代码中存在无限循环或深度递归

## 排查步骤

### 步骤 1：检查 Chrome 版本

```bash
# 打开 Chrome
chrome://version

# 确保使用最新稳定版
# 当前推荐版本：Chrome 120+
```

### 步骤 2：禁用其他扩展

1. 打开 `chrome://extensions`
2. 禁用所有其他扩展（特别是开发工具）
3. 只保留 AcuityBookmarks
4. 重新测试

### 步骤 3：清理缓存和数据

```bash
# 1. 打开 Chrome DevTools (F12)
# 2. Application > Storage > Clear site data
# 3. 重新加载扩展
```

### 步骤 4：检查内存使用

```bash
# 1. 打开 Chrome 任务管理器
# Shift + Esc (macOS: ⌘ + Option + Esc)

# 2. 查看扩展的内存使用
# 正常：< 200MB
# 警告：200-500MB
# 危险：> 500MB
```

### 步骤 5：使用开发模式调试

```bash
# 1. 构建开发版本
cd frontend
bun run build:dev

# 2. 加载扩展
# chrome://extensions > 开发者模式 > 加载已解压的扩展程序

# 3. 打开 Background Service Worker 的 DevTools
# chrome://extensions > AcuityBookmarks > Service Worker > 检查视图

# 4. 查看控制台错误
```

## 针对性解决方案

### 方案 1：限制书签数量（分享功能）

如果在分享功能时崩溃：

```typescript
// 已实现：限制最多分享 50 个书签
if (bookmarks.length > 50) {
  notificationService.notify(
    `已选 ${bookmarks.length} 个书签，建议不超过 50 个`,
    { level: 'warning' }
  )
}
```

**建议**：
- 一次分享不超过 20 个书签
- 大量书签分批分享

### 方案 2：优化内存使用

如果内存占用过高：

```bash
# 1. 重启 Chrome
# 2. 清理 IndexedDB
# 3. 重新同步书签
```

**代码优化**（已实现）：
- ✅ 使用虚拟滚动（`@tanstack/vue-virtual`）
- ✅ 分批处理（每批 2000 个）
- ✅ 使用 Map 缓存（O(1) 查找）
- ✅ 离屏 Canvas（避免重复创建）

### 方案 3：禁用 Vue DevTools

如果是开发环境崩溃：

```bash
# 1. 打开 chrome://extensions
# 2. 禁用 Vue.js devtools
# 3. 重新测试
```

### 方案 4：使用 Chrome Canary

如果是 Chrome 稳定版的 bug：

```bash
# 下载 Chrome Canary
https://www.google.com/chrome/canary/

# 在 Canary 中测试扩展
```

## 预防措施

### 1. 定期清理数据

```bash
# 每周清理一次
# 1. 打开扩展设置
# 2. 数据管理 > 清理缓存
# 3. 重新同步
```

### 2. 控制书签数量

- **推荐**：< 1 万个书签
- **可接受**：1-2 万个书签
- **不推荐**：> 2 万个书签

### 3. 避免大量操作

- 不要一次选中超过 1000 个书签
- 不要频繁刷新（< 1 次/分钟）
- 不要同时打开多个管理页面

### 4. 使用最新版本

```bash
# 定期更新扩展
# 1. chrome://extensions
# 2. 开发者模式 > 更新
```

## 崩溃日志分析

### 关键信息

```
Exception Type: EXC_BREAKPOINT (SIGTRAP)
Exception Codes: 0x0000000000000001, 0x0000000123490d2c
Termination Reason: Namespace SIGNAL, code 5 Trace/BPT trap: 5
```

**解读**：
- `EXC_BREAKPOINT`：断点异常，通常是断言失败
- `SIGTRAP`：调试陷阱信号
- `code 5`：Trace/BPT trap

**可能原因**：
1. 代码中的 `console.assert()` 失败
2. 内存访问越界
3. V8 引擎内部错误
4. Chrome 渲染进程崩溃

### 崩溃线程

```
Crashed Thread: 0 CrBrowserMain Dispatch queue: com.apple.main-thread
```

**解读**：
- 主线程崩溃
- 可能是 UI 渲染或 JavaScript 执行导致

## 报告问题

如果问题持续存在，请提供以下信息：

1. **Chrome 版本**
   ```
   chrome://version
   ```

2. **扩展版本**
   ```
   chrome://extensions > AcuityBookmarks > 版本
   ```

3. **操作系统**
   ```
   macOS 版本、内存大小
   ```

4. **复现步骤**
   ```
   1. 打开管理页面
   2. 选择 X 个书签
   3. 点击"分享"按钮
   4. Chrome 崩溃
   ```

5. **崩溃日志**
   ```
   macOS: ~/Library/Logs/DiagnosticReports/
   找到最新的 Google Chrome 崩溃报告
   ```

6. **控制台日志**
   ```
   F12 > Console > 复制所有日志
   ```

## 临时解决方案

如果崩溃频繁，可以：

1. **减少书签数量**
   - 删除不需要的书签
   - 导出备份后清空

2. **使用其他浏览器**
   - Edge（基于 Chromium）
   - Brave（基于 Chromium）

3. **降级 Chrome 版本**
   - 下载旧版本 Chrome
   - 禁用自动更新

4. **等待修复**
   - 关注扩展更新
   - 关注 Chrome 更新

---

**最后更新**: 2025-01-13  
**相关问题**: Chrome 崩溃、内存溢出、扩展冲突
