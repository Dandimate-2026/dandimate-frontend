// 토스 테스트 결제: 서버에 주문을 만들고 → 토스 결제창에서 결제하고 → 돌아와서 서버가 승인한다.
// 가격은 서버가 정하고, 승인이 끝나면 서버가 방을 만들거나(새 방) 플랜을 올린다(기존 방)
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { paths } from '../routes/paths'
import { request } from './client'
import { USE_MOCK } from './mock'
import { currentConsent } from './rooms'
import type { CreateRoomRequest, RoomPlanType } from './types'

/** 토스 결제창용 클라이언트 키 (test_ck_…). 백엔드의 테스트 시크릿 키와 같은 상점의 키여야 한다 */
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined

/** 백엔드와 같은 상점의 테스트 키가 있을 때만 결제창을 연다. */
export const TOSS_ENABLED = !USE_MOCK && Boolean(TOSS_CLIENT_KEY?.startsWith('test_ck_'))

export type PaymentOrderStatus = 'READY' | 'PROCESSING' | 'DONE' | 'FAILED'

export interface PaymentOrder {
  orderType?: 'ROOM' | 'CREDIT'
  orderId: string
  orderName: string
  /** 서버가 정한 결제 금액 (원) */
  amount: number
  currency: 'KRW'
  status: PaymentOrderStatus
  /** 새 방은 승인(DONE) 뒤에 생긴다. 그 전에는 null */
  roomId: string | null
  fromPlan: RoomPlanType | null
  targetPlan: RoomPlanType | null
  testMode: true
}

/** 유료 플랜(LITE·PRO)으로 새 방을 만드는 주문. 방은 결제 승인 뒤 서버가 만든다 */
export async function createRoomOrder(body: Omit<CreateRoomRequest, 'consent'>) {
  return request<PaymentOrder>('/payments/room-orders', {
    method: 'POST',
    body: { ...body, consent: await currentConsent() },
    idempotent: true,
  })
}

/** 방장이 이미 있는 방의 플랜을 올리는 주문 (차액만 결제) */
export function createPlanOrder(roomId: string, planType: RoomPlanType) {
  return request<PaymentOrder>(`/rooms/${roomId}/plan-orders`, {
    method: 'POST',
    body: { planType },
    idempotent: true,
  })
}

/** 두루 챗봇 질문 크레딧 묶음 주문 (계정 단위). 승인되면 서버가 크레딧을 적립한다 */
export function createCreditOrder(packId: string) {
  return request<PaymentOrder>('/payments/credit-orders', {
    method: 'POST',
    body: { packId },
    idempotent: true,
  })
}

/** 토스 결제창에서 돌아온 값으로 서버에 승인을 요청한다. 같은 값으로 다시 불러도 한 번만 적용된다 */
export function confirmPayment(body: { orderId: string; paymentKey: string; amount: number }) {
  return request<PaymentOrder>('/payments/confirm', { method: 'POST', body })
}

export function getPaymentOrder(orderId: string) {
  return request<PaymentOrder>(`/payments/orders/${orderId}`)
}

/** 토스 결제창에 다녀오는 동안 기억해 둘 값 (페이지가 통째로 바뀌어서 sessionStorage에 둔다) */
export interface PendingPayment {
  orderId: string
  /** 소문자 플랜 id (lite·pro) */
  plan: string
  /** 기존 방 플랜 변경이면 방 id, 새 방이면 없음 */
  roomId?: string
  roomName?: string
  /** 두루 챗봇 크레딧 구매면 'credits' (방·플랜과 상관없다) */
  kind?: 'credits'
}

const PENDING_KEY = 'duruduru:pending-payment'

export function savePendingPayment(value: PendingPayment) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(value))
  } catch {
    // 저장하지 못해도 결제 승인은 주문 정보로 진행할 수 있다
  }
}

export function getPendingPayment(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingPayment) : null
  } catch {
    return null
  }
}

export function clearPendingPayment() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // 무시
  }
}

/** 화면에서 고른 결제 수단 → 토스 결제창 수단 (간편결제는 카드 결제창 안에서 고른다) */
export type TossMethod = 'CARD' | 'TRANSFER' | 'MOBILE_PHONE'

/** 토스 결제창을 연다. 결제가 끝나면 successUrl, 실패·취소하면 failUrl로 페이지가 이동한다 */
export async function openTossPayment(order: PaymentOrder, method: TossMethod) {
  if (!TOSS_CLIENT_KEY) throw new Error('토스 결제 키가 설정되지 않았어요')
  const toss = await loadTossPayments(TOSS_CLIENT_KEY)
  const origin = window.location.origin
  const common = {
    amount: { currency: 'KRW' as const, value: order.amount },
    orderId: order.orderId,
    orderName: order.orderName,
    successUrl: `${origin}${paths.paymentSuccess()}`,
    failUrl: `${origin}${paths.paymentFail()}`,
  }
  const payment = toss.payment({ customerKey: ANONYMOUS })
  // 결제 수단마다 SDK 타입이 따로라 수단별로 나눠 부른다
  if (method === 'TRANSFER') await payment.requestPayment({ ...common, method: 'TRANSFER' })
  else if (method === 'MOBILE_PHONE') await payment.requestPayment({ ...common, method: 'MOBILE_PHONE' })
  else await payment.requestPayment({ ...common, method: 'CARD', card: { flowMode: 'DEFAULT' } })
}
