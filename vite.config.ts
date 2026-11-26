import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/frontkit/' : '/'),
  plugins: [vue(), tailwind()],
  worker: { format: 'es', rollupOptions: { output: { chunkFileNames: 'assets/worker-chunk-[name]-[hash].js' } } },
  build: {
    manifest: true,
    rollupOptions: { output: { manualChunks: { emmet: ['emmet'] } } },
  },
}))
