import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 기존 앱 설정과 라우터를 수정하지 않는 독립 미리보기 빌드.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-memories',
    rollupOptions: { input: resolve(import.meta.dirname, 'memories.html') },
  },
})
