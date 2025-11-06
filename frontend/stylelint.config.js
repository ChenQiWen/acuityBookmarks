// Stylelint configuration for Vue 3 + Vite project
// Enhanced auto-fix configuration for maximum automation
// Uses postcss-html to parse <style> blocks in .vue SFCs.

export default {
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/.vite/**'],

  // Enhanced extends for better auto-fixing
  extends: [
    'stylelint-config-standard',
    'stylelint-config-recommended-vue'
    // 注意：项目主要使用 CSS，暂不需要 SCSS 配置
    // 'stylelint-config-standard-scss', // 如果未来使用 SCSS 再启用
  ],

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
    // ✅ 自动修复：基础格式化
    indentation: 2, // 自动修复缩进
    'string-quotes': 'single', // 统一单引号
    'color-hex-case': 'lower', // 颜色小写
    'color-hex-length': 'short', // 短颜色值
    'number-leading-zero': 'never', // 去除前导零
    'number-no-trailing-zeros': true, // 去除尾随零
    'length-zero-no-unit': true, // 零值不要单位

    // ✅ 自动修复：声明格式化
    'declaration-bang-space-after': 'never', // !important 格式
    'declaration-bang-space-before': 'always',
    'declaration-colon-space-after': 'always', // 冒号后空格
    'declaration-colon-space-before': 'never',
    'declaration-block-semicolon-newline-after': [
      'always-multi-line',
      {
        // 多行声明才强制换行，单行允许保持单行
      }
    ],
    'declaration-block-semicolon-space-before': 'never',
    'declaration-block-trailing-semicolon': 'always', // 尾随分号

    // ✅ 自动修复：选择器格式化
    'selector-combinator-space-after': 'always', // 组合器空格
    'selector-combinator-space-before': 'always',
    'selector-descendant-combinator-no-non-space': true,
    'selector-list-comma-newline-after': [
      'always-multi-line',
      {
        // 多行选择器才强制换行，单行允许保持单行
      }
    ],
    'selector-list-comma-space-before': 'never',
    'selector-pseudo-class-case': 'lower', // 伪类小写
    'selector-pseudo-element-case': 'lower', // 伪元素小写
    'selector-type-case': 'lower', // 标签名小写

    // ✅ 自动修复：规则格式化
    'rule-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['after-comment']
      }
    ],
    'at-rule-empty-line-before': [
      'always',
      {
        except: ['blockless-after-same-name-blockless', 'first-nested'],
        ignore: ['after-comment']
      }
    ],

    // ✅ 自动修复：注释格式化
    'comment-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['stylelint-commands']
      }
    ],
    'comment-whitespace-inside': 'always',

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

    // ⚠️ 警告但不修复：可能需要人工判断的规则
    'declaration-no-important': 'warning', // !important 警告但不自动删除
    'selector-max-specificity': ['0,4,0', { severity: 'warning' }], // 选择器复杂度警告
    'rule-selector-property-disallowed-list': null, // 不限制特定属性

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
