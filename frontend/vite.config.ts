import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: resolve(__dirname, '../dist'),
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        management: resolve(__dirname, 'management.html'),
      },
    },
  },
})
