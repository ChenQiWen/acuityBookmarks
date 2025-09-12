# AcuityBookmarks Backend

基于Bun构建的高性能后端服务，为Chrome扩展提供AI书签整理功能。

## 🛠️ 技术栈

- **Bun** - 高性能JavaScript运行时
- **Node.js HTTP** - 原生HTTP服务器
- **ES Modules** - 现代模块系统
- **Vitest** - 快速测试框架

## 📦 开发环境

### 前置要求
- Bun >= 1.0.0

### 安装依赖
```bash
bun install
```

## 🔥 热更新开发模式

### 🌟 推荐：增强热更新模式
```bash
bun run dev:enhanced
```

**特点：**
- 🎯 智能文件监听（.js, .ts, .json）
- 🚫 自动忽略测试文件和node_modules
- 🔄 优雅的服务器重启
- 📊 详细的开发日志
- ⚡ 200ms防抖，避免频繁重启

### 🔥 Bun原生热更新
```bash
bun run dev
```

**特点：**
- ⚡ Bun内置的 `--hot` 模式
- 🔄 文件变化时自动重新加载
- 🏃‍♂️ 极快的重启速度
- 📝 简洁的输出日志

### 其他开发选项
```bash
# 文件监听模式（无热更新）
bun run dev:watch

# 带调试器的热更新
bun run dev:inspect

# 详细日志的热更新
bun run dev:verbose
```

## 🚀 生产环境

```bash
bun run start
```

## 🧪 测试

```bash
# 运行所有测试
bun run test

# 单次运行测试
bun run test:run

# 生成覆盖率报告
bun run test:coverage

# 监听模式运行测试
bun run test:watch
```

## 📁 项目结构

```
backend/
├── server.js          # 主服务器文件
├── utils/             # 工具函数
│   └── job-store.js   # 任务存储管理
├── scripts/           # 开发脚本
│   └── dev-server.js  # 增强开发服务器
├── test/              # 测试文件
└── bun.config.js      # Bun配置文件
```

## 🔧 配置说明

### 环境变量
- `PORT` - 服务器端口（默认：3000）
- `NODE_ENV` - 运行环境（development/production）
- `LOG_LEVEL` - 日志级别（debug/info/warn/error）

### 热更新配置
- **监听文件类型**：`.js`, `.ts`, `.json`
- **忽略目录**：`node_modules`, `test`, `.git`
- **防抖延迟**：200ms
- **优雅关闭超时**：5秒

## 🎯 开发工作流

1. **启动开发服务器**
   ```bash
   bun run dev:enhanced
   ```

2. **修改代码** - 服务器自动重启

3. **查看日志** - 实时监控服务状态

4. **运行测试**
   ```bash
   bun run test:watch
   ```

## ⚡ 性能优势

与Node.js相比，Bun提供：
- **启动速度**：快3-4倍
- **内存占用**：减少30-50%
- **热更新速度**：几乎瞬时
- **包安装**：比npm快10倍

## 🔍 调试

### 启用调试模式
```bash
bun run dev:inspect
```

### 查看详细日志
```bash
bun run dev:verbose
```

### 性能监控
```bash
# 启动时会显示：
# - 服务器启动时间
# - 内存使用情况
# - 热更新响应时间
```

## 🛡️ 错误处理

- **优雅关闭**：收到SIGTERM/SIGINT时正确关闭服务
- **自动重启**：异常退出时自动尝试重启
- **错误日志**：详细的错误堆栈信息
- **健康检查**：内置的服务健康状态监控
