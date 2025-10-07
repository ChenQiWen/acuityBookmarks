/**
 * 🎯 AcuityBookmarks ESLint 配置
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

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
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // 🎨 代码风格
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'comma-trailing': 'off', // Bun 处理
      'eol-last': 'error',

      //  Bun 优化
      'prefer-template': 'error',
      'object-shorthand': 'error'
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
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/no-v-html': 'off',
      'vue/no-use-v-if-with-v-for': 'off'
    }
  },

  // 🔧 TypeScript 文件局部规则（轻量）
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-non-null-assertion': 'off'
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
      'no-magic-numbers': [
        'warn',
        {
          ignore: [0, 1, -1, 200, 404, 500],
          ignoreArrayIndexes: true
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
      'no-undef': 'error',
      'no-console': 'warn', // 扩展中的 console 是有用的调试信息
      'no-empty': 'warn', // 空的 catch 块在扩展中常见
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-case-declarations': 'warn', // switch 语句中的声明
      'no-useless-escape': 'warn', // 正则表达式转义
      'no-magic-numbers': 'off' // 扩展中常有魔法数字
    }
  }
]
