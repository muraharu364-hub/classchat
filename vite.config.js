import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ベースパスを明示的に指定します
  base: './',
  build: {
    // 出力先をVercelの標準に合わせます
    outDir: 'dist',
  },
  server: {
    host: true
  }
})
