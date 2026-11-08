import { ApiError } from '../api/client'
import { confirmPayment, getPaymentOrder, type PaymentOrder } from '../api/payments'

const uncertain = () => new ApiError(503, 'PAYMENT_UNCERTAIN', '결제 결과를 아직 확인하고 있어요. 다시 결제하지 말고 결과를 확인해 주세요')

/** 먼저 주문을 조회하고, 승인 대기인 경우에만 승인한다. 처리 중인 주문은 조회로 확인한다. */
export async function recoverPayment(
  input: { orderId: string; paymentKey?: string; amount?: number; allowConfirm: boolean },
  dependencies = { getOrder: getPaymentOrder, confirm: confirmPayment, wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)) },
): Promise<PaymentOrder> {
  const { orderId, paymentKey, amount, allowConfirm } = input
  let order = await dependencies.getOrder(orderId)
  if (order.status === 'DONE' || order.status === 'FAILED') return order
  if (order.status === 'READY') {
    if (!allowConfirm || !paymentKey || amount === undefined || !Number.isFinite(amount) || amount <= 0) return order
    if (order.amount !== amount) throw new ApiError(400, 'PAYMENT_AMOUNT_MISMATCH', '주문 금액과 결제 금액이 일치하지 않아요')
    try { order = await dependencies.confirm({ orderId, paymentKey, amount }) }
    catch (cause) {
      // 서버가 확정 실패를 알려 준 경우를 제외하고는 실제 주문 상태를 다시 확인한다.
      if (cause instanceof ApiError && cause.status < 500 && cause.code !== 'PAYMENT_UNCERTAIN') throw cause
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (order.status === 'DONE' || order.status === 'FAILED') return order
    await dependencies.wait(2000)
    try { order = await dependencies.getOrder(orderId) }
    catch (cause) {
      if (cause instanceof ApiError && cause.status < 500) throw cause
    }
  }
  if (order.status === 'DONE' || order.status === 'FAILED') return order
  throw uncertain()
}
