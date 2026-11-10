// 웹 푸시 알림: 알림 허용을 받고, 브라우저 구독 정보를 서버에 등록한다.
// 안드로이드·PC는 브라우저에서 바로, 아이폰(iOS 16.4+)은 홈 화면에 추가한 앱에서만 받을 수 있다
import { request } from '../api/client'
import { USE_MOCK } from '../api/mock'

/** 서버의 VAPID 공개키. 서버에서 받아 오고, 없으면 빌드 설정 값을 쓴다 */
const ENV_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState =
  | 'unsupported' // 이 브라우저는 웹 푸시를 못 받는다
  | 'ios-needs-install' // 아이폰 사파리: 홈 화면에 추가해야 받을 수 있다
  | 'denied' // 사용자가 알림을 막았다 (브라우저 설정에서 풀어야 한다)
  | 'default' // 아직 묻지 않았다
  | 'granted' // 허용했다

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function getPushState(): PushState {
  if (isIos() && !isStandalone()) return 'ios-needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission as PushState
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function getVapidKey() {
  const { enabled, publicKey } = await request<{ enabled: boolean; publicKey: string | null }>('/push/vapid-public-key')
  if (!enabled) throw new Error('현재 알림 서비스를 준비하고 있어요. 잠시 후 다시 시도해 주세요')
  const key = publicKey || ENV_VAPID_KEY
  if (!key) throw new Error('알림 설정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요')
  return key
}

/** 알림을 켠다: 허용을 묻고 → 구독하고 → 서버에 등록. 거절하거나 못 켜면 이유를 던진다 */
export async function enablePush() {
  const state = getPushState()
  if (state === 'ios-needs-install') throw new Error('아이폰은 홈 화면에 추가한 앱에서 알림을 받을 수 있어요')
  if (state === 'unsupported') throw new Error('이 브라우저에서는 알림을 받을 수 없어요')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림이 꺼져 있어요. 휴대폰 설정에서 알림을 허용해 주세요')
  if (USE_MOCK) return
  const vapidKey = await getVapidKey()
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }))
  await request('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
}

/** 알림을 끈다: 서버 등록을 지우고 이 기기 구독을 해제한다 */
export async function disablePush() {
  if (USE_MOCK || !('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await request('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } })
  await subscription.unsubscribe()
}

/** 이 기기가 지금 알림을 받도록 등록돼 있는지 */
export async function isPushEnabled() {
  if (getPushState() !== 'granted' || !('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  if (USE_MOCK) return true
  // 서버 세션/등록이 사라졌어도 기존 브라우저 구독을 다시 등록하여 복구한다.
  try {
    await getVapidKey()
    await request('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
    return true
  } catch {
    return false
  }
}

const DISMISS_KEY = 'duruduru:push-banner-dismissed'
export function isPushBannerDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}
export function dismissPushBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // 무시
  }
}
