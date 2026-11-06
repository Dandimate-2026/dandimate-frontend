import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { buyCredits, CREDIT_PACKS, FREE_DAILY_LIMIT, getChatQuota, type ChatQuota } from '../api/chatQuota'
import { createCreditOrder, openTossPayment, savePendingPayment, TOSS_ENABLED } from '../api/payments'
import Button from '../components/Button'
import { StoreIcon } from '../components/ChatFab'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { paymentErrorMessage } from '../lib/paymentErrors'
import { paths } from '../routes/paths'

const formatWon = (n: number) => `${n.toLocaleString('ko-KR')}원`

/**
 * 두루 챗봇 상점 (전체 화면). 매일 무료 4회 + 질문 크레딧 묶음을 산다.
 * 결제는 방 플랜 결제와 같은 토스 결제창으로 넘어가고, 끝나면 모임방 목록에서 챗봇이 다시 열린다
 */
function StorePage() {
  const navigate = useNavigate()
  const [quota, setQuota] = useState<ChatQuota | null>(null)
  // 처음엔 가운데 '기본'을 골라 둔다
  const [selected, setSelected] = useState(CREDIT_PACKS[1].id)
  const [agreed, setAgreed] = useState(false)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pack = CREDIT_PACKS.find((p) => p.id === selected) ?? CREDIT_PACKS[0]

  useEffect(() => {
    getChatQuota()
      .then(setQuota)
      .catch(() => {})
  }, [])

  // 챗봇에서 왔으면 챗봇으로, 주소로 바로 열었으면 모임방 목록으로 돌아간다
  const goBack = () => navigate(paths.roomList(), { replace: true, state: { openChat: true } })

  const handleBuy = async () => {
    setBuying(true)
    setError(null)
    try {
      if (TOSS_ENABLED) {
        // 서버에 주문을 만들고 → 토스 결제창 → 돌아오면 /payments/success 에서 승인
        const order = await createCreditOrder(pack.id)
        savePendingPayment({ orderId: order.orderId, plan: '', kind: 'credits' })
        await openTossPayment(order, 'CARD')
        return
      }
      // 토스 키가 없는 데모: 바로 충전하고 챗봇으로 돌아간다
      await buyCredits(pack)
      goBack()
    } catch (e) {
      // 서버에 크레딧 주문 API가 아직 없으면 404("요청한 리소스가 없습니다")가 온다 → 준비 중으로 안내
      setError(
        e instanceof ApiError && e.status === 404
          ? '크레딧 결제는 아직 준비 중이에요. 조금만 기다려 주세요'
          : paymentErrorMessage(e),
      )
      setBuying(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-12 pb-8 text-ink">
      <header className="px-1">
        <button type="button" onClick={goBack} className="flex items-center gap-2.5 text-[16px] font-bold">
          <ChevronLeftIcon />
          상점
        </button>
      </header>

      <section className="mt-8 px-1">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#fbe9f0] text-point">
          <StoreIcon size={24} />
        </span>
        <h1 className="mt-4 text-[22px] leading-7 font-bold">
          두루에게
          <br />더 물어보고 싶을 때
        </h1>
        <p className="mt-2 text-[13px] text-sub">무료 질문을 다 쓰면 크레딧으로 더 물어볼 수 있어요</p>
        {quota && (
          <p className="mt-3 inline-block rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold text-point">
            오늘 무료 {quota.freeRemaining}/{quota.freeLimit} · 크레딧 {quota.credits}개
          </p>
        )}
      </section>

      <ul className="mt-6 flex flex-col gap-2">
        {/* 무료 체험: 고르는 항목이 아니라 매일 주어지는 것 */}
        <li className="flex items-center justify-between rounded-[18px] bg-surface/60 px-4 py-3.5">
          <span>
            <span className="block text-[15px] font-semibold">무료 체험</span>
            <span className="text-[12px] text-sub">매일 0시에 다시 채워져요</span>
          </span>
          <span className="text-right">
            <span className="block text-[15px] font-semibold">{FREE_DAILY_LIMIT}회</span>
            <span className="text-[12px] text-sub">무료</span>
          </span>
        </li>
        {CREDIT_PACKS.map((p) => {
          const active = p.id === selected
          return (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3.5 text-left ${
                  active ? 'border-point bg-[#fbe9f0]' : 'border-line bg-surface'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      active ? 'border-point' : 'border-line'
                    }`}
                    aria-hidden="true"
                  >
                    {active && <span className="size-2.5 rounded-full bg-point" />}
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">
                      {p.name}
                      {p.id === 'basic' && (
                        <span className="ml-1.5 rounded-full bg-point px-1.5 py-0.5 text-[10px] text-surface">추천</span>
                      )}
                    </span>
                    <span className="text-[12px] text-sub">질문 {p.credits}회</span>
                  </span>
                </span>
                <span className="text-[16px] font-bold">{formatWon(p.price)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* 결제 수단: 방 플랜 결제 화면과 같이 토스페이먼츠 결제창 하나로 보낸다 (수단은 결제창에서 고른다) */}
      <section className="mt-5" aria-labelledby="payment-method-heading">
        <h2 id="payment-method-heading" className="mb-[9px] px-0.5 text-[12px] leading-4 text-sub">
          결제 수단
        </h2>
        <div className="rounded-[20px] border border-line bg-surface px-[18px] py-[14px]">
          <img src="/images/tosspayments.png" alt="toss payments" width="253" height="35" className="h-auto w-[126px] max-w-full" />
          <p className="mt-2 text-[11px] leading-[15px] text-[#8a8178]">
            결제하기를 누르면 카카오페이, 카드 등 원하는 수단을 고를 수 있어요
          </p>
        </div>
      </section>
      <div className="mt-[14px] flex items-start gap-[9px] text-[11px] leading-4 text-sub">
        <input
          id="credit-agreement"
          type="checkbox"
          aria-label="주문 내용과 토스페이먼츠 이용약관에 동의"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-px size-4 shrink-0 cursor-pointer accent-ink"
        />
        <p>
          <label htmlFor="credit-agreement" className="cursor-pointer">
            주문 내용을 확인했고 결제와{' '}
          </label>
          <a
            href="https://pages.tosspayments.com/terms/user"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline underline-offset-2"
          >
            토스페이먼츠 이용약관
          </a>
          <label htmlFor="credit-agreement" className="cursor-pointer">
            에 동의해요.
            <br />
            크레딧을 쓰기 시작하면 환불이 제한될 수 있어요.
          </label>
        </p>
      </div>

      <footer className="mt-auto pt-8">
        {error && (
          <p className="mb-2 text-center text-[12px] text-point" role="alert">
            {error}
          </p>
        )}
        <p className="text-center text-[11px] leading-[18px] text-[#8a8178]">안전한 결제를 위해 외부 결제창으로 연결돼요</p>
        {!TOSS_ENABLED && <p className="mt-1 text-center text-[11px] text-sub">시연용 결제예요. 실제로 결제되지 않아요.</p>}
        <Button onClick={() => void handleBuy()} disabled={buying || !agreed} className="mt-[11px] w-full text-[16px] font-bold">
          {buying ? '결제창을 여는 중…' : `${formatWon(pack.price)} 결제하기`}
        </Button>
        <p className="mt-2.5 text-center text-[11px] text-muted">크레딧은 기간 제한 없이 쓸 수 있어요</p>
      </footer>
    </main>
  )
}

export default StorePage
