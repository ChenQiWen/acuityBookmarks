/**
 * 🎯 前端 ESLint 配置 - Vue 3 + TypeScript + Chrome Extension
 * 专为 AcuityBookmarks 前端优化
 */

import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default [
  // 🎯 忽略文件
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.min.js',
      'public/**',
      'scripts/**/*.cjs',
      '.vite/**',
      'coverage/**',
      // 🎯 忽略所有 JSON 文件 (避免引号冲突)
      '**/*.json'
    ]
  },

  // 🔥 JavaScript 基础配置
  js.configs.recommended,

  // 🎨 Vue 3 配置
  ...pluginVue.configs['flat/recommended'],

  // ⚡ TypeScript 配置
  ...tseslint.configs.recommended,

  // 🎯 全局配置
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // 🌐 Chrome Extension API
        chrome: 'readonly',

        // 🔥 Vite 全局变量
        import: 'readonly',

        // 🎯 浏览器环境
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',

        // 🔧 开发环境
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',

        // 🎮 DOM Events & Elements
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        FocusEvent: 'readonly',
        DragEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLImageElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        ParentNode: 'readonly',

        // 🌐 Web APIs
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        // 🧵 Web Worker APIs
        Worker: 'readonly',
        MessageEvent: 'readonly',

        // 🎯 Performance & Animation APIs
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        ScrollBehavior: 'readonly',

        // 🔧 Utility APIs
        btoa: 'readonly',
        atob: 'readonly',
        CSS: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',

        // 👀 Observer APIs
        IntersectionObserver: 'readonly'
      }
    },

    rules: {
      // 🎯 代码质量规则 - 开发友好模式
      'no-console': 'off', // 完全允许console.log等调试语句，开发时经常需要
      'no-debugger': 'error', // 禁用debugger语句，生产环境必须移除
      'no-alert': 'off', // 完全允许alert/confirm/prompt，开发时用于用户交互
      'no-eval': 'error', // 禁用eval()函数，存在安全风险和性能问题
      'no-implied-eval': 'error', // 禁用隐式eval，如setTimeout('code')等形式
      'no-empty': 'off', // 允许空代码块，如空的catch语句在某些场景下是合理的

      // 🚀 TypeScript 优化 - 宽松模式
      '@typescript-eslint/no-explicit-any': 'off', // 允许使用any类型，在复杂类型推断困难时提供灵活性
      '@typescript-eslint/no-unused-vars': ['warn', { // 检测未使用的变量，但允许_开头的变量
        argsIgnorePattern: '^_', // 忽略_开头的参数，如(_req, res) => {}
        varsIgnorePattern: '^_', // 忽略_开头的变量，如const _temp = getValue()
        ignoreRestSiblings: true, // 忽略剩余属性，如const {a, ...rest} = obj
        destructuredArrayIgnorePattern: '^_' // 忽略数组解构中_开头的元素，如const [, _second] = arr
      }],
      '@typescript-eslint/no-non-null-assertion': 'off', // 允许非空断言(!)，开发者明确知道值不为null时使用
      '@typescript-eslint/ban-ts-comment': 'off', // 允许@ts-ignore等TypeScript注释，紧急情况下绕过类型检查
      '@typescript-eslint/no-unsafe-function-type': 'off', // 允许不安全的函数类型，如Function类型
      '@typescript-eslint/no-empty-object-type': 'off', // 允许空对象类型{}，某些泛型场景下需要

      // 🎨 Vue 3 最佳实践 - 宽松模式
      'vue/multi-word-component-names': 'off', // 允许单词组件名，如Button.vue，提高开发灵活性
      'vue/component-definition-name-casing': 'off', // 不限制组件定义名称大小写，允许kebab-case和PascalCase混用
      'vue/component-name-in-template-casing': 'off', // 不限制模板中组件名大小写，允许<my-button>和<MyButton>混用
      'vue/prop-name-casing': 'warn', // prop名应使用camelCase，但只警告不报错，如myProp而非my-prop
      'vue/attribute-hyphenation': 'off', // 允许各种HTML属性命名风格，不强制kebab-case
      'vue/v-bind-style': 'off', // 允许v-bind完整写法和:简写混用，不强制统一
      'vue/v-on-style': 'off', // 允许v-on完整写法和@简写混用，不强制统一

      // 🔥 Vue模板格式 - 禁用严格规则
      'vue/max-attributes-per-line': 'off', // 不限制每行最大属性数，允许多个属性在同一行提高紧凑性
      'vue/first-attribute-linebreak': 'off', // 不强制第一个属性必须换行，允许灵活的代码布局
      'vue/html-closing-bracket-newline': 'off', // 不强制HTML标签的闭合括号换行，允许>和/>在任意位置
      'vue/html-closing-bracket-spacing': 'off', // 不强制闭合标签前的空格，允许<div>和<div >两种写法
      'vue/html-indent': 'off', // 不强制HTML模板的缩进规则，允许开发者自定义缩进风格
      'vue/html-self-closing': 'off', // 允许各种自闭合标签风格，<img/>和<img>都可以
      'vue/singleline-html-element-content-newline': 'off', // 单行元素内容不强制换行，允许<div>text</div>
      'vue/multiline-html-element-content-newline': 'off', // 多行元素内容不强制换行，布局更灵活

      // 🛡️ 安全相关 - 完全宽松模式  
      'vue/no-v-html': 'off', // 允许v-html指令，开发者自行控制安全性
      'vue/no-v-text-v-html-on-component': 'off', // 允许在组件上使用v-text/v-html
      'vue/no-multi-spaces': 'off', // 允许多个空格，不强制格式化

      // 🔧 Vue属性顺序 - 完全禁用
      'vue/attributes-order': 'off', // 不强制HTML属性的特定顺序，提高开发自由度

      // 🔥 Composition API 优化 - 放宽
      'vue/prefer-import-from-vue': 'off', // 不强制从vue包导入，允许从@vue/composition-api等导入
      'vue/prefer-separate-static-class': 'off', // 不强制分离静态class和动态class，允许混合使用
      'vue/prefer-true-attribute-shorthand': 'off', // 不强制布尔属性简写，允许:show="true"和show混用

      // 🛡️ Chrome Extension 安全 (移除重复的 no-eval)
      'no-new-func': 'error', // 禁用Function构造函数，防止代码注入攻击

      // 🎯 性能优化 - 宽松模式
      'prefer-const': 'warn', // 推荐使用const声明不变的变量，但只警告不强制
      'no-var': 'error', // 强制禁用var关键字，避免变量提升和作用域混乱
      'object-shorthand': 'off', // 允许对象属性完整写法，不强制{name: name}简写为{name}
      'prefer-template': 'off', // 允许字符串拼接，不强制使用模板字符串`${}`
      'prefer-destructuring': 'off', // 不强制使用解构赋值，允许obj.prop和const {prop} = obj混用

      // 🔧 代码风格 - 放宽
      'quotes': 'off', // 不限制引号类型，允许单引号'和双引号"混用
      'semi': 'off', // 不强制分号，交由Prettier等代码格式化工具处理
      'comma-dangle': 'off', // 不强制尾随逗号，允许[1, 2,]和[1, 2]两种风格
      'eol-last': 'off', // 不强制文件末尾必须有空行，减少格式化争议

      // 📝 其他宽松规则
      'no-useless-catch': 'off', // 允许看似无用的catch块，有时用于日志记录或错误转换
      'no-prototype-builtins': 'off', // 允许直接调用prototype方法，如obj.hasOwnProperty()
      'no-fallthrough': 'warn', // switch语句fall-through只警告，有时是有意设计
      'no-unreachable': 'warn', // 不可达代码只警告，开发时可能临时存在
      'no-constant-condition': 'warn', // 常量条件只警告，如while(true)循环有时是必要的

      // 🎯 复杂度和性能相关 - 大幅放宽
      'complexity': 'off', // 不限制代码圈复杂度，避免过度拆分合理的复杂逻辑
      'max-lines': 'off', // 不限制文件总行数，大型组件文件可能需要更多行
      'max-lines-per-function': 'off', // 不限制函数行数，复杂业务逻辑可能需要较长函数
      'max-statements': 'off', // 不限制函数内语句数量，避免强制过度拆分
      'max-depth': 'off', // 不限制代码嵌套深度，复杂条件判断可能需要多层嵌套
      'max-params': 'off', // 不限制函数参数数量，某些工具函数可能需要多个参数
      'max-nested-callbacks': 'off', // 不限制回调函数嵌套层数，异步操作可能需要深层嵌套
      'no-magic-numbers': 'off', // 允许魔法数字，如状态码、像素值等常见数字

      // 📦 Import 优化
      'no-duplicate-imports': 'error' // 禁止从同一模块重复导入，避免代码冗余和混乱
    }
  },

  // 🎯 TypeScript 文件特定规则
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TypeScript 严格检查 - 宽松模式
      '@typescript-eslint/strict-boolean-expressions': 'off', // 不强制严格的布尔表达式，允许if(str)等简写
      '@typescript-eslint/explicit-function-return-type': 'off', // 不强制显式函数返回类型，依赖类型推断
      '@typescript-eslint/explicit-module-boundary-types': 'off' // 不强制导出函数的显式类型，提高开发效率
    }
  },

  // 🎨 Vue 文件特定规则
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: pluginVue.configs['flat/recommended'][1].languageOptions.parser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      // Vue 组件优化 - 完全宽松模式
      'vue/block-tag-newline': 'off', // 不强制<template><script><style>标签前后换行

      // 🎯 Vue特定的宽松规则  
      'vue/mustache-interpolation-spacing': 'off', // 不限制插值表达式间距，允许{{ value }}和{{value}}
      'vue/no-spaces-around-equal-signs-in-attribute': 'off', // 不限制HTML属性等号周围空格，允许prop="value"和prop = "value"
      'vue/v-slot-style': 'off', // 允许各种slot语法风格，v-slot:default和#default都可以
      'vue/component-tags-order': 'off', // 不强制<template><script><style>的标签顺序
      'vue/padding-line-between-blocks': 'off', // 不强制Vue文件中各个块之间必须有空行
      'vue/require-default-prop': 'off', // 不强制prop必须有默认值，提高灵活性
      'vue/require-prop-types': 'off', // 不强制prop必须定义类型，允许简化写法
      'vue/order-in-components': 'off', // 不强制Vue组件选项的特定顺序，如data、methods等
      'vue/this-in-template': 'off', // 允许在模板中使用this.property，不强制省略this
      'vue/no-unused-components': 'warn', // 未使用的组件只警告不报错，开发时可能暂时未使用
      'vue/no-unused-vars': 'warn' // 模板中未使用的变量只警告，避免开发时频繁报错
    }
  },

  // 🔧 Node.js CommonJS 文件规则
  {
    files: [
      'scripts/**/*.js',
      'scripts/**/*.cjs',
      'start-demo-server.cjs',
      '**/*.cjs'
    ],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off', // 允许在CommonJS文件中使用require导入
      'no-undef': 'off', // Node.js环境下允许使用全局变量，如process、__dirname等
      'no-console': 'off', // Node.js脚本中允许使用console，用于日志输出
      '@typescript-eslint/no-unused-vars': 'off' // Node.js脚本中允许未使用变量，如错误处理参数
    }
  },

  // 🔧 配置文件宽松规则
  {
    files: [
      'vite.config.ts',    // Vite构建配置文件
      'vitest.config.ts',  // Vitest测试配置文件
      '**/*.config.js',    // 各种JS配置文件
      '**/*.config.ts'     // 各种TS配置文件
    ],
    rules: {
      'no-console': 'off', // 配置文件中允许console，用于构建日志
      '@typescript-eslint/no-explicit-any': 'off', // 配置文件中允许any类型，配置项可能类型复杂
      '@typescript-eslint/no-unused-expressions': 'off' // 配置文件中允许未使用的表达式，如插件调用
    }
  }
];
