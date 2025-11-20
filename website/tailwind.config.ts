import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default <Config>{
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'MiSans', ...defaultTheme.fontFamily.sans]
      },
      colors: {
        // 深空背景
        bg: {
          depth: '#02040a', // 最深背景
          default: '#030617', // 默认背景
          surface: '#0f172a' // 表面层
        },
        // 品牌色 - 保持原有的蓝紫渐变基因，但更现代
        primary: {
          400: '#38bdf8', // Sky 400
          500: '#0ea5e9', // Sky 500
          600: '#0284c7' // Sky 600
        },
        accent: {
          400: '#a78bfa', // Violet 400
          500: '#8b5cf6', // Violet 500
          600: '#7c3aed' // Violet 600
        },
        // 文本色
        content: {
          DEFAULT: '#f8fafc', // Slate 50
          muted: '#94a3b8', // Slate 400
          subtle: '#64748b' // Slate 500
        },
        // 边框
        border: {
          DEFAULT: 'rgba(148, 163, 184, 0.1)',
          hover: 'rgba(148, 163, 184, 0.2)',
          active: 'rgba(56, 189, 248, 0.4)'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow':
          'conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
