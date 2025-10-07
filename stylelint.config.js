// Stylelint configuration for Vue 3 + Vite project
// Enhanced auto-fix configuration for maximum automation
// Uses postcss-html to parse <style> blocks in .vue SFCs.

export default {
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/.vite/**'],

  // Enhanced extends for better auto-fixing
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-scss',
    'stylelint-config-recommended-vue'
  ],

  plugins: [
    './frontend/stylelint/no-motion-on-interaction.mjs',
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
    'declaration-block-semicolon-newline-after': 'always', // 分号后换行
    'declaration-block-semicolon-space-before': 'never',
    'declaration-block-trailing-semicolon': 'always', // 尾随分号

    // ✅ 自动修复：选择器格式化
    'selector-combinator-space-after': 'always', // 组合器空格
    'selector-combinator-space-before': 'always',
    'selector-descendant-combinator-no-non-space': true,
    'selector-list-comma-newline-after': 'always', // 选择器换行
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
      'z-index',
      // 显示
      'display',
      'flex-direction',
      'flex-wrap',
      'justify-content',
      'align-items',
      'grid-template-columns',
      'grid-template-rows',
      'grid-gap',
      // 盒模型
      'box-sizing',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      // 字体
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'color',
      // 背景
      'background',
      'background-color',
      'background-image',
      // 其他
      'opacity',
      'transform',
      'transition',
      'animation'
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
    'function-no-unknown': [true, { ignoreFunctions: ['v-bind', 'theme'] }],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'slotted', 'global']
      }
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted']
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
