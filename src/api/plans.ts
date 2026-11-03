import type { PlanId } from '../lib/plans'

export type PaymentMethod = 'EASY_PAY_A' | 'EASY_PAY_B' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE'

export interface PurchaseRequest {
  roomId: string
  plan: PlanId
  method: PaymentMethod
}

/**
 * 방 플랜 결제
 * TODO: 백엔드 명세에 결제 API가 아직 없어서(실결제는 1차 범위 밖), 지금은 누르면 결제된 것으로 친다.
 * API가 생기면 참여자 토큰을 받아 요청하도록 바꾼다
 */
export async function purchasePlan(request: PurchaseRequest) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  return { ...request, paid: true }
}
