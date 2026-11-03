import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { purchasePlan, type PaymentMethod } from '../api/plans'
import Button from '../components/Button'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { findPlan, formatWon } from '../lib/plans'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'EASY_PAY_A', label: '간편결제 A' },
  { id: 'EASY_PAY_B', label: '간편결제 B' },
  { id: 'CARD', label: '신용·체크카드' },
]

function CheckIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <dt className="text-sub">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}

/** 고른 유료 플랜을 결제하는 화면 */
function RoomCheckoutPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const plan = findPlan(searchParams.get('plan'))
  const [method, setMethod] = useState<PaymentMethod>('EASY_PAY_A')
  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!session) return <NotFoundPage message="모임방을 찾을 수 없어요" />
  if (!plan || plan.price === 0) return <NotFoundPage message="결제할 플랜을 찾을 수 없어요" />

  const handlePay = async () => {
    if (!agreed || paying) return
    setPaying(true)
    setError(null)
    try {
      await purchasePlan({ roomId, plan: plan.id, method })
      // 결제를 마치면 뒤로 가기로 결제 화면에 다시 오지 않게 바꿔치기한다
      navigate(paths.roomPlanDone(roomId, plan.id), { replace: true })
    } catch {
      setError('결제하지 못했어요. 다시 시도해 주세요')
      setPaying(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="px-1">
        <button
          type="button"
          onClick={() => navigate(paths.roomPlan(roomId), { replace: true })}
          className="flex items-center gap-2 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          결제
        </button>
      </header>

      <section className="mt-5 rounded-[20px] border border-line bg-surface px-[15px] pt-4 pb-4">
        <dl className="flex flex-col gap-2.5">
          <SummaryRow label="방" value={session.roomName ?? ''} />
          <SummaryRow label="플랜" value={plan.name} />
          <SummaryRow label="적용 기간" value="이 방이 있는 동안" />
        </dl>
        <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5 text-[17px] font-bold">
          <span>결제 금액</span>
          <span>{formatWon(plan.price)}</span>
        </div>
      </section>

      <h2 className="mt-6 px-1 text-[13px] font-bold">결제 수단</h2>
      <div role="radiogroup" aria-label="결제 수단" className="mt-2.5 flex flex-col gap-2">
        {PAYMENT_METHODS.map((m) => {
          const checked = m.id === method
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setMethod(m.id)}
              className={`flex h-[46px] items-center gap-2.5 rounded-2xl bg-surface px-[15px] text-[14px] font-semibold ${
                checked ? 'border-[1.5px] border-ink' : 'border border-line'
              }`}
            >
              <span
                className={`size-[18px] shrink-0 rounded-full ${checked ? 'border-[5px] border-ink' : 'border border-muted'}`}
                aria-hidden="true"
              />
              {m.label}
            </button>
          )
        })}
      </div>

      <label className="mt-4 flex cursor-pointer gap-2.5 px-1">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[5px] peer-focus-visible:outline-2 peer-focus-visible:outline-point ${
            agreed ? 'bg-ink text-surface' : 'border border-muted bg-surface'
          }`}
          aria-hidden="true"
        >
          {agreed && <CheckIcon />}
        </span>
        <span className="text-[12px] leading-[18px] break-keep text-sub">
          주문 내용을 확인했고 결제에 동의해요.
          <br />
          플랜을 쓰기 시작하면 환불이 제한될 수 있어요.{' '}
          <Link to={paths.terms()} className="underline">
            환불 안내
          </Link>
        </span>
      </label>

      <footer className="mt-auto pt-8">
        {error && <p className="mb-2 text-center text-[12px] text-point">{error}</p>}
        <Button onClick={handlePay} disabled={!agreed || paying} className="w-full">
          {paying ? '결제하는 중…' : `${formatWon(plan.price)} 결제하기`}
        </Button>
      </footer>
    </main>
  )
}

export default RoomCheckoutPage
