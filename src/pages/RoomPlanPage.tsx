import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { createRoom, getRoomHome } from '../api/rooms'
import Button from '../components/Button'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import Flower from '../components/Flower'
import { usePlans } from '../hooks/usePlans'
import { formatWon, RECOMMENDED_PLAN_ID, type Plan, type PlanId } from '../lib/plans'
import { clearRoomDraft, getRoomDraft } from '../lib/roomDraft'
import { getRoomSession, saveRoomSession } from '../lib/session'
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
          {plan.id === RECOMMENDED_PLAN_ID && plan.available && (
            <span className="rounded-full bg-point px-2 py-0.5 text-[10px] font-semibold text-surface">추천</span>
          )}
          {!plan.available && (
            <span className="rounded-full bg-[#efe9df] px-2 py-0.5 text-[10px] text-sub">결제 준비 중</span>
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

/**
 * 이 방에서 쓸 플랜을 고르는 화면. 두 가지로 쓴다
 * - 새 방 (`/rooms/new/plan`): 방 만들기에서 입력한 내용으로, 고른 플랜을 넣어 방을 만든다
 * - 이미 있는 방 (`/rooms/{roomId}/plan`): 한도 시트의 [플랜 보기]로 들어와 플랜을 살펴본다
 */
function RoomPlanPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromLimit = (location.state as { fromLimit?: boolean } | null)?.fromLimit === true
  const isNewRoom = roomId === undefined
  const [draft] = useState(getRoomDraft)
  const session = roomId ? getRoomSession(roomId) : null
  const plans = usePlans()
  const [selectedId, setSelectedId] = useState<PlanId>(RECOMMENDED_PLAN_ID)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId || !session) return
    getRoomHome(roomId, session.memberAccessToken)
      .then((home) => setMemberCount(home.members.length))
      .catch(() => {
        // 인원 수는 안내용이라 불러오지 못해도 플랜은 고를 수 있다
      })
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (isNewRoom && !draft) return <Navigate to={paths.roomCreate()} replace />
  if (!isNewRoom && !session) return <NotFoundPage message="모임방을 찾을 수 없어요" />

  const plan = plans.find((p) => p.id === selectedId) ?? plans[0]
  const roomName = isNewRoom ? draft?.name : session?.roomName

  const handleNext = async () => {
    if (!plan.available) return
    // 유료 플랜은 결제 화면으로 간다 (새 방은 결제 뒤에 방을 만든다)
    if (plan.price > 0) {
      navigate(isNewRoom ? paths.roomCreateCheckout(plan.id) : paths.roomCheckout(roomId, plan.id))
      return
    }
    // 이미 있는 방에서 Free를 고르면 바꿀 게 없으니 보던 화면으로 돌아간다
    if (!isNewRoom || !draft) {
      navigate(-1)
      return
    }
    setCreating(true)
    setError(null)
    try {
      const { room, inviteToken } = await createRoom({ ...draft, planType: 'FREE' })
      saveRoomSession(room.id, { memberAccessToken: '', inviteToken, roomName: room.name })
      clearRoomDraft()
      navigate(paths.roomShare(room.id), { replace: true })
    } catch {
      setError('모임방을 만들지 못했어요. 다시 시도해 주세요')
      setCreating(false)
    }
  }

  const handleBack = () => {
    // 새 방은 입력하던 화면으로, 한도 시트에서 왔으면 보던 화면으로 돌아간다
    if (isNewRoom) navigate(paths.roomCreate())
    else if (fromLimit) navigate(-1)
    else navigate(paths.roomList())
  }

  const buttonLabel = !plan.available
    ? `${plan.name} 결제 준비 중이에요`
    : plan.price === 0
      ? creating
        ? '방 만드는 중…'
        : isNewRoom
          ? `${plan.name}로 시작하기`
          : '지금 플랜 그대로 쓰기'
      : `${plan.name}로 결제하기 · ${formatWon(plan.price)}`

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="px-1">
        <button type="button" onClick={handleBack} className="flex items-center gap-2 text-[16px] font-bold">
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
        <span className="font-bold">{roomName}</span>
        {isNewRoom && draft && <span className="text-sub">· 최대 {draft.capacity}명</span>}
        {memberCount !== null && <span className="text-sub">· 참여 {memberCount}명</span>}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} selected={p.id === selectedId} onSelect={() => setSelectedId(p.id)} />
        ))}
      </div>

      <footer className="mt-auto pt-8">
        {/* 서버가 결제를 아직 받지 않는 플랜(roomCreationAvailable=false)은 고를 수만 있고 넘어가지 않는다 */}
        {!plan.available && (
          <p className="text-center text-[12px] text-point">유료 플랜 결제가 아직 준비되지 않았어요. 지금은 Free로 시작할 수 있어요.</p>
        )}
        {plan.available && plan.price > 0 && (
          <p className="text-center text-[11px] text-sub">
            친구 {EXAMPLE_FRIENDS}명이면 1인당 약 {formatWon(Math.round(plan.price / EXAMPLE_FRIENDS / 10) * 10)}
          </p>
        )}
        {error && <p className="mt-2 text-center text-[12px] text-point">{error}</p>}
        <Button onClick={() => void handleNext()} disabled={!plan.available || creating} className="mt-3 w-full">
          {buttonLabel}
        </Button>
      </footer>
    </main>
  )
}

export default RoomPlanPage
