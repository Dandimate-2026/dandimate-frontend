/* 두루두루 웹 푸시 처리 (Workbox 서비스 워커가 importScripts로 불러온다)
 * 서버가 보내는 내용: { title, body, url, tag }
 * - title·body: 알림에 보이는 글
 * - url: 알림을 누르면 열 앱 안 주소 (예: /rooms/{roomId})
 * - tag: 같은 tag의 알림은 하나로 바꿔 쌓이지 않게 한다
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '두루두루'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '새 소식이 있어요',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

// 알림을 누르면 이미 열린 앱 창이 있으면 그 창을 그 주소로, 없으면 새로 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target
  try { target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin) } catch { target = new URL('/', self.location.origin) }
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(url).then((navigated) => (navigated || client).focus())
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
