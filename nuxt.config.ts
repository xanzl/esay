import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  srcDir: 'app',
  ssr: false,

  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  modules: ['@pinia/nuxt'],

  nitro: {
    preset: process.env.NITRO_PRESET ?? 'cloudflare_module',
    compatibilityDate: '2025-07-15',
    scanDirs: [fileURLToPath(new URL('./server', import.meta.url))],
  },

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'esay · 我的说说',
      meta: [
        { name: 'description', content: 'esay 是一款极简的个人说说系统，记录日常动态与想法。' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#6366f1' },
      ],
      script: [
        {
          innerHTML: `(function(){try{var t=localStorage.getItem('moment-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          type: 'text/javascript',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      exclude: ['../Ech0', '../Ech0/**/*'],
    },
  },
})
