import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { purchasePlan, type PaymentMethod } from '../api/plans'
import { getRoomHome } from '../api/rooms'
import type { RoomHome } from '../api/types'
import Button from '../components/Button'
import Flower from '../components/Flower'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { FREE_PLAN, findPlan, formatWon, type Plan } from '../lib/plans'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

const COUPON_DISCOUNT = 1000
const COUPON_CODE = 'DANDI1000'
const PAYMENT_METHODS: { id: PaymentMethod; label: string; badge: string; recent?: boolean }[] = [
  { id: 'EASY_PAY_A', label: '간편결제 A', badge: 'PAY', recent: true },
  { id: 'EASY_PAY_B', label: '간편결제 B', badge: 'PAY' },
  { id: 'CARD', label: '신용·체크카드', badge: 'CARD' },
  { id: 'BANK_TRANSFER', label: '계좌이체', badge: 'BANK' },
  { id: 'MOBILE', label: '휴대폰 결제', badge: 'MOB' },
]
const AGREEMENTS = [
  { label: '주문 내용 확인 및 결제 동의' },
  { label: '결제대행 서비스 이용약관', note: '결제대행사 약관은 실제 결제 연동 시 제공됩니다.' },
  { label: '개인정보 제3자 제공 (결제대행사)', note: '결제대행사와 제공 항목은 실제 결제 연동 시 안내됩니다.' },
  { label: '환불 정책', note: '결제 후 7일 이내, 늘어난 한도를 쓰지 않았다면 전액 환불돼요. 늘어난 사진·말하기·재엮기를 한 번이라도 쓰면 환불이 제한돼요.' },
]

function BenefitRow({ label, before, after }: { label: string; before: string; after: string }) {
  return <div className="flex items-baseline justify-between gap-2 text-[13px] leading-6">
    <dt className="text-sub">{label}</dt>
    <dd className="whitespace-nowrap font-semibold">{before} → <span className="text-point">{after}</span></dd>
  </div>
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="mt-6">
    <div className="mb-2.5 flex items-center justify-between"><h2 className="text-[15px] font-bold">{title}</h2>{action}</div>
    {children}
  </section>
}

function PlanComparison({ plan }: { plan: Plan }) {
  return <div className="rounded-[18px] border border-line bg-surface p-[15px]">
    <div className="flex items-center gap-2 border-b border-dashed border-line pb-3.5">
      <div className="flex h-[64px] flex-1 flex-col items-center justify-center rounded-xl bg-bg"><span className="text-[11px] text-sub">지금</span><strong>Free</strong></div>
      <span className="text-xl text-point" aria-hidden="true">→</span>
      <div className="flex h-[64px] flex-1 flex-col items-center justify-center rounded-xl border border-point bg-[#fff5f8]"><span className="text-[11px] text-point">바꿀 플랜</span><strong>{plan.name}</strong></div>
    </div>
    <dl className="mt-3">
      <BenefitRow label="1인당 사진" before={`${FREE_PLAN.photosPerMember}장`} after={`${plan.photosPerMember}장`} />
      <BenefitRow label="방 전체 말하기" before={`${FREE_PLAN.voiceMinutes}분`} after={`${plan.voiceMinutes}분`} />
      {plan.id === 'lite' && <>
        <BenefitRow label="첫 한마디 길이" before="30초" after="60초" />
        <BenefitRow label="덧붙임·답가 길이" before="20초" after="30초" />
      </>}
      <BenefitRow label="재엮기" before={`${FREE_PLAN.reweaves}회`} after={`${plan.reweaves}회`} />
      <BenefitRow label="꾸미기" before="기본" after={plan.decor} />
    </dl>
    <p className="mt-2.5 text-[11px] leading-[19px] text-[#9a9085]">· 지금까지 사용한 양은 그대로 이어져요<br />· 이 방에만 적용되고, 다른 방에는 적용되지 않아요</p>
  </div>
}

function CenteredPaymentState({ kind, reason, onRetry, onShare }: { kind: 'processing' | 'failed'; reason: string; onRetry: () => void; onShare: () => void }) {
  if (kind === 'processing') return <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-bg px-5 text-center text-ink" role="status" aria-live="polite">
    <div className="size-[60px] animate-spin rounded-full border-[4px] border-line border-t-point" aria-hidden="true" />
    <h1 className="mt-7 text-[21px] font-bold">결제를 확인하고 있어요</h1>
    <p className="mt-2 text-[14px] leading-6 text-sub">창을 닫거나 뒤로 가지 말아 주세요.<br />보통 5초 안에 끝나요.</p>
  </main>

  return <main className="flex min-h-dvh flex-1 flex-col bg-bg px-5 pb-8 text-ink">
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="flex size-[64px] items-center justify-center rounded-full bg-[#f7dce8] text-[35px] font-bold text-point" aria-hidden="true">!</span>
      <h1 className="mt-6 text-[21px] font-bold">결제가 완료되지 않았어요</h1>
      <p className="mt-2 text-[14px] leading-6 text-sub">돈은 빠져나가지 않았어요.<br />다른 결제 수단으로 다시 시도해 보세요.</p>
      <dl className="mt-6 w-full rounded-[18px] border border-line bg-surface px-4 py-3 text-[13px]">
        <div className="flex justify-between gap-3"><dt className="text-sub">사유</dt><dd className="font-semibold">{reason}</dd></div>
        <div className="mt-2 flex justify-between gap-3"><dt className="text-sub">주문 번호</dt><dd className="font-semibold">—</dd></div>
      </dl>
    </div>
    <div className="flex flex-col gap-3 pt-8">
      <Button variant="outline" onClick={onShare} className="h-[50px] w-full rounded-full bg-transparent">방으로 돌아가기</Button>
      <Button onClick={onRetry} className="w-full">다시 결제하기</Button>
    </div>
  </main>
}

/** 플랜 선택 다음 단계의 결제와 결제 상태 화면 */
function RoomCheckoutPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const plan = findPlan(searchParams.get('plan'))
  const [home, setHome] = useState<RoomHome | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('EASY_PAY_A')
  const [cardMode, setCardMode] = useState<'saved' | 'single'>('saved')
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState(true)
  const [couponMessage, setCouponMessage] = useState('')
  const [agreements, setAgreements] = useState<boolean[]>(AGREEMENTS.map(() => true))
  const [activeAgreement, setActiveAgreement] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'failed'>(
    import.meta.env.DEV && searchParams.get('preview') === 'processing'
      ? 'processing'
      : import.meta.env.DEV && searchParams.get('preview') === 'failure'
        ? 'failed'
        : 'idle',
  )
  const [failureReason, setFailureReason] = useState('카드 한도 초과')

  useEffect(() => {
    if (!session) return
    getRoomHome(roomId, session.memberAccessToken).then(setHome).catch(() => {})
    // session은 매 렌더에서 읽히므로 roomId만 기준으로 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (!session) return <NotFoundPage message="모임방을 찾을 수 없어요" />
  if (!plan || plan.price === 0) return <NotFoundPage message="결제할 플랜을 찾을 수 없어요" />

  const discount = couponApplied ? Math.min(COUPON_DISCOUNT, plan.price) : 0
  const total = plan.price - discount
  const allAgreed = agreements.every(Boolean)
  const host = home?.members.find((member) => member.role === 'HOST')?.nickname
  const meetingDate = home?.room.meetingDate?.replaceAll('-', '.')

  const handlePay = async () => {
    if (!allAgreed || status !== 'idle') return
    setStatus('processing')
    try {
      await Promise.all([
        purchasePlan({ roomId, plan: plan.id, method }),
        new Promise((resolve) => window.setTimeout(resolve, 1600)),
      ])
      if (import.meta.env.DEV && searchParams.get('preview') === 'failure') throw new Error('preview failure')
      navigate(paths.roomPlanDone(roomId, plan.id), { replace: true })
    } catch {
      setFailureReason('결제 수단을 확인해 주세요')
      setStatus('failed')
    }
  }

  if (status !== 'idle') return <CenteredPaymentState kind={status} reason={failureReason} onRetry={() => setStatus('idle')} onShare={() => navigate(paths.roomShare(roomId), { replace: true })} />

  return <main className="flex min-h-dvh flex-col bg-bg px-5 pt-14 text-ink">
    <header>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(paths.roomPlan(roomId))} className="flex items-center gap-1 text-[16px] font-bold"><ChevronLeftIcon />결제하기</button>
        <span className="text-[13px] text-sub">2 / 3</span>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-1" aria-label="결제 진행 2 / 3">
        <span className="h-[3px] rounded-full bg-point" /><span className="h-[3px] rounded-full bg-point" /><span className="h-[3px] rounded-full bg-line" />
      </div>
    </header>

    <Section title="결제할 방">
      <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-[15px]">
        <div className="flex size-[55px] shrink-0 items-center justify-center rounded-xl bg-[#eee8de] text-[11px] text-sub">{(session.roomName ?? '방').slice(0, 2)}</div>
        <div className="min-w-0"><strong className="block truncate text-[15px]">{session.roomName}</strong>
          <p className="mt-0.5 text-[12px] text-[#9a9085]">{meetingDate ?? '모임 날짜 미정'} · 방장 {host ?? '—'} · 둘러보는 중</p>
          {home && <div className="mt-1 flex items-center gap-1"><span className="flex -space-x-1" aria-hidden="true">{home.members.slice(0, 3).map((member) => <Flower key={member.id} code={member.flowerCode} size={16} />)}</span><span className="text-[11px] text-[#9a9085]">{home.members.length}명이 함께 써요</span></div>}
        </div>
      </div>
    </Section>

    <Section title="바뀌는 플랜" action={<Link to={paths.roomPlan(roomId)} className="text-[12px] text-sub underline-offset-2 hover:underline">플랜 변경 ›</Link>}><PlanComparison plan={plan} /></Section>

    <Section title="쿠폰">
      <div className="rounded-[18px] border border-line bg-surface p-[15px]">
        <div className="flex gap-2"><input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="쿠폰 코드 입력" aria-label="쿠폰 코드" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-[14px] outline-point placeholder:text-muted" />
          <button type="button" onClick={() => {
            if (couponCode.trim().toUpperCase() === COUPON_CODE) { setCouponApplied(true); setCouponMessage('쿠폰이 적용되었어요') }
            else { setCouponApplied(false); setCouponMessage('사용할 수 없는 쿠폰 코드예요') }
          }} className="h-12 rounded-xl bg-ink px-6 text-[14px] font-semibold text-surface">적용</button></div>
        <div className="mt-2 flex justify-between text-[12px] text-point"><span>{couponApplied ? '✓ 단디톤 체험 쿠폰 적용됨' : couponMessage}</span>{couponApplied && <span>−{formatWon(discount)}</span>}</div>
        {couponMessage && <p className="mt-1 text-[11px] text-sub" role="status">{couponMessage}</p>}
      </div>
    </Section>

    <Section title="결제 수단">
      <div role="radiogroup" aria-label="결제 수단" className="rounded-[18px] border border-line bg-surface px-[15px] py-1">
        {PAYMENT_METHODS.map((item) => <div key={item.id} className="border-b border-[#eee8de] last:border-0">
          <button type="button" role="radio" aria-checked={method === item.id} onClick={() => setMethod(item.id)} className="flex min-h-[51px] w-full items-center gap-2 text-left text-[14px] font-semibold">
            <span className={`size-[19px] rounded-full ${method === item.id ? 'border-[5px] border-ink' : 'border border-muted'}`} aria-hidden="true" />
            <span className="rounded-md bg-[#eee8de] px-2 py-1 text-[9px] font-bold text-[#9a9085]">{item.badge}</span><span>{item.label}</span>{item.recent && <span className="ml-auto text-[11px] font-normal text-point">최근 사용</span>}
          </button>
          {item.id === 'CARD' && <div className="mb-2 flex gap-1.5 pl-[29px]"><button type="button" onClick={() => { setMethod('CARD'); setCardMode('saved') }} className={`rounded-full border px-3 py-1 text-[11px] ${cardMode === 'saved' ? 'border-ink' : 'border-line text-sub'}`}>카드사 선택</button><button type="button" onClick={() => { setMethod('CARD'); setCardMode('single') }} className={`rounded-full border px-3 py-1 text-[11px] ${cardMode === 'single' ? 'border-ink' : 'border-line text-sub'}`}>일시불</button></div>}
        </div>)}
      </div>
    </Section>

    <Section title="결제 금액">
      <div className="rounded-[18px] border border-line bg-surface px-[15px] py-4 text-[13px]">
        <div className="flex justify-between"><span className="text-sub">{plan.name} 플랜 ({session.roomName})</span><strong>{formatWon(plan.price)}</strong></div>
        <div className="mt-2 flex justify-between"><span className="text-sub">쿠폰 할인</span><strong className="text-point">−{formatWon(discount)}</strong></div>
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3"><strong>최종 결제 금액</strong><strong className="text-[24px]">{formatWon(total)}</strong></div>
        {home && home.members.length > 0 && <p className="mt-1 text-right text-[11px] text-[#9a9085]">친구 {home.members.length}명이면 1인당 약 {formatWon(Math.round(total / home.members.length))}</p>}
      </div>
    </Section>

    <Section title="약관 동의">
      <div className="rounded-[18px] border border-line bg-surface px-[15px] py-2">
        <label className="flex min-h-[38px] cursor-pointer items-center gap-2 border-b border-line font-bold"><input type="checkbox" checked={allAgreed} onChange={(event) => setAgreements(AGREEMENTS.map(() => event.target.checked))} className="accent-ink" />아래 내용을 모두 확인했고 동의해요</label>
        {AGREEMENTS.map((item, index) => <div key={item.label} className="flex min-h-[40px] items-center gap-1 text-[13px]">
          <label className="flex flex-1 cursor-pointer items-center gap-2"><input type="checkbox" checked={agreements[index]} onChange={(event) => setAgreements((current) => current.map((value, position) => position === index ? event.target.checked : value))} className="accent-ink" /><span><span className="text-point">[필수]</span> {item.label}</span></label>
          {'note' in item && item.note && <button type="button" onClick={() => setActiveAgreement(activeAgreement === index ? null : index)} className="text-[11px] text-sub underline">보기</button>}
        </div>)}
        {activeAgreement !== null && 'note' in AGREEMENTS[activeAgreement] && <p className="border-t border-line py-2 text-[11px] leading-[18px] text-sub">{AGREEMENTS[activeAgreement].note}</p>}
      </div>
      <p className="mt-3 text-[11px] leading-[20px] text-[#9a9085]">· 결제 후 7일 이내, 늘어난 한도를 쓰지 않았다면 전액 환불돼요<br />· 늘어난 사진·말하기·재엮기를 한 번이라도 쓰면 환불이 제한돼요<br />· 방장이 방을 삭제해도 결제 금액은 자동 환불되지 않아요<br />· 영수증은 결제 완료 후 [내 정보 › 결제 내역]에서 볼 수 있어요<br />· 문의: help@example.com</p>
    </Section>

    <footer className="sticky bottom-0 -mx-5 mt-5 border-t border-line bg-bg px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 text-center">
      <p className="mb-2 text-[11px] text-[#9a9085]">방장 {host ?? '회원'} 님이 결제해요</p>
      <Button onClick={() => void handlePay()} disabled={!allAgreed} className="w-full">{formatWon(total)} 결제하기</Button>
    </footer>
  </main>
}

export default RoomCheckoutPage
