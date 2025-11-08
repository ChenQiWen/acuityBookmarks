// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SEO 模块配置
  modules: ['@nuxtjs/seo'],

  // 站点配置
  site: {
    url: 'https://acuitybookmarks.com',
    name: 'AcuityBookmarks',
    description: 'AI 驱动的智能书签管理工具，让您的书签井然有序',
    defaultLocale: 'zh-CN'
  },

  // SEO 配置
  seo: {
    redirectToCanonicalSiteUrl: true
  },

  // 应用配置
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'AcuityBookmarks - AI 驱动的智能书签管理',
      meta: [
        {
          name: 'description',
          content:
            'AcuityBookmarks 是一款基于 AI 技术的 Chrome 浏览器扩展，专为解决书签混乱、查找困难等问题而设计。支持 2 万+ 书签的流畅管理，本地优先，隐私安全。'
        },
        {
          name: 'keywords',
          content: '书签管理,AI 书签,Chrome 扩展,智能书签,书签整理,浏览器扩展'
        }
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },

  // 运行时配置
  runtimeConfig: {
    // 私有配置（仅在服务端可用）
    apiSecret: process.env.NUXT_API_SECRET || '',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    brevoApiKey: process.env.BREVO_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    // 公共配置（客户端和服务端都可用）
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://acuitybookmarks.com'
    }
  },

  // TypeScript 配置
  typescript: {
    strict: true,
    typeCheck: false // 禁用开发时的类型检查，避免 vite-plugin-checker 错误
  },

  // 开发服务器配置
  devServer: {
    port: 3001,
    host: 'localhost'
  }
})
