import type { PlanId } from '../lib/plans'
import { USE_MOCK } from './mock'

export type PaymentMethod = 'EASY_PAY_A' | 'EASY_PAY_B' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE'

export interface PurchaseRequest {
  roomId: string
  plan: PlanId
  method: PaymentMethod
}

/**
 * 플랜 결제.
 * TODO(백엔드 미지원): 공개 Swagger에 결제 계약이 없다. 실제 모드에서는 성공을 만들어 내지 않고,
 * mock 모드에서만 잠깐 기다린 뒤 결제된 것으로 친다 (시연용)
 */
export async function purchasePlan(request: PurchaseRequest): Promise<void> {
  void request
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return
  }
  throw new Error('현재 서버에 결제 API가 준비되지 않았어요.')
}
