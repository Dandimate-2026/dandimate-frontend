import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { clearPendingPayment, getPendingPayment, type PaymentOrder } from '../api/payments'
import { showToast } from '../lib/share'
import { updateRoom, getRoomInvite } from '../api/rooms'
import PaymentState from '../components/PaymentState'
import { paymentErrorMessage } from '../lib/paymentErrors'
import { clearRoomDraft, getRoomDraft } from '../lib/roomDraft'
import { attachDraftExtras } from '../lib/roomExtras'
import { getRoomSession, saveRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import { recoverPayment } from '../lib/paymentRecovery'

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
  const stored = getPendingPayment()
  const orderId = searchParams.get('orderId') || stored?.orderId || ''
  const pending = stored?.orderId === orderId ? stored : null
  const paymentKey = searchParams.get('paymentKey') ?? ''
  const amount = Number(searchParams.get('amount'))
  const [error, setError] = useState<string | null>(() => {
    if (!orderId) return kind === 'fail' ? searchParams.get('message') ?? '결제가 취소됐어요' : '결제 정보를 확인할 수 없어요'
    return null
  })
  const [uncertain, setUncertain] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // React 개발 모드에서 effect가 두 번 돌아도 승인은 한 번만 요청한다 (서버도 같은 주문은 한 번만 적용한다)
  const started = useRef<{ key: string; promise: Promise<PaymentOrder> } | null>(null)

  useEffect(() => {
    if (!orderId) return
    let active = true
    const key = `${kind}:${orderId}:${paymentKey}:${amount}:${attempt}`
    if (started.current?.key !== key) started.current = {
      key,
      promise: recoverPayment({ orderId, paymentKey, amount, allowConfirm: kind === 'success' }),
    }
    const confirmation = started.current.promise

    const finish = async () => {
      const order = await confirmation
      if (!active) return
      if (kind === 'fail' && order.status === 'READY') throw new ApiError(400, 'PAYMENT_CANCELLED', '결제가 취소됐어요')
      // 두루 챗봇 크레딧: 방과 상관없이 적립되고, 모임방 목록으로 돌아가 챗봇을 다시 연다
      if (order.orderType === 'CREDIT' || pending?.kind === 'credits') {
        if (order.status === 'PROCESSING') throw new ApiError(503, 'PAYMENT_UNCERTAIN', '결제를 아직 확인하고 있어요. 잠시 후 다시 확인해 주세요')
        if (order.status === 'READY') throw new ApiError(503, 'PAYMENT_UNCERTAIN', '결제 승인을 확인할 수 없어요. 결제한 창으로 돌아가 결과를 확인해 주세요')
        if (order.status !== 'DONE') throw new ApiError(400, 'PAYMENT_FAILED', '결제가 완료되지 않았어요')
        clearPendingPayment()
        navigate(paths.roomList(), { replace: true, state: { openChat: true } })
        return
      }
      if (order.status !== 'DONE' || !order.roomId) {
        if (order.status === 'READY' && kind === 'success') throw new ApiError(503, 'PAYMENT_UNCERTAIN', '결제 승인 정보가 없어요. 결제한 창에서 결과를 다시 확인해 주세요')
        if (order.status === 'PROCESSING') throw new ApiError(503, 'PAYMENT_UNCERTAIN', '결제를 아직 확인하고 있어요. 잠시 후 다시 확인해 주세요')
        throw new ApiError(400, 'PAYMENT_FAILED', '결제가 완료되지 않았어요')
      }
      const roomId = order.roomId
      let solo = false
      const plan = pending?.plan ?? order.targetPlan?.toLowerCase()
      if (!pending?.roomId) {
        // 새 방: 결제가 승인되면서 서버가 방을 만들었다. 고정 초대 링크는 조회 API로 받는다
        const inviteToken = await getRoomInvite(roomId).catch(() => undefined)
        if (!active) return
        const saved = getRoomSession(roomId)
        saveRoomSession(roomId, {
          ...saved,
          memberAccessToken: '',
          inviteToken: inviteToken ?? saved?.inviteToken,
          roomName: pending?.roomName ?? getRoomDraft()?.name ?? saved?.roomName,
        })
        const draft = getRoomDraft()
        solo = draft?.capacity === 1
        if (draft?.deadlineAt) {
          try { await updateRoom(roomId, { deadlineAt: draft.deadlineAt }, '') }
          catch { showToast('방은 만들었지만 엮는 날을 저장하지 못했어요. 설정에서 다시 정해 주세요') }
        }
        clearRoomDraft()
        attachDraftExtras(roomId)
      }
      clearPendingPayment()
      navigate(solo ? paths.roomHome(roomId) : paths.roomPlanDone(roomId, plan), { replace: true })
    }

    finish().catch((e: unknown) => {
      if (!active) return
      setUncertain(isUncertain(e) || !(e instanceof ApiError))
      setError(paymentErrorMessage(e))
    })
    return () => { active = false }
  }, [kind, navigate, pending?.plan, pending?.roomId, pending?.roomName, pending?.kind, orderId, paymentKey, amount, attempt])

  // 다시 결제하려면 결제 화면으로, 새 방이면 방 만들기에서 입력한 내용이 남아 있는 결제 화면으로 돌아간다
  const retryPath = pending
    ? pending.kind === 'credits'
      ? paths.store()
      : pending.roomId
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
