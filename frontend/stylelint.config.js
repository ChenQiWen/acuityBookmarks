// Stylelint configuration for Vue 3 + Vite project
// 简化配置：移除已废弃的格式化规则，只保留代码质量检查
// Uses postcss-html to parse <style> blocks in .vue SFCs.

export default {
  ignoreFiles: [
    '**/dist/**',
    '**/node_modules/**',
    '**/.vite/**',
    '**/design-system/tokens.css' // 设计令牌文件允许硬编码颜色
  ],

  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],

  plugins: [
    './stylelint/no-motion-on-interaction.mjs',
    'stylelint-order' // CSS属性排序
  ],

  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    },
    {
      files: ['**/*.{css,scss}']
      // default parser is fine for plain CSS/SCSS
    }
  ],

  rules: {
    // ✅ 自动修复：选择器顺序（确保基础选择器在前，修饰选择器在后）
    'order/order': [
      'custom-properties',
      'dollar-variables',
      'at-rules',
      'declarations',
      {
        type: 'rule',
        selector: /^&/,
        before: true
      },
      {
        type: 'rule',
        selector: /^&::/,
        before: true
      },
      'rules'
    ],

    // ✅ 自动修复：属性排序（按逻辑分组）
    'order/properties-order': [
      // 定位
      'position',
      'top',
      'right',
      'bottom',
      'left',
      'inset',
      'z-index',
      // 显示
      'display',
      'flex-direction',
      'flex-wrap',
      'flex',
      'flex-grow',
      'flex-shrink',
      'flex-basis',
      'justify-content',
      'align-items',
      'align-self',
      'align-content',
      'gap',
      'row-gap',
      'column-gap',
      'grid-template-columns',
      'grid-template-rows',
      'grid-template-areas',
      'grid-auto-columns',
      'grid-auto-rows',
      'grid-auto-flow',
      'grid-column',
      'grid-row',
      'grid-area',
      'grid-gap',
      // 盒模型
      'box-sizing',
      'width',
      'min-width',
      'max-width',
      'height',
      'min-height',
      'max-height',
      'margin',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'border',
      'border-width',
      'border-style',
      'border-color',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left',
      'border-radius',
      'outline',
      'outline-offset',
      // 字体
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'text-align',
      'text-decoration',
      'text-transform',
      'letter-spacing',
      'word-spacing',
      'white-space',
      'color',
      // 背景
      'background',
      'background-color',
      'background-image',
      'background-repeat',
      'background-position',
      'background-size',
      'background-clip',
      // 视觉效果
      'opacity',
      'visibility',
      'cursor',
      'user-select',
      'pointer-events',
      // 变换和动画
      'transform',
      'transform-origin',
      'transition',
      'transition-property',
      'transition-duration',
      'transition-timing-function',
      'transition-delay',
      'animation',
      'animation-name',
      'animation-duration',
      'animation-timing-function',
      'animation-delay',
      'animation-iteration-count',
      'animation-direction',
      'animation-fill-mode',
      // 溢出
      'overflow',
      'overflow-x',
      'overflow-y',
      'text-overflow',
      // 其他
      'content',
      'quotes',
      'list-style',
      'table-layout',
      'caption-side',
      'empty-cells'
    ],

    // ========================================
    // 🎨 CSS 统一化规则 - 强制使用设计系统变量
    // ========================================

    // 禁止硬编码颜色（必须使用 var(--color-*)）
    'color-named': 'never', // 禁止颜色名称如 red, blue
    'color-no-hex': [
      true,
      {
        severity: 'warning',
        message: '请使用 CSS 变量，如 var(--color-primary)，而非硬编码颜色'
      }
    ],

    // 禁止硬编码数值（警告级别，逐步迁移）
    'declaration-property-value-disallowed-list': [
      {
        // 间距属性禁止使用像素值（应使用 var(--spacing-*)）
        '/^(padding|margin|gap)/': ['/^\\d+px$/'],
        // 字号禁止使用像素值（应使用 var(--text-*) 或 var(--font-size-*)）
        'font-size': ['/^\\d+px$/'],
        // 圆角禁止使用像素值（应使用 var(--radius-*)）
        'border-radius': ['/^\\d+px$/']
      },
      {
        severity: 'warning',
        message:
          '建议使用 CSS 变量，如 var(--spacing-4)、var(--text-base)、var(--radius-md)'
      }
    ],

    // ⚠️ 警告但不修复：可能需要人工判断的规则
    'declaration-no-important': null, // 允许 !important（有时需要）
    'selector-max-specificity': ['0,4,0', { severity: 'warning' }], // 选择器复杂度警告（仅警告，不阻止提交）
    'rule-selector-property-disallowed-list': null, // 不限制特定属性

    // 🔧 自动修复：数值精度（自动修复小数位数）
    'number-max-precision': 4, // 最多4位小数

    // 🔧 自动修复：命名规范（keyframe 名称使用 kebab-case）
    'keyframes-name-pattern': '^[a-z][a-z0-9-]*$', // kebab-case

    // ⚠️ 无法自动修复：需要手动处理的规则
    'no-duplicate-selectors': [true, { severity: 'error' }], // 重复选择器需要手动删除

    // 🔧 放宽的规则：避免过度严格
    'block-no-empty': null, // 允许空块（有时用于占位）
    'no-empty-source': null, // 允许空文件
    'selector-class-pattern': null, // 不限制类名模式（允许BEM等）
    'custom-property-pattern': null, // 不限制CSS变量名
    'value-keyword-case': null, // 不强制关键字大小写
    'property-no-unknown': null, // 允许未知属性（CSS变量等）

    // 🎯 Vue 特殊支持
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['v-bind', 'theme', 'var'] // var() 用于 CSS 变量
      }
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'slotted', 'global', 'v-deep'] // Vue 3 深度选择器
      }
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted'] // Vue 2 兼容写法
      }
    ],

    // Prefer opacity/background/shadow/outline over geometric changes on interactions
    'acuity/no-motion-on-interaction': [
      true,
      {
        // allow-list examples: color, background, opacity, box-shadow, outline, text-decoration
        // everything else that changes geometry under :hover/:focus/:active will be flagged by the plugin
      }
    ]
  }
}
