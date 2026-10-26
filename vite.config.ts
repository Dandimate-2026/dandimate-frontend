import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 실행 중인 화면은 유지하고 모든 앱 창을 닫은 뒤 새 버전을 활성화합니다.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      includeAssets: ['fonts/Pretendard-LICENSE.txt'],
      manifest: {
        id: '/',
        name: '단디메이트',
        short_name: '단디메이트',
        description: '단디메이트 모바일 웹앱',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [
          {
            // 필요한 글꼴 서브셋만 캐시해 최초 방문 시 전체 폰트 다운로드를 피합니다.
            urlPattern: /\/assets\/PretendardVariable\..*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dandimate-fonts',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    open: true,
  },
})
