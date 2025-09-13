/**
 * 🎯 后端 ESLint 配置 - Bun Native + JavaScript
 * 专为 AcuityBookmarks 后端优化
 */

import js from '@eslint/js';

export default [
  // 🎯 忽略文件
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      '**/*.min.js',
      'benchmark.js', // 性能测试文件暂时忽略
      'bun.lockb'
    ]
  },

  // 🔥 JavaScript 基础配置
  js.configs.recommended,

  // 🎯 全局配置
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // 🔥 Bun 原生全局变量
        Bun: 'readonly',

        // 🌐 Node.js 兼容 (过渡期)
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',

        // 🎯 标准全局变量
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        performance: 'readonly',
        AbortController: 'readonly'
      }
    },

    rules: {
      // 🎯 代码质量
      'no-console': 'off', // 服务器允许 console
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // 🚀 性能优化
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // 🔥 Bun 最佳实践
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'prefer-destructuring': ['error', {
        array: false,
        object: true
      }],

      // 🎯 异步处理
      'require-await': 'error',
      'no-await-in-loop': 'warn',
      'prefer-promise-reject-errors': 'error',

      // 🛡️ 错误处理
      'no-throw-literal': 'error',
      'consistent-return': 'error',

      // 📦 模块化
      'no-duplicate-imports': 'error',
      'import/no-unresolved': 'off', // Bun 处理模块解析

      // 🔧 代码风格
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'eol-last': 'error',
      'no-trailing-spaces': 'error',
      'indent': ['error', 2],

      // 🎯 复杂度控制
      'complexity': ['warn', 15],
      'max-depth': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      'max-params': ['warn', 4],
      'max-statements': ['warn', 25],
      'max-lines-per-function': ['warn', 80],

      // 🚀 魔法数字控制 (放宽规则，专注核心问题)
      'no-magic-numbers': ['warn', {
        ignore: [0, 1, 2, 3, 5, 8, 10, 15, 24, 30, 36, 60, 80, 100, 200, 201, 202, 204, 300, 301, 302, 303, 307, 308, 400, 401, 403, 404, 405, 410, 443, 500, 502, 503, 504, 1000, 1024, 2000, 3000, 5000, 8080],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        detectObjects: false // 忽略对象属性中的数字
      }],

      // 🔥 服务器特定
      'no-process-exit': 'warn',
      'no-sync': 'off' // Bun 支持同步 I/O
    }
  },

  // 🎯 服务器主文件特定规则
  {
    files: ['server*.js', 'app.js', 'index.js'],
    rules: {
      'no-console': 'off', // 服务器日志允许
      'max-lines-per-function': ['warn', 120], // 服务器函数可以更长
      'complexity': ['warn', 20] // 服务器逻辑复杂度放宽
    }
  },

  // 🔧 配置和脚本文件
  {
    files: [
      'bun.config.js',
      'scripts/**/*.js',
      '**/*.config.js'
    ],
    rules: {
      'no-console': 'off',
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // 🧪 工具文件宽松规则
  {
    files: [
      'utils/**/*.js',
      'helpers/**/*.js'
    ],
    rules: {
      'max-lines-per-function': ['warn', 60],
      'complexity': ['warn', 12]
    }
  }
];
