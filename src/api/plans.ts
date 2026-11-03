import type { PlanId } from '../lib/plans'

export type PaymentMethod = 'EASY_PAY_A' | 'EASY_PAY_B' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE'

export interface PurchaseRequest {
  roomId: string
  plan: PlanId
  method: PaymentMethod
}

/** 공개 Swagger 0.1.0에는 결제 계약이 없다. 성공을 임의로 만들어 내지 않는다. */
export async function purchasePlan(request: PurchaseRequest): Promise<never> {
  void request
  throw new Error('현재 서버에 결제 API가 준비되지 않았어요.')
}
