# Prettier 和 ESLint 协调配置指南

## 🚨 问题背景

在项目开发中，Prettier 和 ESLint 可能在代码格式上产生冲突，导致：

- **来回修复循环**：Prettier 格式化 → ESLint 报错 → 修复 → Prettier 又改回来
- **提交失败**：pre-commit hook 中两个工具相互冲突
- **开发体验差**：开发者需要手动处理格式冲突

## 🔍 发现的冲突

### 1. 分号使用冲突

**之前的配置冲突：**

- **Prettier**: `"semi": false` (不使用分号)
- **ESLint**: `semi: ['error', 'always']` (必须使用分号)

**结果：**

```javascript
// Prettier 输出
const name = 'John'

// ESLint 要求
const name = 'John' // Missing semicolon
```

### 2. 其他可能的冲突点

- **引号风格**：单引号 vs 双引号
- **尾随逗号**：是否在数组/对象末尾添加逗号
- **括号间距**：函数参数和箭头函数的括号处理

## ✅ 解决方案

### 1. 统一配置策略

我们采用了 **无分号风格**，原因：

- ✅ 现代 JavaScript/TypeScript 趋势
- ✅ Vue 3 和前端框架主流选择
- ✅ Bun 和 TypeScript 良好支持
- ✅ 减少视觉噪音，提高代码可读性

### 2. 配置修复

#### Prettier 配置 (`.prettierrc.json`)

```json
{
  "semi": false, // 不使用分号
  "singleQuote": true, // 使用单引号
  "trailingComma": "none", // 不使用尾随逗号
  "arrowParens": "avoid" // 箭头函数避免括号
}
```

#### ESLint 配置 (`eslint.config.js`)

```javascript
// 🎨 代码风格
quotes: ['error', 'single'],     // 与 Prettier 一致：单引号
semi: ['error', 'never'],        // 与 Prettier 一致：不使用分号
'comma-trailing': 'off',         // 让 Prettier 处理
'eol-last': 'error',            // 文件末尾换行
```

#### 关键配置：eslint-config-prettier

```javascript
import prettierConfig from 'eslint-config-prettier'

export default [
  // ... 其他配置

  // ✨ 统一由 Prettier 管控格式（需置于最后覆盖格式类规则）
  prettierConfig

  // ... 后续配置
]
```

### 3. 验证配置一致性

创建测试文件验证：

```javascript
// 测试文件内容
const testVar = 'hello world' // 无分号，单引号
const anotherVar = 'test'

function testFunction() {
  return 'test'
}

export { testFunction }
```

运行测试：

```bash
# 1. Prettier 格式化
bun run format

# 2. ESLint 检查修复
bun run lint:fix

# 3. 确认没有冲突
bun run lint
```

## 🛠️ 工具协调原理

### 1. 职责分工

- **Prettier**: 负责代码格式化（空格、换行、引号等）
- **ESLint**: 负责代码质量和语法规范

### 2. 优先级顺序

1. **Prettier 格式化** → 统一基础格式
2. **ESLint 修复** → 修复代码质量问题
3. **最终检查** → 确保没有剩余冲突

### 3. 配置层次

```
eslint-config-prettier (最高优先级)
    ↓ 禁用 ESLint 中与 Prettier 冲突的格式化规则
ESLint 规则配置
    ↓ 处理代码质量和逻辑问题
Prettier 配置
    ↓ 处理代码格式化
```

## 📋 最佳实践

### 1. 配置原则

- **格式化交给 Prettier**：所有样式相关的规则
- **质量交给 ESLint**：逻辑错误、未使用变量等
- **避免重复规则**：不在 ESLint 中配置 Prettier 能处理的格式规则

### 2. 开发工作流

```bash
# 正确的执行顺序（已在 pre-commit hook 中自动化）
1. bun run format      # Prettier 格式化
2. bun run stylelint:fix # 样式修复
3. bun run lint:fix    # ESLint 质量修复
```

### 3. 编辑器配置

推荐 VS Code 配置：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## ⚠️ 常见陷阱

### 1. 配置顺序错误

```javascript
// ❌ 错误：prettier 配置在前面被覆盖
export default [
  prettierConfig,      // 被后面的规则覆盖
  {
    rules: {
      semi: ['error', 'always']  // 与 Prettier 冲突
    }
  }
]

// ✅ 正确：prettier 配置在最后
export default [
  {
    rules: {
      // 非格式化规则
    }
  },
  prettierConfig      // 最后配置，禁用冲突规则
]
```

### 2. 手动格式化规则

```javascript
// ❌ 避免在 ESLint 中配置这些格式化规则
{
  rules: {
    'indent': ['error', 2],           // Prettier 处理
    'max-len': ['error', 80],         // Prettier 处理
    'comma-spacing': ['error'],       // Prettier 处理
    'object-curly-spacing': ['error'] // Prettier 处理
  }
}
```

### 3. 不一致的配置

确保团队成员使用相同的配置：

- 同一套 `.prettierrc.json`
- 同一套 `eslint.config.js`
- 同一套编辑器配置

## 🔧 故障排除

### 1. 检查冲突

```bash
# 检查是否有 ESLint 和 Prettier 冲突
bunx eslint-config-prettier path/to/your/eslint.config.js
```

### 2. 重置和重新格式化

```bash
# 清理缓存并重新格式化
rm -rf .eslintcache
bun run format
bun run lint:fix
```

### 3. 验证一致性

```bash
# 创建测试文件验证
echo "const test = 'hello'" > test.js
bun run format test.js
bun run lint:fix test.js
# 检查文件内容是否稳定
```

## 📊 配置总结

| 工具         | 负责范围   | 配置要点                                           |
| ------------ | ---------- | -------------------------------------------------- |
| **Prettier** | 代码格式化 | `semi: false`, `singleQuote: true`                 |
| **ESLint**   | 代码质量   | `semi: ['error', 'never']`, 引入 `prettier-config` |
| **配置协调** | 避免冲突   | `eslint-config-prettier` 在最后                    |

通过这样的配置，我们实现了 Prettier 和 ESLint 的完美协调，避免了相互冲突，提供了流畅的开发体验。
