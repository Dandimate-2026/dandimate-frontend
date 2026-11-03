import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getRoomHome } from '../api/rooms'
import Button from '../components/Button'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import Flower from '../components/Flower'
import { findPlan, formatWon, PLANS, RECOMMENDED_PLAN_ID, type Plan, type PlanId } from '../lib/plans'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

// 1인당 금액 안내에 쓰는 예시 인원
const EXAMPLE_FRIENDS = 3

function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-[20px] border px-[15px] pt-3 pb-3.5 text-left transition-colors ${
        selected ? 'border-point bg-[#fbf3f6]' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-[17px] leading-5 font-bold">{plan.name}</span>
          {plan.price === 0 && (
            <span className="rounded-full bg-[#efe9df] px-2 py-0.5 text-[10px] text-sub">지금</span>
          )}
          {plan.id === RECOMMENDED_PLAN_ID && (
            <span className="rounded-full bg-point px-2 py-0.5 text-[10px] font-semibold text-surface">추천</span>
          )}
        </span>
        <span className="text-[16px] font-bold">
          {formatWon(plan.price)}
          {plan.price > 0 && <span className="text-[11px] font-normal text-sub"> / 방</span>}
        </span>
      </div>
      <div className="mt-1 text-[12px] leading-[18px] text-sub">
        {plan.summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </button>
  )
}

/** 방을 만든 직후, 이 방에서 쓸 플랜을 고르는 화면 */
function RoomPlanPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [selectedId, setSelectedId] = useState<PlanId>(RECOMMENDED_PLAN_ID)
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    if (!session) return
    getRoomHome(roomId, session.memberAccessToken)
      .then((home) => setMemberCount(home.members.length))
      .catch(() => {
        // 인원 수는 안내용이라 불러오지 못해도 플랜은 고를 수 있다
      })
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (!session) return <NotFoundPage message="모임방을 찾을 수 없어요" />

  const plan = findPlan(selectedId) ?? PLANS[0]

  const handleNext = () => {
    // 무료 플랜은 결제할 게 없으니 바로 친구를 부르러 간다
    if (plan.price === 0) navigate(paths.roomShare(roomId), { replace: true })
    else navigate(paths.roomCheckout(roomId, plan.id))
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="px-1">
        {/* 방은 이미 만들어졌으니 뒤로 가면 방 만들기가 아니라 내 모임방 목록으로 간다 */}
        <button
          type="button"
          onClick={() => navigate(paths.roomList())}
          className="flex items-center gap-2 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          플랜 선택
        </button>
      </header>

      <h1 className="mt-7 px-1 text-[22px] leading-[30px] font-bold">이 방의 플랜을 골라주세요</h1>
      <p className="mt-2 px-1 text-[13px] leading-[19px] break-keep text-sub">
        방장이 한 번 결제하면 방에 있는 친구 모두가
        <br />
        함께 써요. 정기 결제가 아니에요.
      </p>

      <div className="mt-[18px] flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px]">
        <Flower code="AZALEA" size={18} />
        <span className="font-bold">{session.roomName}</span>
        {memberCount !== null && <span className="text-sub">· 참여 {memberCount}명</span>}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} selected={p.id === selectedId} onSelect={() => setSelectedId(p.id)} />
        ))}
      </div>

      <footer className="mt-auto pt-8">
        {plan.price > 0 && (
          <p className="text-center text-[11px] text-sub">
            친구 {EXAMPLE_FRIENDS}명이면 1인당 약 {formatWon(Math.round(plan.price / EXAMPLE_FRIENDS / 10) * 10)} · 가격은
            예시예요
          </p>
        )}
        <Button onClick={handleNext} className="mt-3 w-full">
          {plan.price === 0 ? `${plan.name}로 시작하기` : `${plan.name}로 결제하기 · ${formatWon(plan.price)}`}
        </Button>
      </footer>
    </main>
  )
}

export default RoomPlanPage
