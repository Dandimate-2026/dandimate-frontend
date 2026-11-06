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
      // 실행 중인 화면을 다시 불러오지 않고, 다음 탐색부터 최신 버전을 사용합니다.
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
        skipWaiting: true,
        clientsClaim: false,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: 'index.html',
        // 아래 주소는 저장해 둔 앱 화면(index.html)으로 바꾸지 않고 반드시 백엔드 서버로 보낸다
        // (API, 카카오 로그인 시작·콜백, 백엔드가 직접 띄우는 Swagger 문서)
        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/,
          /^\/oauth2(?:\/|$)/,
          /^\/login\/oauth2(?:\/|$)/,
          /^\/swagger-ui(?:\.html|\/|$)/,
          /^\/openapi(?:\/|$)/,
          /^\/webjars(?:\/|$)/,
          // 결제 복귀는 최신 HTML로 열어, 구버전 앱의 라우트가 없는 화면으로 돌아가지 않게 한다.
          /^\/payments(?:\/|$)/,
        ],
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
    // 로컬 개발 시 /api 요청을 백엔드로 넘겨 CORS 문제를 피한다
    proxy: {
      '/api': {
        target: 'https://43-201-73-60.sslip.io',
        changeOrigin: true,
        // 백엔드가 localhost 출처(Origin) 요청을 403으로 막아서, 배포 주소에서 온 요청처럼 바꿔 보낸다
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            if (proxyReq.getHeader('origin')) proxyReq.setHeader('origin', 'https://43-201-73-60.sslip.io')
            const referer = proxyReq.getHeader('referer')
            if (typeof referer === 'string') proxyReq.setHeader('referer', referer.replace(/^http:\/\/localhost:\d+/, 'https://43-201-73-60.sslip.io'))
          })
        },
      },
      // 사진 업로드 주소(S3)도 localhost 출처를 막아서 프록시로 넘긴다. 서명에 host가 들어가 있어 changeOrigin이 필요하다
      '/__s3': {
        target: 'https://durooduroo-prod-hyukjin.s3.ap-northeast-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__s3/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
    },
  },
})
