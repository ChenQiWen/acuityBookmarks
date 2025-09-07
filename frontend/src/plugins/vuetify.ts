// plugins/vuetify.ts
import { createVuetify, type ThemeDefinition } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
// 使用字体图标而不是SVG图标
import '@mdi/font/css/materialdesignicons.css';
import { colors } from '../utils/design-tokens'; // Corrected import path

// Define the custom theme based on design tokens
const acuityTheme: ThemeDefinition = {
  dark: false, // or you can support dark mode if needed
  colors: {
    primary: colors.primary.primary,
    'on-primary': colors.primary.onPrimary,
    'primary-container': colors.primary.primaryContainer,
    'on-primary-container': colors.primary.onPrimaryContainer,
    secondary: colors.secondary.secondary,
    'on-secondary': colors.secondary.onSecondary,
    'secondary-container': colors.secondary.secondaryContainer,
    'on-secondary-container': colors.secondary.onSecondaryContainer,
    tertiary: colors.tertiary.tertiary,
    'on-tertiary': colors.tertiary.onTertiary,
    'tertiary-container': colors.tertiary.tertiaryContainer,
    'on-tertiary-container': colors.tertiary.onTertiaryContainer,
    surface: colors.surface.surface,
    'on-surface': colors.surface.onSurface,
    'surface-variant': colors.surface.surfaceVariant,
    'on-surface-variant': colors.surface.onSurfaceVariant,
    background: colors.background.background,
    'on-background': colors.background.onBackground,
    error: colors.error.error,
    'on-error': colors.error.onError,
    'error-container': colors.error.errorContainer,
    'on-error-container': colors.error.onErrorContainer,
    success: colors.success.success,
    'on-success': colors.success.onSuccess,
    'success-container': colors.success.successContainer,
    'on-success-container': colors.success.onSuccessContainer,
    warning: colors.warning.warning,
    'on-warning': colors.warning.onWarning,
    'warning-container': colors.warning.warningContainer,
    'on-warning-container': colors.warning.onWarningContainer,
    outline: colors.outline.outline,
    'outline-variant': colors.outline.outlineVariant,
  }
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'acuityTheme',
    themes: {
      acuityTheme,
    },
  },
  icons: {
    defaultSet: 'mdi',
  },
});
