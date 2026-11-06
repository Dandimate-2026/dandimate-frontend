import type { PlanCatalogItem, PlanId } from '../lib/plans'
import { request } from './client'
import { USE_MOCK } from './mock'
import { TOSS_ENABLED } from './payments'

export type PaymentMethod = 'EASY_PAY_A' | 'EASY_PAY_B' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE'

export interface PurchaseRequest {
  roomId: string
  plan: PlanId
  method: PaymentMethod
}

/**
 * 결제 화면 시연 스위치.
 * 토스 클라이언트 키(VITE_TOSS_CLIENT_KEY)가 없으면 결제를 하드코딩으로 통과시켜 화면만 끝까지 보여준다.
 * 이때는 실제로 결제되지 않고, 서버에 만들어지는 방은 Free다. 키가 있으면 실제 토스 테스트 결제를 쓴다
 */
export const PAYMENT_DEMO = !TOSS_ENABLED

/** 시연용 결제. 잠깐 기다린 뒤 결제된 것으로 친다 (실제 결제는 api/payments.ts) */
export async function purchasePlan(request: PurchaseRequest): Promise<void> {
  void request
  if (USE_MOCK || PAYMENT_DEMO) {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return
  }
  throw new Error('현재 서버에 결제 API가 준비되지 않았어요.')
}

/**
 * 방 만들기 전 플랜 목록·가격·한도 (로그인 없이 조회). null이면 기본값을 쓴다.
 * mock 모드에서는 유료 플랜도 고를 수 있게 기본값(시연용)을 쓴다
 */
export function getPlans(): Promise<PlanCatalogItem[] | null> {
  if (USE_MOCK) return Promise.resolve(null)
  return request<PlanCatalogItem[]>('/plans')
}
