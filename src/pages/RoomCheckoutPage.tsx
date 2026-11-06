import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { PAYMENT_DEMO, purchasePlan } from '../api/plans'
import { createPlanOrder, createRoomOrder, openTossPayment, savePendingPayment, TOSS_ENABLED } from '../api/payments'
import { USE_MOCK } from '../api/mock'
import { createRoom, getRoomHome } from '../api/rooms'
import Button from '../components/Button'
import PaymentState from '../components/PaymentState'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { usePlans } from '../hooks/usePlans'
import { paymentErrorMessage } from '../lib/paymentErrors'
import { formatWon } from '../lib/plans'
import { clearRoomDraft, getRoomDraft } from '../lib/roomDraft'
import { attachDraftExtras } from '../lib/roomExtras'
import { getRoomSession, saveRoomSession } from '../lib/session'
import type { RoomHome, RoomPlanType } from '../api/types'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

/** 결제 수단은 토스 카드·간편결제 통합창에서 선택한다. */
function RoomCheckoutPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNewRoom = roomId === undefined
  const [draft] = useState(getRoomDraft)
  const session = roomId ? getRoomSession(roomId) : null
  const memberAccessToken = session?.memberAccessToken
  const plan = usePlans().find((item) => item.id === searchParams.get('plan'))
  const [home, setHome] = useState<RoomHome | null>(null)
  const [agreed, setAgreed] = useState(true)
  const [status, setStatus] = useState<'idle' | 'processing' | 'failed'>(
    USE_MOCK && searchParams.get('preview') === 'processing' ? 'processing'
      : USE_MOCK && searchParams.get('preview') === 'failure' ? 'failed' : 'idle',
  )
  const [failureReason, setFailureReason] = useState('카드 한도 초과')
  const [orderId, setOrderId] = useState<string>()
  const submitting = useRef(false)

  useEffect(() => {
    if (!roomId || memberAccessToken === undefined) return
    let cancelled = false
    getRoomHome(roomId, memberAccessToken).then((value) => {
      if (!cancelled) setHome(value)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [roomId, memberAccessToken])

  if (isNewRoom && !draft) return <Navigate to={paths.roomCreate()} replace />
  if (!isNewRoom && !session) return <NotFoundPage message="모임방을 찾을 수 없어요" />
  if (!plan || plan.price === 0) return <NotFoundPage message="결제할 플랜을 찾을 수 없어요" />

  const planPath = isNewRoom ? paths.roomCreatePlan() : paths.roomPlan(roomId)
  const roomName = isNewRoom ? draft?.name : home?.room.name ?? session?.roomName ?? '모임방'
  const returnPath = isNewRoom || !roomId ? planPath : paths.roomHome(roomId)
  const paymentOpen = USE_MOCK || PAYMENT_DEMO || TOSS_ENABLED

  const handlePay = async () => {
    if (!agreed || !plan.available || !paymentOpen || status !== 'idle' || submitting.current) return
    submitting.current = true
    setOrderId(undefined)
    setStatus('processing')
    try {
      if (TOSS_ENABLED) {
        const planType = plan.id.toUpperCase() as RoomPlanType
        const order = isNewRoom && draft
          ? await createRoomOrder({ ...draft, planType })
          : await createPlanOrder(roomId ?? '', planType)
        setOrderId(order.orderId)
        savePendingPayment({ orderId: order.orderId, plan: plan.id, roomId: isNewRoom ? undefined : roomId, roomName })
        await openTossPayment(order, 'CARD')
        return
      }
      await purchasePlan({ roomId: roomId ?? '', plan: plan.id, method: 'CARD' })
      if (isNewRoom && draft) {
        const planType: RoomPlanType = USE_MOCK ? plan.id.toUpperCase() as RoomPlanType : 'FREE'
        const { room, inviteToken } = await createRoom({ ...draft, planType })
        saveRoomSession(room.id, { memberAccessToken: '', inviteToken, roomName: room.name })
        clearRoomDraft()
        attachDraftExtras(room.id)
        navigate(paths.roomPlanDone(room.id, plan.id), { replace: true })
      } else if (roomId) {
        navigate(paths.roomPlanDone(roomId, plan.id), { replace: true })
      }
    } catch (cause) {
      setFailureReason(paymentErrorMessage(cause))
      setStatus('failed')
    } finally {
      submitting.current = false
    }
  }

  if (status === 'processing') return <PaymentState kind="processing" />
  if (status === 'failed') return <PaymentState kind="failed" reason={failureReason} orderId={orderId} onRetry={() => setStatus('idle')} onReturn={() => navigate(returnPath, { replace: true })} />

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg px-[22px] pt-[66px] pb-10 text-ink">
      <header>
        <button type="button" onClick={() => navigate(planPath, { state: { selectedPlan: plan.id } })} className="flex min-h-6 items-center gap-1 text-[15px] font-bold"><ChevronLeftIcon />결제</button>
      </header>
      <section aria-label="주문 내용" className="mt-[15px] rounded-[20px] border border-line bg-surface px-6 pt-4 pb-[14px]">
        <dl className="space-y-2 text-[12px] leading-4">
          <div className="flex justify-between gap-4"><dt className="shrink-0 text-sub">방</dt><dd className="text-right font-bold break-all">{roomName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-sub">플랜</dt><dd className="font-bold">{plan.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="shrink-0 text-sub">적용 기간</dt><dd className="text-right font-bold">이 방이 있는 동안</dd></div>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-[11px] text-[16px] leading-6 font-bold"><dt>결제 금액</dt><dd>{formatWon(plan.price)}</dd></div>
        </dl>
      </section>
      <section className="mt-[19px]" aria-labelledby="payment-method-heading">
        <h2 id="payment-method-heading" className="mb-[9px] px-0.5 text-[12px] leading-4 text-sub">결제 수단</h2>
        <div className="rounded-[20px] border border-line bg-surface px-[18px] py-[14px]">
          <img src="/images/tosspayments.png" alt="toss payments" width="253" height="35" className="h-auto w-[126px] max-w-full" />
          <p className="mt-2 text-[11px] leading-[15px] text-[#8a8178]">결제하기를 누르면 카카오페이, 카드 등 원하는 수단을 고를 수 있어요</p>
        </div>
      </section>
      <div className="mt-[14px] flex items-start gap-[9px] text-[11px] leading-4 text-sub">
        <input id="payment-agreement" type="checkbox" aria-label="주문 내용과 토스페이먼츠 이용약관에 동의" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-px size-4 shrink-0 cursor-pointer accent-ink" />
        <p>
          <label htmlFor="payment-agreement" className="cursor-pointer">주문 내용을 확인했고 결제와 </label>
          <a href="https://pages.tosspayments.com/terms/user" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2">토스페이먼츠 이용약관</a>
          <label htmlFor="payment-agreement" className="cursor-pointer">에 동의해요.<br />플랜을 쓰기 시작하면 환불이 제한될 수 있어요.</label>
        </p>
      </div>
      <footer className="mx-[6px] mt-auto pt-8 text-center">
        <p className="text-[11px] leading-[18px] text-[#8a8178]">안전한 결제를 위해 외부 결제창으로 연결돼요</p>
        {PAYMENT_DEMO && !USE_MOCK && <p className="mt-1 text-[11px] text-sub" role="status">시연용 화면이에요. 실제로 결제되지 않아요.</p>}
        {!paymentOpen && <p className="mt-1 text-[11px] text-sub" role="status">지금은 결제를 준비하고 있어요. 잠시 후 다시 시도해 주세요.</p>}
        {!plan.available && <p className="mt-1 text-[11px] text-point" role="status">이 플랜은 결제 준비 중이에요</p>}
        <Button onClick={() => void handlePay()} disabled={!agreed || !plan.available || !paymentOpen} className="mt-[11px] w-full text-[16px] font-bold">{formatWon(plan.price)} 결제하기</Button>
      </footer>
    </main>
  )
}

export default RoomCheckoutPage
