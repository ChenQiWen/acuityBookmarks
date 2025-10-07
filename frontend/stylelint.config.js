// Stylelint configuration for Vue 3 + Vite project
// Enforces our "no motion on hover/focus/active" policy via a custom plugin.
// Uses postcss-html to parse <style> blocks in .vue SFCs.

export default {
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/.vite/**'],
  // Keep config minimal; focus on our custom motion policy for now.
  extends: [],
  plugins: ['./stylelint/no-motion-on-interaction.mjs'],
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
    // Light hygiene (kept minimal). Most defaults disabled to avoid churn.
    'block-no-empty': true,
    'no-empty-source': null,
    // Vue SFC specific allowances
    'function-no-unknown': [true, { ignoreFunctions: ['v-bind'] }],
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['deep'] }
    ],
    // Allow BEM/utility class names & complex selectors
    'selector-class-pattern': null,
    'selector-not-notation': null,
    'value-keyword-case': null,
    'selector-pseudo-element-colon-notation': null,
    'declaration-block-no-shorthand-property-overrides': null,
    // Allow any naming for CSS custom properties (editor-level relaxation)
    'custom-property-pattern': null,

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
