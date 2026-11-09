import { useEffect, useState } from 'react'
import { SCROLL_TEMPLATES } from '../features/memories/templates'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { createRoom, getRoomHome, requestPlanUpgrade } from '../api/rooms'
import type { RoomHome } from '../api/types'
import { showToast } from '../lib/share'
import Button from '../components/Button'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import Flower from '../components/Flower'
import { usePlans } from '../hooks/usePlans'
import { formatWon, RECOMMENDED_PLAN_ID, type Plan, type PlanId } from '../lib/plans'
import { clearRoomDraft, getRoomDraft } from '../lib/roomDraft'
import { attachDraftExtras } from '../lib/roomExtras'
import { getRoomSession, saveRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

// 1인당 금액 안내에 쓰는 예시 인원
const EXAMPLE_FRIENDS = 3

function PlanCard({ plan, selected, current = false, disabled = false, onSelect }: { plan: Plan; selected: boolean; current?: boolean; disabled?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      disabled={disabled}
      className={`w-full rounded-[18px] border bg-surface px-[26px] py-[13px] text-left shadow-[0_1px_2px_#2a26230d] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-point ${
        selected ? 'border-point bg-[#fbe9f0]' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-[17px] leading-6 font-bold">{plan.name}</span>
          {current && (
            <span className="rounded-full bg-[#efe9df] px-2 py-0.5 text-[10px] text-sub">지금</span>
          )}
          {plan.id === RECOMMENDED_PLAN_ID && plan.available && (
            <span className="rounded-full bg-[#f7dce8] px-[9px] py-0.5 text-[10px] text-point">추천</span>
          )}
          {!plan.available && (
            <span className="rounded-full bg-[#efe9df] px-2 py-0.5 text-[10px] text-sub">결제 준비 중</span>
          )}
        </span>
        <span className="shrink-0 text-[17px] leading-6 font-bold">
          {formatWon(plan.price)}
          {plan.price > 0 && <span className="text-[11px] font-normal text-sub"> /방</span>}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] leading-[18px] break-keep text-sub">
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
/** 두루마리 꾸미기를 플랜별로: 기본(모두) · 지역 템플릿(Lite부터) · 시즌 한정 특별 꾸미기(Pro). 고른 플랜에서 쓸 수 있는 줄만 진하게 */
function DecorGuide({ planId }: { planId: string }) {
  const rank = planId === 'pro' ? 2 : planId === 'lite' ? 1 : 0
  const rows = [
    { need: 0, title: '기본 미니멀', tag: '모든 플랜', desc: '사진과 이야기에 집중하는 기본 두루마리', ids: ['minimal'] },
    { need: 1, title: '지역 템플릿 5종', tag: 'Lite부터', desc: '경주 · 안동 · 대구 · 포항 · 영천 그림으로 꾸며요', ids: ['gyeongju', 'andong', 'daegu', 'pohang', 'yeongcheon'] },
    { need: 2, title: '시즌 한정 특별 꾸미기', tag: 'Pro', desc: '계절에 맞춰 바뀌는 시즌 맞춤 꾸미기 · 지금은 크리스마스', ids: ['christmas'] },
  ]
  return (
    <section className="mt-4 rounded-[20px] border border-line bg-surface px-4 py-3.5" aria-labelledby="decor-guide-title">
      <h2 id="decor-guide-title" className="text-[13px] font-bold">두루마리 꾸미기</h2>
      <ul className="mt-2 flex flex-col gap-2.5">
        {rows.map((row) => {
          const usable = rank >= row.need
          return (
            <li key={row.title} className={`flex items-center gap-3 ${usable ? '' : 'opacity-40'}`}>
              <span className="flex shrink-0 -space-x-2">
                {row.ids.slice(0, 3).map((id) => {
                  const t = SCROLL_TEMPLATES.find((item) => item.id === id)
                  return t ? <img key={id} src={t.art} alt="" className="size-8 rounded-[8px] border-2 border-surface object-cover" /> : null
                })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                  {row.title}
                  <span className="rounded-full bg-bg px-1.5 py-px text-[10px] font-normal text-sub">{row.tag}</span>
                </span>
                <span className="block text-[11px] leading-4 text-sub">{row.desc}</span>
              </span>
              {usable && <span className="shrink-0 text-[12px] text-point" aria-label="이 플랜에서 쓸 수 있어요">✓</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RoomPlanPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { fromLimit?: boolean; returnPath?: string; selectedPlan?: PlanId } | null
  const fromLimit = routeState?.fromLimit === true
  const isNewRoom = roomId === undefined
  const [draft] = useState(getRoomDraft)
  const session = roomId ? getRoomSession(roomId) : null
  const plans = usePlans()
  const [selectedId, setSelectedId] = useState<PlanId>(() =>
    (location.state as { selectedPlan?: PlanId } | null)?.selectedPlan ?? RECOMMENDED_PLAN_ID,
  )
  const [home, setHome] = useState<RoomHome | null>(null)
  const [requested, setRequested] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId || !session) return
    getRoomHome(roomId, session.memberAccessToken)
      .then(setHome)
      .catch(() => {
        // 인원 수는 안내용이라 불러오지 못해도 플랜은 고를 수 있다
      })
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (isNewRoom && !draft) return <Navigate to={paths.roomCreate()} replace />
  if (!isNewRoom && !session) return <NotFoundPage message="모임방을 찾을 수 없어요" />

  const plan = plans.find((p) => p.id === selectedId) ?? plans[0]
  const roomName = isNewRoom ? draft?.name : home?.room.name ?? session?.roomName ?? '모임방'
  const capacity = isNewRoom ? draft?.capacity : home?.room.capacity

  const handleNext = async () => {
    if (!plan.available || (!isNewRoom && (!home || home.me.role !== 'HOST' || ['FREE', 'LITE', 'PRO'].indexOf(home.room.planType ?? 'FREE') >= ['free', 'lite', 'pro'].indexOf(plan.id)))) return
    // 유료 플랜은 결제 화면으로 간다 (새 방은 결제 뒤에 방을 만든다)
    if (plan.price > 0) {
      navigate(isNewRoom ? paths.roomCreateCheckout(plan.id) : paths.roomCheckout(roomId, plan.id), { state: { ...routeState, selectedPlan: plan.id } })
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
      const { room, inviteToken, schedulingFailed } = await createRoom({ ...draft, planType: 'FREE' })
      saveRoomSession(room.id, { memberAccessToken: '', inviteToken, roomName: room.name })
      if (schedulingFailed) showToast('방은 만들었지만 엮는 날을 저장하지 못했어요. 설정에서 다시 정해 주세요')
      clearRoomDraft()
      attachDraftExtras(room.id)
      navigate(draft.capacity === 1 ? paths.roomHome(room.id) : paths.roomShare(room.id), { replace: true })
    } catch {
      setError('모임방을 만들지 못했어요. 다시 시도해 주세요')
      setCreating(false)
    }
  }

  const handleBack = () => {
    // 새 방은 입력하던 화면으로, 한도 시트에서 왔으면 보던 화면으로 돌아간다
    if (isNewRoom) navigate(paths.roomCreate())
    else if (fromLimit) navigate(-1)
    else if (routeState?.returnPath) navigate(routeState.returnPath, { replace: true })
    else navigate(paths.roomList())
  }

  const buttonLabel = !isNewRoom && home?.room.planType?.toLowerCase() === plan.id
    ? '현재 이용 중인 플랜이에요'
    : !plan.available
    ? `${plan.name} 결제 준비 중이에요`
    : plan.price === 0
      ? creating
        ? '방 만드는 중…'
        : isNewRoom
          ? `${plan.name}로 시작하기`
          : '지금 플랜 그대로 쓰기'
      : `${plan.name}로 결제하기 · ${formatWon(plan.price)}`

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg px-[22px] pt-[66px] pb-10 text-ink">
      <header>
        <button type="button" onClick={handleBack} className="flex min-h-6 items-center gap-1 text-[15px] font-bold">
          <ChevronLeftIcon />
          플랜
        </button>
      </header>

      <h1 className="mt-[19px] text-[24px] leading-7 font-bold tracking-[-0.6px]">이 방의 플랜을 골라주세요</h1>
      <p className="mt-1 text-[13px] leading-5 break-keep text-sub">
        방장이 한 번 결제하면 방 친구 모두 함께 써요
      </p>

      <div className="mt-[18px] flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px]">
        <span className="shrink-0"><Flower code="AZALEA" size={20} /></span>
        <span className="min-w-0 truncate font-bold">{roomName}</span>
        {capacity != null ? <span className="shrink-0 text-sub">· 최대 {capacity}명</span>
          : home && <span className="shrink-0 text-sub">· 참여 {home.members.length}명</span>}
      </div>

      {!isNewRoom && <p className="mt-3 text-[13px] text-sub">현재 플랜: {home?.room.planType ?? '확인 중…'} · 상위 플랜으로 변경할 수 있어요</p>}
      <div className="mt-3 flex flex-col gap-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} selected={p.id === selectedId} current={!isNewRoom && home?.room.planType?.toLowerCase() === p.id} disabled={!isNewRoom && (!home || ['FREE', 'LITE', 'PRO'].indexOf(home.room.planType ?? 'FREE') >= ['free', 'lite', 'pro'].indexOf(p.id))} onSelect={() => { setSelectedId(p.id); setRequested(false) }} />
        ))}
      </div>
      <DecorGuide planId={selectedId} />

      {!isNewRoom && home?.me.role === 'MEMBER' && <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[13px] leading-5 text-sub">플랜은 방장이 변경해요. 요청하면 방장에게 알림을 보내드려요.</p>
        <Button className="mt-3 w-full" disabled={requesting || requested || ['free', 'lite', 'pro'].indexOf(plan.id) <= ['FREE', 'LITE', 'PRO'].indexOf(home.room.planType ?? 'FREE')} onClick={async () => {
          setRequesting(true); setError(null)
          try { await requestPlanUpgrade(roomId ?? '', 'PHOTO', plan.id.toUpperCase() as 'LITE' | 'PRO'); setRequested(true) }
          catch (cause) { setError(cause instanceof Error ? cause.message : '요청을 보내지 못했어요') }
          finally { setRequesting(false) }
        }}>{requested ? '방장에게 변경 요청을 보냈어요' : requesting ? '보내는 중…' : `${plan.name}로 변경 요청하기`}</Button>
      </section>}
      <footer className="mx-[6px] mt-auto pt-8">
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
        {(isNewRoom || home?.me.role === 'HOST') && <Button onClick={() => void handleNext()} disabled={!plan.available || creating || (!isNewRoom && (!home || home.me.role !== 'HOST' || ['FREE', 'LITE', 'PRO'].indexOf(home.room.planType ?? 'FREE') >= ['free', 'lite', 'pro'].indexOf(plan.id)))} className="mt-3 w-full text-[16px] font-bold">
          {buttonLabel}
        </Button>}
      </footer>
    </main>
  )
}

export default RoomPlanPage
