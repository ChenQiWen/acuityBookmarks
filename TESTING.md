# 测试指南

## 📋 测试概览

本项目采用了现代化的测试策略，结合了单元测试、集成测试和端到端测试，为Vercel部署提供可靠的质量保障。

## 🛠️ 测试技术栈

### 前端测试
- **框架**: Vitest (Vite官方测试框架)
- **组件测试**: Vue Test Utils + @vue/test-utils
- **DOM模拟**: jsdom
- **UI框架**: Vuetify测试支持

### 后端测试
- **框架**: Vitest
- **API测试**: Supertest
- **模拟工具**: Vitest内置mocks

### CI/CD
- **平台**: GitHub Actions
- **部署**: Vercel集成

## 🚀 运行测试

### 前端测试

```bash
# 进入前端目录
cd frontend

# 安装依赖
bun install

# 运行所有测试
bun run test

# 运行测试（无监听模式）
bun run test:run

# 生成覆盖率报告
bun run test:coverage

# 开发模式（监听文件变化）
bun run test:watch

# 带UI的测试界面
bun run test:ui
```

### 后端测试

```bash
# 进入后端目录
cd backend

# 安装依赖
bun install

# 运行所有测试
bun run test

# 运行测试（无监听模式）
bun run test:run

# 生成覆盖率报告
bun run test:coverage

# 开发模式（监听文件变化）
bun run test:watch
```

## 📁 测试文件结构

```
frontend/
├── src/
│   ├── test/
│   │   └── setup.ts              # 测试环境配置
│   ├── components/
│   │   └── __tests__/            # 组件测试
│   ├── composables/
│   │   └── __tests__/            # 组合式函数测试
│   └── utils/
│       └── __tests__/            # 工具函数测试
└── vitest.config.ts              # Vitest配置

backend/
├── test/
│   ├── setup.ts                  # 测试环境配置
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── api/                      # API测试
└── vitest.config.ts              # Vitest配置
```

## 🧪 测试示例

### 组件测试示例

```typescript
// frontend/src/popup/__tests__/Popup.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Popup from '../Popup.vue'

describe('Popup Component', () => {
  it('should render correctly', async () => {
    const wrapper = mount(Popup)
    expect(wrapper.exists()).toBe(true)
  })
})
```

### API测试示例

```typescript
// backend/test/api/health.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'

describe('Health Check API', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('healthy')
  })
})
```

### 单元测试示例

```typescript
// backend/test/unit/utils.test.ts
import { describe, it, expect } from 'vitest'

describe('Utility Functions', () => {
  it('should validate URLs correctly', () => {
    expect(validateUrl('https://example.com')).toBe(true)
    expect(validateUrl('not-a-url')).toBe(false)
  })
})
```

## 🔧 测试配置

### Vitest配置

**前端配置** (`frontend/vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',        // DOM环境
    globals: true,               // 全局测试函数
    setupFiles: ['./src/test/setup.ts']
  }
})
```

**后端配置** (`backend/vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    environment: 'node',         // Node.js环境
    globals: true,
    setupFiles: ['./test/setup.ts']
  }
})
```

## 🎯 测试最佳实践

### ✅ 推荐做法

1. **测试文件名**: `*.test.ts` 或 `*.spec.ts`
2. **测试结构**: Arrange-Act-Assert模式
3. **Mock外部依赖**: 使用Vitest的vi.mock()
4. **隔离测试**: 每个测试应该是独立的
5. **描述性命名**: 测试名称应该清晰表达测试目的

### 🔍 测试覆盖率目标

- **语句覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 85%
- **行覆盖率**: > 80%

### 🚨 常见的测试陷阱

1. **依赖真实API**: 使用mocks替代真实API调用
2. **共享状态**: 每个测试应该有独立的上下文
3. **异步代码**: 正确处理async/await和Promises
4. **DOM操作**: 在jsdom环境中测试组件
5. **定时器**: 使用fake timers处理setTimeout/setInterval

## 🔄 CI/CD集成

项目配置了GitHub Actions自动测试：

```yaml
# .github/workflows/ci.yml
- 推送/PR时自动运行测试
- 测试通过后自动构建
- 支持多Node.js版本测试
- 生成测试覆盖率报告
```

## 📊 测试报告

运行 `bun run test:coverage` 后会生成：
- 控制台覆盖率报告
- HTML覆盖率报告 (`coverage/index.html`)
- JSON覆盖率数据

## 🐛 调试测试

### 调试选项

```bash
# 详细输出
bun run test --reporter=verbose

# 调试特定测试
bun run test --reporter=verbose "Popup Component"

# 仅运行失败的测试
bun run test --reporter=verbose --bail
```

### 常见调试技巧

1. **使用console.log**: 在测试中使用console.log调试
2. **检查mock调用**: 使用 `expect(mock).toHaveBeenCalledWith(...)`
3. **暂停执行**: 使用 `debugger` 语句
4. **检查DOM**: 使用 `wrapper.html()` 查看组件渲染结果

## 🎉 总结

这套测试方案提供了：
- ✅ **完整的测试覆盖**: 单元测试、集成测试、组件测试
- ✅ **现代化工具链**: Vitest + Vue Test Utils + Supertest
- ✅ **CI/CD集成**: GitHub Actions自动化测试
- ✅ **Vercel兼容**: 适合云端部署的测试策略
- ✅ **开发友好**: 快速反馈和丰富的调试选项

开始测试你的代码：`bun run test` 🚀
