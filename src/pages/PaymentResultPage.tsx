import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { clearPendingPayment, confirmPayment, getPendingPayment, type PaymentOrder } from '../api/payments'
import { rotateInviteToken } from '../api/rooms'
import PaymentState from '../components/PaymentState'
import { paymentErrorMessage } from '../lib/paymentErrors'
import { clearRoomDraft, getRoomDraft } from '../lib/roomDraft'
import { getRoomSession, saveRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

/** 결제 결과를 확인하지 못했을 때(PAYMENT_UNCERTAIN·PROCESSING) 같은 값으로 다시 물어보는 횟수와 간격 */
const CONFIRM_RETRIES = 3
const CONFIRM_RETRY_DELAY_MS = 2000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isUncertain(e: unknown) {
  return e instanceof ApiError && e.code === 'PAYMENT_UNCERTAIN'
}

/**
 * 토스 결제창에서 돌아오는 화면.
 * 성공(/payments/success)이면 서버에 승인을 요청하고, 실패·취소(/payments/fail)면 이유를 보여준다
 */
function PaymentResultPage({ kind }: { kind: 'success' | 'fail' }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const pending = getPendingPayment()
  const orderId = searchParams.get('orderId') ?? ''
  const paymentKey = searchParams.get('paymentKey') ?? ''
  const amount = Number(searchParams.get('amount'))
  const [error, setError] = useState<string | null>(() => {
    if (kind === 'fail') return searchParams.get('message') ?? '결제가 취소됐어요'
    if (!orderId || !paymentKey || !Number.isFinite(amount) || amount <= 0) return '결제 정보를 확인할 수 없어요'
    return null
  })
  const [uncertain, setUncertain] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // React 개발 모드에서 effect가 두 번 돌아도 승인은 한 번만 요청한다 (서버도 같은 주문은 한 번만 적용한다)
  const started = useRef(-1)

  useEffect(() => {
    if (kind !== 'success' || started.current === attempt || !orderId || !paymentKey || !Number.isFinite(amount) || amount <= 0) return
    started.current = attempt

    const confirm = async (): Promise<PaymentOrder> => {
      for (let attempt = 0; ; attempt++) {
        try {
          const order = await confirmPayment({ orderId, paymentKey, amount })
          if (order.status !== 'PROCESSING' || attempt >= CONFIRM_RETRIES) return order
        } catch (e) {
          if (!isUncertain(e) || attempt >= CONFIRM_RETRIES) throw e
        }
        await wait(CONFIRM_RETRY_DELAY_MS)
      }
    }

    const finish = async () => {
      const order = await confirm()
      if (order.status !== 'DONE' || !order.roomId) {
        if (order.status === 'PROCESSING') throw new ApiError(503, 'PAYMENT_UNCERTAIN', '결제를 아직 확인하고 있어요. 잠시 후 다시 확인해 주세요')
        throw new ApiError(400, 'PAYMENT_FAILED', '결제가 완료되지 않았어요')
      }
      const roomId = order.roomId
      const plan = pending?.plan ?? order.targetPlan.toLowerCase()
      if (!pending?.roomId) {
        // 새 방: 결제가 승인되면서 서버가 방을 만들었다. 초대 링크는 재발급 API로 받는다
        const inviteToken = await rotateInviteToken(roomId, '').catch(() => undefined)
        const saved = getRoomSession(roomId)
        saveRoomSession(roomId, {
          ...saved,
          memberAccessToken: '',
          inviteToken: inviteToken ?? saved?.inviteToken,
          roomName: pending?.roomName ?? getRoomDraft()?.name ?? saved?.roomName,
        })
        clearRoomDraft()
      }
      clearPendingPayment()
      navigate(paths.roomPlanDone(roomId, plan), { replace: true })
    }

    finish().catch((e: unknown) => {
      setUncertain(isUncertain(e) || !(e instanceof ApiError))
      setError(paymentErrorMessage(e))
    })
  }, [kind, navigate, pending?.plan, pending?.roomId, pending?.roomName, orderId, paymentKey, amount, attempt])

  // 다시 결제하려면 결제 화면으로, 새 방이면 방 만들기에서 입력한 내용이 남아 있는 결제 화면으로 돌아간다
  const retryPath = pending
    ? pending.roomId
      ? paths.roomCheckout(pending.roomId, pending.plan)
      : paths.roomCreateCheckout(pending.plan)
    : paths.roomList()

  if (!error) return <PaymentState kind="processing" />

  return (
    <PaymentState
      kind={uncertain ? 'pending' : 'failed'}
      reason={error}
      orderId={orderId || pending?.orderId}
      onReturn={() => navigate(pending?.roomId ? paths.roomHome(pending.roomId) : paths.roomList(), { replace: true })}
      onRetry={() => {
        if (!uncertain) { navigate(retryPath, { replace: true }); return }
        setError(null)
        setUncertain(false)
        setAttempt((current) => current + 1)
      }}
    />
  )
}

export default PaymentResultPage
