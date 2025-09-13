/**
 * 🎯 AcuityBookmarks ESLint 配置
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import js from '@eslint/js';

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
      '**/*.log'
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
        clearInterval: 'readonly'
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      
      // 🎯 代码质量
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // 🚀 性能优化
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      
      // 🎨 代码风格
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-trailing': 'off', // Bun 处理
      'eol-last': 'error',
      
      // 🛡️ Chrome Extension 安全
      'no-new-func': 'error',
      'no-eval': 'error',
      
      // 🔧 Bun 优化
      'prefer-template': 'error',
      'object-shorthand': 'error'
    }
  },

  // 📦 Backend 特定规则
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        // Bun 特定全局变量
        Bun: 'readonly',
        // Node.js 兼容
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // 🎯 后端特定规则
      'no-process-exit': 'warn',
      'no-sync': 'warn',
      
      // 🔥 Bun 最佳实践
      'prefer-template': 'error',
      'no-magic-numbers': ['warn', { 
        ignore: [0, 1, -1, 200, 404, 500],
        ignoreArrayIndexes: true 
      }]
    }
  }
];
