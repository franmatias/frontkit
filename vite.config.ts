import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/frontkit/' : '/'),
  plugins: [vue(), tailwind()],
  build: { manifest: true },
}))
