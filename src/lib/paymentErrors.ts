import { ApiError } from '../api/client'

/** 결제 주문·승인 실패를 사용자에게 보여줄 문장으로 바꾼다 */
export function paymentErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === 'PAYMENT_NOT_CONFIGURED') return '지금은 결제를 받을 수 없어요'
    if (cause.code === 'PAYMENT_UNCERTAIN') return '결제 결과를 확인하지 못했어요. 잠시 후 다시 확인해 주세요'
    if (cause.status === 409) return '다른 결제가 처리 중이에요. 잠시 후 다시 시도해 주세요'
    if (cause.status === 403) return '방장만 결제할 수 있어요'
    if (cause.status === 422) return '이 플랜으로 바꿀 수 없어요'
  }
  return cause instanceof Error && cause.message ? cause.message : '결제 요청에 실패했어요'
}
