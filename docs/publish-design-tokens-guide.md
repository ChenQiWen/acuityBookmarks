# 发布 design-tokens 到 npm 指南

## 📦 前提条件

1. 注册 npm 账号
2. 在本地登录 npm：`npm login`
3. 确保包名可用：`npm view @acuity-bookmarks/design-tokens`

---

## 🔧 需要的修改

### 1. 添加 build 脚本

```json
// packages/design-tokens/package.json
{
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "bun run build"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src"]
}
```

### 2. 添加 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### 3. 发布流程

```bash
# 1. 进入 design-tokens 目录
cd packages/design-tokens

# 2. 更新版本号
npm version patch  # 或 minor, major

# 3. 发布到 npm
npm publish --access public

# 4. 在其他项目中使用
npm install @acuity-bookmarks/design-tokens
```

---

## ⚠️ 注意事项

1. **私有包**：如果不想公开，使用 `npm publish --access restricted`（需要付费账号）
2. **版本管理**：每次发布前更新 version
3. **CI/CD**：建议配置自动发布流程

---

## 🎯 当前建议

**暂时不发布到 npm**，理由：

- 只有内部项目使用
- 避免维护额外的发布流程
- workspace 模式已经足够高效
