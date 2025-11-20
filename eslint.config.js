/**
 * 🎯 AcuityBookmarks ESLint 配置（简化版）
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'

// ============================================================================
// 📦 公共配置
// ============================================================================

/**
 * 公共全局变量
 */
const commonGlobals = {
  // 标准 Web APIs
  console: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  AbortController: 'readonly',
  performance: 'readonly',
  // Node.js 兼容
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly'
}

/**
 * Bun 全局变量
 */
const bunGlobals = {
  Bun: 'readonly',
  ...commonGlobals
}

/**
 * Cloudflare Worker 全局变量
 */
const workerGlobals = {
  ...commonGlobals,
  URLSearchParams: 'readonly',
  FormData: 'readonly',
  ReadableStream: 'readonly',
  WritableStream: 'readonly',
  TransformStream: 'readonly',
  crypto: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly'
}

/**
 * Chrome Extension 全局变量
 */
const chromeGlobals = {
  ...commonGlobals,
  chrome: 'readonly',
  indexedDB: 'readonly'
}

/**
 * Service Worker 全局变量
 */
const serviceWorkerGlobals = {
  ...chromeGlobals,
  self: 'readonly',
  clients: 'readonly'
}

/**
 * 公共代码质量规则
 */
const commonCodeQualityRules = {
  'no-console': 'off', // 允许 console 输出
  'no-debugger': 'error',
  'no-alert': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-unreachable': 'error',
  'no-undef': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'no-empty': 'warn'
}

/**
 * 公共代码风格规则
 */
const commonStyleRules = {
  quotes: ['error', 'single'],
  semi: ['error', 'never'],
  'eol-last': 'error',
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'prefer-arrow-callback': 'error',
  'prefer-destructuring': ['error', { array: false, object: true }],
  'prefer-spread': 'error',
  'prefer-rest-params': 'error',
  'no-duplicate-imports': 'error',
  'no-throw-literal': 'error',
  'prefer-promise-reject-errors': 'error',
  'no-return-await': 'error',
  'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
  'no-trailing-spaces': 'error',
  'space-before-blocks': 'error',
  'keyword-spacing': 'error',
  'comma-spacing': 'error',
  'key-spacing': 'error',
  'object-curly-spacing': ['error', 'always'],
  'prefer-numeric-literals': 'error',
  'no-implicit-coercion': 'error',
  radix: 'error'
}

/**
 * Unused imports 配置（统一配置）
 */
const unusedImportsConfig = {
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

/**
 * TypeScript 公共规则
 */
const typescriptCommonRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-unused-expressions': 'off',
  'no-unreachable': 'error',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-var-requires': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/ban-ts-comment': 'warn',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/prefer-as-const': 'warn',
  '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
  '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
  '@typescript-eslint/consistent-type-imports': 'warn',
  '@typescript-eslint/no-import-type-side-effects': 'warn',
  '@typescript-eslint/prefer-literal-enum-member': 'warn',
  '@typescript-eslint/prefer-enum-initializers': 'warn',
  ...unusedImportsConfig
}

// ============================================================================
// 🎯 主配置
// ============================================================================

export default [
  // 基础忽略配置
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
      '**/*.sh',
      '**/*.bash',
      'vite.config.ts',
      '**/.wrangler/**' // wrangler 自动生成的临时文件
    ]
  },

  // JavaScript 基础配置
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...bunGlobals,
        chrome: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...js.configs.recommended.rules,
      ...commonCodeQualityRules,
      ...commonStyleRules,
      'no-unused-vars': 'off',
      ...unusedImportsConfig,
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false
        }
      ]
    }
  },

  // Vue 3 基础配置
  ...pluginVue.configs['flat/recommended'],

  // TypeScript 基础配置
  ...tseslint.configs.recommended,

  // Prettier 配置（必须最后）
  prettierConfig,

  // Vue 文件配置
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
      // Vue 特定规则（宽松配置）
      'vue/multi-word-component-names': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/no-v-html': 'off',
      'vue/no-use-v-if-with-v-for': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-required-prop-with-default': 'off',
      // TypeScript 规则
      ...typescriptCommonRules
    }
  },

  // TypeScript 文件配置
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx', 'backend/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...typescriptCommonRules
    }
  },

  // ES Module 脚本配置
  {
    files: ['scripts/enhance-autofix.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...commonGlobals,
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-process-exit': 'warn',
      'no-sync': 'warn',
      'no-throw-literal': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-new-object': 'error',
      'no-new-symbol': 'error',
      'no-new': 'error',
      'no-console': 'off',
      'no-unused-vars': 'error'
    }
  },

  // Backend (Cloudflare Worker + Bun) 配置
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        ...workerGlobals,
        Bun: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-process-exit': 'warn',
      'no-sync': 'warn',
      'no-console': 'off',
      'prefer-template': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': 'warn',
      'no-magic-numbers': 'off'
    }
  },

  // Backend TypeScript 配置 - 放宽类型限制以适配 Cloudflare Worker API
  {
    files: ['backend/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Worker API 类型不完整
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },

  // Background Script 配置
  {
    files: ['background.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...serviceWorkerGlobals,
        openManagementPageWithAI: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-console': 'off',
      'no-empty': 'warn',
      'no-unused-vars': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-case-declarations': 'error',
      'no-useless-escape': 'warn',
      'no-magic-numbers': 'off'
    }
  },

  // Page-fetcher 脚本配置
  {
    files: ['page-fetcher.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...chromeGlobals,
        Promise: 'readonly',
        Date: 'readonly',
        Map: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },

  // Prettier 配置（必须最后）
  prettierConfig
]
