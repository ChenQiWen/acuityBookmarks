/**
 * 🎯 AcuityBookmarks ESLint 配置
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'

export default [
  // 🎯 全项目基础配置
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.cache/**',
      '**/.venv/**',
      '**/*.min.js',
      '**/coverage/**',
      '**/.git/**',
      '**/bun.lockb',
      '**/*.lock',
      '**/*.log',
      '**/*.sh', // 忽略 shell 脚本文件
      '**/*.bash', // 忽略 bash 脚本文件
      'vite.config.ts' // 忽略根目录的 vite 配置
    ]
  },
  // 🔥 JavaScript 基础规则 (适用于所有 .js 文件)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Bun 全局变量
        Bun: 'readonly',
        // Node.js 全局变量 (为了兼容)
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // 标准 Web APIs
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        // Chrome Extension API
        chrome: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...js.configs.recommended.rules,

      // 🎯 代码质量（增强自动修复）
      'no-console': 'off', // 允许 console 输出
      'no-debugger': 'error', // 自动移除 debugger
      'no-alert': 'error', // 禁止 alert
      'no-eval': 'error', // 自动移除 eval
      'no-implied-eval': 'error', // 自动移除隐式 eval
      'no-new-func': 'error', // 自动移除 Function 构造函数

      // 🚀 性能优化（自动修复）
      // 使用 unused-imports 进行未用导入与变量检测
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      // 未达成的代码路径直接报错，避免遗留死代码
      'no-unreachable': 'error',
      'no-undef': 'error', // 回到错误级别，确保变量定义正确
      'prefer-const': 'error', // 自动修复：let → const
      'no-var': 'error', // 自动修复：var → let/const
      'no-empty': 'warn',

      // 🎨 代码风格（自动修复）
      quotes: ['error', 'single'], // 自动修复引号
      semi: ['error', 'never'], // 与 Prettier 保持一致
      'comma-trailing': 'off',
      'eol-last': 'error', // 自动添加末尾换行

      // 🔧 现代化语法（自动修复）
      'prefer-template': 'error', // 自动转换为模板字符串
      'object-shorthand': 'error', // 自动使用对象简写
      'prefer-arrow-callback': 'error', // 自动转换箭头函数
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true // 自动使用对象解构
        }
      ],
      'prefer-spread': 'error', // 自动使用展开语法
      'prefer-rest-params': 'error', // 自动使用剩余参数

      // 📦 导入优化（自动修复）
      'no-duplicate-imports': 'error', // 自动合并重复导入
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false
        }
      ],

      // 🛡️ 错误预防（自动修复）
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'error', // 自动移除不必要的 await

      // 📝 代码清理（自动修复）
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'no-trailing-spaces': 'error',
      'space-before-blocks': 'error',
      'keyword-spacing': 'error',
      'comma-spacing': 'error',
      'key-spacing': 'error',
      'object-curly-spacing': ['error', 'always'], // { key: value }

      // 🎯 类型转换（自动修复）
      'prefer-numeric-literals': 'error', // 0b111110111 vs parseInt('111110111', 2)
      'no-implicit-coercion': 'error', // 明确类型转换
      radix: 'error' // parseInt 需要 radix 参数
    }
  },
  // 🎨 Vue 3 基础配置（SFC 支持）
  ...pluginVue.configs['flat/recommended'],
  // ⚡ TypeScript 基础配置（非 type-aware，避免提交时过慢）
  ...tseslint.configs.recommended,
  // ✨ 统一由 Prettier 管控格式（需置于最后覆盖格式类规则）
  prettierConfig,
  // 🧩 Vue 文件解析与额外宽松规则
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: pluginVue.configs['flat/recommended'][1].languageOptions.parser,
      parserOptions: {
        parser: { ts: tseslint.parser },
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      'vue/multi-word-component-names': 'off', // 允许单词组件名
      'vue/attribute-hyphenation': 'off', // 允许驼峰属性
      'vue/max-attributes-per-line': 'off', // 允许单行多属性
      'vue/html-indent': 'off', // 关闭强制缩进
      'vue/html-closing-bracket-newline': 'off', // 关闭强制换行
      'vue/html-closing-bracket-spacing': 'off', // 关闭强制间距
      'vue/singleline-html-element-content-newline': 'off', // 允许单行元素内容不换行
      'vue/multiline-html-element-content-newline': 'off', // 允许多行元素内容不换行
      'vue/no-v-html': 'off', // 允许 v-html
      'vue/no-use-v-if-with-v-for': 'off', // 允许 v-if 与 v-for 同时使用
      'vue/require-default-prop': 'off', // 关闭默认值要求
      'vue/no-required-prop-with-default': 'off', // 关闭必需属性默认值冲突警告

      // 🔥 TypeScript 与 Vue 结合的特殊处理
      '@typescript-eslint/no-explicit-any': 'error', // 严格禁止 any 类型
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  // 🔧 TypeScript 文件局部规则（轻量）
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx', 'backend/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // 统一 TypeScript 解析根目录，避免多 tsconfig 环境解析异常
        tsconfigRootDir: process.cwd()
        // 移除 typed linting 配置，避免性能问题
        // tsconfigRootDir: process.cwd(),
        // project: ['./frontend/tsconfig*.json']
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // 严格禁止 any 类型，确保 TypeScript 类型安全
      // 改为使用 unused-imports 处理未使用导入与变量
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      // 明确不可达代码为错误，及时删除
      'no-unreachable': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off', // 允许使用非空断言
      '@typescript-eslint/no-var-requires': 'error', // 禁止 require 导入，使用 import 代替
      '@typescript-eslint/no-namespace': 'error', // 禁止使用自定义命名空间
      '@typescript-eslint/no-empty-function': 'warn', // 允许空函数，但警告
      '@typescript-eslint/ban-ts-comment': 'warn', // 允许 @ts-ignore 但警告
      '@typescript-eslint/no-empty-object-type': 'off', // 允许空对象类型
      '@typescript-eslint/no-require-imports': 'off', // 允许 require() 导入

      // TypeScript 自动修复规则（非 type-aware）
      '@typescript-eslint/prefer-as-const': 'warn', // 优先使用 as const
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }], // 统一数组类型语法
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'], // 优先使用 interface
      '@typescript-eslint/consistent-type-imports': 'warn', // 统一类型导入语法
      '@typescript-eslint/no-import-type-side-effects': 'warn', // 移除类型导入副作用
      '@typescript-eslint/prefer-literal-enum-member': 'warn', // 优先使用字面量枚举成员
      '@typescript-eslint/prefer-enum-initializers': 'warn' // 优先显式初始化枚举

      // 移除需要 type information 的规则，避免配置复杂性
      // '@typescript-eslint/prefer-optional-chain': 'warn',
      // '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      // '@typescript-eslint/prefer-includes': 'warn',
      // '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
      // '@typescript-eslint/prefer-for-of': 'warn',
      // '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      // '@typescript-eslint/no-unnecessary-condition': 'warn',
      // '@typescript-eslint/prefer-reduce-type-parameter': 'warn'
    }
  },
  // 🔧 ES Module 脚本配置 (enhance-autofix.js 等)
  {
    files: ['scripts/enhance-autofix.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module', // ES modules 模式
      globals: {
        // Node.js 全局变量
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      // 🎯 脚本特定规则
      'no-process-exit': 'warn', // 不允许使用 process.exit()
      'no-sync': 'warn', // 避免同步 API 阻塞事件循环
      'no-throw-literal': 'error', // 不允许抛出字面量
      'no-new-func': 'error', // 不允许使用 Function 构造函数
      'no-new-wrappers': 'error', // 不允许使用 String，Number 和 Boolean 构造函数
      'no-new-object': 'error', // 不允许使用 Object 构造函数
      'no-new-symbol': 'error', // 不允许使用 Symbol 构造函数
      'no-new': 'error', // 不允许使用 new 关键字
      'no-console': 'off', // 允许脚本使用 console 输出
      'no-unused-vars': 'error' // 允许脚本中未使用的变量
    }
  },

  // 📦 Backend 特定规则 (Cloudflare Worker + Bun)
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        // Cloudflare Worker 全局变量
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        crypto: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Bun 特定全局变量
        Bun: 'readonly',
        // Node.js 兼容
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        // 标准 Web APIs
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      // 🎯 后端特定规则
      'no-process-exit': 'warn', // 不允许使用 process.exit()
      'no-sync': 'warn', // 避免同步 API 阻塞事件循环
      'no-console': 'off', // Cloudflare Worker 中的 console 用于调试
      // 🔥 Bun + Cloudflare Worker 最佳实践
      'prefer-template': 'error', // 自动转换为模板字符串
      'prefer-const': 'error', // 自动修复：let → const
      'no-var': 'error', // 自动修复：var → let/const
      'no-unused-vars': 'warn', // 允许未使用的变量
      'no-magic-numbers': 'off', // Cloudflare Worker 中有很多 HTTP 状态码和时间常量
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },

  // 🌐 浏览器扩展后台脚本特殊配置
  {
    files: ['background.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Chrome Extension API
        chrome: 'readonly',
        // Service Worker API
        self: 'readonly',
        clients: 'readonly',
        // Web APIs
        indexedDB: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        performance: 'readonly',
        // 项目特定函数
        openManagementPageWithAI: 'readonly'
      }
    },
    rules: {
      // 🎯 浏览器扩展特定规则
      'no-undef': 'error', // 确保所有变量均已定义
      'no-console': 'off', // 扩展中的 console 是有用的调试信息
      'no-empty': 'warn', // 空的 catch 块在扩展中常见
      'no-unused-vars': 'error', // 未使用的变量视为错误
      '@typescript-eslint/no-unused-vars': 'error', // 未使用的变量视为错误
      'no-case-declarations': 'error', // switch 语句中的声明
      'no-useless-escape': 'warn', // 正则表达式转义
      'no-magic-numbers': 'off' // 扩展中常有魔法数字
    }
  },

  // 📄 Page-fetcher 脚本特殊配置
  {
    files: ['page-fetcher.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        Promise: 'readonly',
        Date: 'readonly',
        Map: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },

  // ✨ 统一由 Prettier 管控格式（需置于最后覆盖格式类规则）
  prettierConfig
]
