import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { getMockRole, USE_MOCK } from '../api/mock'
import { getMyRooms, getRoomHome } from '../api/rooms'
import type { RoomHome, RoomPlanType, RoomStatus } from '../api/types'
import BottomTabs, { BOTTOM_TABS_SPACE } from '../components/BottomTabs'
import ChatFab from '../components/ChatFab'
import ChatSheet from '../components/ChatSheet'
import Flower from '../components/Flower'
import { formatDateSpaced } from '../lib/date'
import { logout } from '../lib/auth'
import { coverSrc } from '../api/roomCovers'
import { getRoomPlaceCover } from '../lib/roomExtras'
import { getRoomSession, listSavedRoomIds, removeRoomSession, saveRoomSession } from '../lib/session'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import { paths } from '../routes/paths'
import logo from '../assets/logo-scroll.webp'
import { getReviewerDemo, setReviewerDemoEnabled as updateReviewerDemo, type ReviewerDemo, type ReviewerDemoState } from '../api/reviewerDemo'
import { resetChat, syncChatScope } from '../lib/chatStore'
import { ViewablePhoto } from '../components/PhotoViewer'

const STATUS_LABEL: Record<RoomStatus, string> = {
  COLLECTING: '모으는 중',
  CIRCULATING: '돌려보는 중',
  WEAVING: '엮는 중',
  GROWING: '완성',
}

const STATUS_CLASS: Record<RoomStatus, string> = {
  COLLECTING: 'bg-[#efe9df] text-[#6b6b6b]',
  CIRCULATING: 'bg-[#f6e3ea] text-point',
  WEAVING: 'bg-[#efe9df] text-[#6b6b6b]',
  GROWING: 'bg-ink text-surface',
}

const PLAN_LABEL: Record<RoomPlanType, string> = { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' }
const PLAN_CLASS: Record<RoomPlanType, string> = {
  FREE: 'border border-line text-sub',
  LITE: 'bg-[#e8eefb] text-[#3d64b8]',
  PRO: 'bg-point text-surface',
}

/** 목록에서 실시간으로 지켜보는 방 수. 방마다 서버 연결을 하나씩 열어서 너무 많이 열지 않는다 */
const MAX_LIVE_ROOMS = 5
const ROOM_PAGE_SIZE = 3

function RoomListContinuation({ total, visible, onMore }: { total: number; visible: number; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || visible >= total) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { observer.disconnect(); onMore() } }, { rootMargin: '80px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [total, visible, onMore])
  return visible < total ? <div ref={ref} className="h-8" aria-hidden="true" /> : null
}

/** 화면에 그리지 않고, 방 하나의 실시간 이벤트(알림·방장 변경·사진 등)를 받으면 그 방만 다시 불러오게 한다 */
function RoomLiveWatcher({ roomId, onChange }: { roomId: string; onChange: (roomId: string) => void }) {
  useRoomLiveUpdates(roomId, '', () => onChange(roomId))
  return null
}

/** 내가 할 일이 남아 있는 방인지 */
function hasTodo({ myTodo }: RoomHome) {
  return myTodo.needsFirstEntry || myTodo.topAskback !== null || myTodo.pendingCirculationCount > 0
}

/** 진행 중인 방의 남은 시간 · 참여 인원 */
function ongoingMeta({ room, members }: RoomHome) {
  if (!room.deadlineAt || !room.deadlineChangedByHost) return `참여 ${members.length}명`
  const d = new Date(room.deadlineAt)
  return `${d.getMonth() + 1}월 ${d.getDate()}일에 엮어요 · 참여 ${members.length}명`
}

/** 완성된 방의 모임 날짜 · 사진 수 · 인원 */
function doneMeta({ room, members }: RoomHome) {
  const photoCount = members.reduce((sum, m) => sum + (m.photoCount ?? 0), 0)
  return [room.meetingDate && formatDateSpaced(room.meetingDate), `사진 ${photoCount}장`, `${members.length}명`]
    .filter(Boolean)
    .join(' · ')
}

/** 방마다 지금 할 일 한 줄. 할 일이 없으면 상태 안내 */
function todoLine(home: RoomHome): { text: string; todo: boolean } | null {
  const { room, myTodo, unreadCount } = home
  if (room.status === 'GROWING') {
    // TODO: 홈 응답에 답가 수가 따로 없어서 안 읽은 알림 수로 대신한다
    return unreadCount > 0 ? { text: `새 답가 ${unreadCount}`, todo: true } : null
  }
  if (room.status === 'WEAVING') return { text: '두루마리를 엮고 있어요', todo: false }
  if (myTodo.needsFirstEntry) return { text: '사진 올리고 한마디 남기기', todo: true }
  const waiting = [
    myTodo.topAskback && '질문 1개',
    myTodo.pendingCirculationCount > 0 && `친구 사진 ${myTodo.pendingCirculationCount}장`,
  ].filter(Boolean)
  // '사진 3장이' / '질문 1개가'
  const particle = myTodo.pendingCirculationCount > 0 ? '이' : '가'
  if (waiting.length > 0) return { text: `${waiting.join(' · ')}${particle} 기다려요`, todo: true }
  return { text: '친구들의 이야기를 기다리는 중이에요', todo: false }
}

function RoomCard({ home, meta, reviewerDemo }: { home: RoomHome; meta: string; reviewerDemo?: ReviewerDemo | null }) {
  const { room } = home
  const line = todoLine(home)
  // 서버에 올린 대표 사진을 먼저, 없으면 이 기기에서 고른 미리보기
  const cover = coverSrc(room.coverImageUrl) ?? getRoomPlaceCover(room.id).coverPhoto
  return (
    <li>
      <Link
        to={paths.roomHome(room.id)}
        state={{ ...(reviewerDemo ? { reviewerDemo } : {}), returnTargets: { [paths.roomList()]: window.history.state?.idx } }}
        className={`relative flex gap-[7px] bg-surface px-3 pt-[14px] pb-[13px] active:opacity-80 ${reviewerDemo ? '' : 'rounded-[20px] border border-line'}`}
      >
        {/* 안 읽은 방 알림 (친구의 플랜 요청·질문 등). 완성된 방은 아래 "새 답가"로 따로 보여준다 */}
        {home.unreadCount > 0 && room.status !== 'GROWING' && (
          <span className="absolute top-2.5 right-3 flex items-center gap-1 rounded-full bg-point px-2 py-0.5 text-[10px] font-bold text-surface">
            🔔 {home.unreadCount > 9 ? '9+' : home.unreadCount}
          </span>
        )}
        {/* 대표 사진은 서버 응답에 없어서, 이 기기에서 고른 사진이 있으면 보여준다 */}
        {cover ? (
          // 대표 사진이 있으면 눌러서 크게 볼 수 있다 (카드의 나머지를 누르면 방으로 들어간다)
          <ViewablePhoto src={cover} alt="대표 사진" className="size-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <div className="size-14 shrink-0 rounded-2xl bg-bg" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-[14px] min-w-[55px] rounded-full px-2 text-center text-[8px] leading-[14px] ${STATUS_CLASS[room.status]}`}
            >
              {STATUS_LABEL[room.status]}
            </span>
            {/* 방 플랜: Free·Lite·Pro */}
            <span
              className={`inline-block h-[14px] rounded-full px-1.5 text-[8px] leading-[14px] font-bold ${
                PLAN_CLASS[room.planType ?? 'FREE']
              }`}
            >
              {PLAN_LABEL[room.planType ?? 'FREE']}
            </span>
            {/* 이 방에서 내가 누구인지: 내 꽃 · 닉네임 · 방장 여부 */}
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-sub">
              <Flower code={home.me.flowerCode} size={14} />
              <span className="min-w-0 truncate" title={home.me.nickname}>{home.me.nickname}</span>
              {home.me.role === 'HOST' && <span className="shrink-0 font-semibold text-point">· 방장</span>}
            </span>
          </div>
          <p className="mt-[5px] truncate text-[16px] leading-5 font-semibold" title={room.name}>{room.name}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-sub [overflow-wrap:anywhere]">{meta}</p>
          {line && <p className={`mt-[3px] text-[11px] leading-4 [overflow-wrap:anywhere] ${line.todo ? 'text-point' : 'text-sub'}`}>{line.text}</p>}
        </div>
      </Link>
    </li>
  )
}

/** 이 기기에서 들어간 모임방 목록. 할 일이 있는 방이 먼저, 완성된 방은 따로 모아 보여준다 */
function RoomListPage() {
  const navigate = useNavigate()
  const [homes, setHomes] = useState<RoomHome[] | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [ongoingVisible, setOngoingVisible] = useState(ROOM_PAGE_SIZE)
  const [doneVisible, setDoneVisible] = useState(ROOM_PAGE_SIZE)
  const [roomQuery, setRoomQuery] = useState('')
  const [reviewerDemoEnabled, setReviewerDemoEnabled] = useState(false)
  const [demoBusy, setDemoBusy] = useState(true)
  const changingDemo = useRef(false)
  const demoSequence = useRef(0)
  const lastDemoScope = useRef<string | null>(null)
  const [listVersion, setListVersion] = useState(0)
  // 두루 챗봇 바텀시트. 내려도 대화는 chatStore에 남는다
  // 상점(크레딧 구매)에서 돌아오면 챗봇을 다시 열어 이어서 물어볼 수 있게 한다
  const location = useLocation()
  const [chatOpen, setChatOpen] = useState(() => Boolean((location.state as { openChat?: boolean } | null)?.openChat))
  const [demo, setDemo] = useState<ReviewerDemo | null>(null)
  const [demoHomes, setDemoHomes] = useState<RoomHome[]>([])
  const [demoError, setDemoError] = useState('')
  const [demoRetry, setDemoRetry] = useState(0)
  const applyDemo = async (state: ReviewerDemoState, sequence: number) => {
    if (sequence !== demoSequence.current) return
    const scope = state.enabled ? state.hostRoomId : 'REAL'
    syncChatScope(scope ?? 'REAL')
    if (lastDemoScope.current !== null && lastDemoScope.current !== scope) {
      setChatOpen(false)
      setListVersion((value) => value + 1)
    }
    lastDemoScope.current = scope
    setReviewerDemoEnabled(state.enabled)
    setDemoError('')
    if (!state.enabled) { setDemo(null); setDemoHomes([]); return }
    if (!state.hostRoomId || !state.memberRoomId || !state.completedRoomId) throw new Error('데모 방 정보를 확인하지 못했어요.')
    setDemo({ hostRoomId: state.hostRoomId, memberRoomId: state.memberRoomId, completedRoomId: state.completedRoomId })
    const loaded = await Promise.all([state.hostRoomId, state.memberRoomId, state.completedRoomId].map((id) => getRoomHome(id, '')))
    if (sequence === demoSequence.current) setDemoHomes(loaded)
  }
  const toggleReviewerDemo = async () => {
    if (changingDemo.current || demoBusy) return
    changingDemo.current = true
    setDemoBusy(true)
    const sequence = ++demoSequence.current
    try {
      const state = await updateReviewerDemo(!reviewerDemoEnabled)
      if (!state.enabled && demo) [demo.hostRoomId, demo.memberRoomId, demo.completedRoomId].forEach(removeRoomSession)
      resetChat()
      setChatOpen(false)
      setDemoHomes([])
      setListVersion((value) => value + 1)
      navigate(paths.roomList(), { replace: true, state: null })
      await applyDemo(state, sequence)
    } catch (cause) { setDemoError(cause instanceof Error ? cause.message : '데모 상태를 바꾸지 못했어요.') }
    finally { changingDemo.current = false; setDemoBusy(false) }
  }
  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (changingDemo.current) return
      const sequence = ++demoSequence.current
      void getReviewerDemo().then((state) => { if (!cancelled) return applyDemo(state, sequence) }).catch((cause: unknown) => {
        if (!cancelled && sequence === demoSequence.current) setDemoError(cause instanceof Error ? cause.message : '데모 상태를 불러오지 못했어요.')
      }).finally(() => { if (!cancelled && sequence === demoSequence.current) setDemoBusy(false) })
    }
    load()
    const visible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', visible)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', visible) }
    // 상태 조회는 진입·복귀·재시도 때만 수행한다. 스위치 변경은 PUT 성공 결과를 적용한다.
  }, [demoRetry])
  useEffect(() => {
    // 로그인한 계정의 방 목록을 받아 방마다 홈 정보를 불러온다. 지워졌거나 더 들어갈 수 없는 방은 뺀다
    // (mock 모드에서는 계정이 없어서 이 기기에 저장된 방 목록을 쓴다)
    // 다른 앱·탭에 갔다 오면 다시 불러와서 방장 변경·플랜 변경 등이 바로 보이게 한다
    const load = () => getMyRooms()
      .then((rooms) => {
        // 다른 기기에서 들어간 방도 이 기기에서 열 수 있게 방 이름을 기억해 둔다. 초대 토큰은 그대로 둔다
        rooms?.forEach((r) =>
          saveRoomSession(r.roomId, { memberAccessToken: '', ...getRoomSession(r.roomId), roomName: r.name }),
        )
        const ids = rooms ? rooms.map((r) => r.roomId) : listSavedRoomIds()
        return Promise.allSettled(ids.map((id) => getRoomHome(id, '')))
      })
      .then((results) => setHomes(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))))
      .catch(() => setHomes((prev) => prev ?? []))
    load()
    const handleVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [listVersion])

  // 실시간 이벤트가 온 방 하나만 다시 불러와 목록에서 바꿔 끼운다
  const refreshRoom = (roomId: string) => {
    getRoomHome(roomId, '')
      .then((fresh) => {
        setHomes((prev) => prev?.map((h) => (h.room.id === roomId ? fresh : h)) ?? prev)
        setDemoHomes((prev) => prev.map((home) => home.room.id === roomId ? fresh : home))
      })
      .catch(() => {})
  }

  const handleLogout = async () => {
    try { sessionStorage.removeItem('duruduru:reviewer-demo-enabled') } catch { /* 저장소 사용 불가 */ }
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate(paths.login(), { replace: true })
    }
  }

  if (!homes) return <main className="flex-1 bg-bg" aria-busy="true" />

  const demoIds = new Set(demo ? [demo.hostRoomId, demo.memberRoomId, demo.completedRoomId] : [])
  const regularHomes = homes.filter((home) => !demoIds.has(home.room.id) && !home.room.name.startsWith('[심사용]'))
  const demoOngoing = demoHomes.filter((home) => home.room.status !== 'GROWING')
  const demoDone = demoHomes.filter((home) => home.room.status === 'GROWING')
  const matchingHomes = regularHomes.filter((home) => home.room.name.toLocaleLowerCase().includes(roomQuery.trim().toLocaleLowerCase()))
  const ongoing = matchingHomes
    .filter((h) => h.room.status !== 'GROWING')
    .sort(
      (a, b) =>
        Number(hasTodo(b)) - Number(hasTodo(a)) ||
        (a.room.deadlineAt ? new Date(a.room.deadlineAt).getTime() : Infinity) - (b.room.deadlineAt ? new Date(b.room.deadlineAt).getTime() : Infinity),
    )
  const done = matchingHomes
    .filter((h) => h.room.status === 'GROWING')
    .sort((a, b) => (b.room.meetingDate ?? '').localeCompare(a.room.meetingDate ?? ''))

  return (
    <main className={`flex min-h-dvh flex-col bg-bg text-ink ${BOTTOM_TABS_SPACE}`}>
      <div className="px-5 pt-[clamp(40px,8dvh,64px)] pb-6">
        <div className="flex items-center justify-between gap-3 px-1.5">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-[16px] font-bold">
            {/* 첫 화면과 같은 두루마리 로고 */}
            <img src={logo} alt="" className="h-7 w-auto select-none" draggable={false} />
            <span className="whitespace-nowrap text-point">두루두루</span>
            {/* 데모에서 지금 어떤 입장으로 보고 있는지. 바꾸려면 로그아웃하고 다시 고른다 */}
            {USE_MOCK && (
              <span className="rounded-full bg-[#f6e3ea] px-2 py-0.5 text-[10px] font-semibold text-point">
                데모 · {getMockRole() === 'HOST' ? '방장으로' : '멤버로'} 보는 중
              </span>
            )}
          </p>
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink active:bg-line/40 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                <path d="M9 5H5v14h4M9 12h12m-4-4 4 4-4 4" />
              </svg>
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        </div>

        <div className="mt-[clamp(28px,6dvh,48px)] flex flex-wrap items-center justify-between gap-3 px-1.5">
          <h1 className="text-[26px] leading-8 font-bold">내 모임방</h1>
          <button type="button" role="switch" aria-checked={reviewerDemoEnabled} aria-label="심사용 데모" aria-busy={demoBusy} disabled={demoBusy} onClick={() => void toggleReviewerDemo()} className="flex min-h-11 items-center gap-2 text-[12px] text-sub disabled:opacity-50">
            심사용 데모
            <span aria-hidden="true" className={`relative h-6 w-10 rounded-full transition-colors ${reviewerDemoEnabled ? 'bg-point' : 'bg-muted'}`}><span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${reviewerDemoEnabled ? 'translate-x-4' : ''}`} /></span>
            <span className="w-6 text-[10px] font-semibold">{reviewerDemoEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        {reviewerDemoEnabled && <p className="mt-1 px-1.5 text-[10px] leading-4 text-sub">OFF로 바꾸면 데모 방과 체험 중 남긴 기록·대화가 삭제돼요.</p>}
        <button type="button" onClick={() => navigate(paths.roomCreate())} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-surface active:opacity-80">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          새 모임방 만들기
        </button>
        {(demoError || (reviewerDemoEnabled && demoHomes.length === 0)) && <div className="mt-4 rounded-2xl bg-surface px-4 py-4">
          <p className="text-[13px] font-semibold text-point">데모용 모임방</p>
          {demoError ? <><p role="alert" className="mt-2 text-[12px] text-sub">{demoError}</p><button type="button" className="mt-2 min-h-11 text-[12px] font-semibold text-point" onClick={() => { setDemoError(''); setDemoRetry((value) => value + 1) }}>다시 불러오기</button></> : <p role="status" className="mt-2 text-[12px] text-sub">체험할 모임방을 준비하고 있어요…</p>}
        </div>}
        {reviewerDemoEnabled && demoOngoing.length > 0 && <section aria-label="진행 중인 데모용 모임방" className="mt-5">
          <h2 className="mb-2 ml-3 text-[11px] font-semibold text-sub">데모용 모임방</h2>
          <ul className="overflow-hidden rounded-[20px] border-2 border-ink/35 bg-surface [&>li+li]:border-t [&>li+li]:border-line">{demoOngoing.map((home) => <RoomCard key={home.room.id} home={home} meta={ongoingMeta(home)} reviewerDemo={demo} />)}</ul>
        </section>}
        {regularHomes.length > 3 && <div className="relative mt-5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sub" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input type="search" aria-label="내 모임방 검색" placeholder="모임방 이름으로 찾기" value={roomQuery} onChange={(event) => { setRoomQuery(event.target.value); setOngoingVisible(ROOM_PAGE_SIZE); setDoneVisible(ROOM_PAGE_SIZE) }} className="h-11 w-full rounded-2xl border border-line bg-surface pr-4 pl-11 text-[13px] outline-none focus:border-ink/40" />
        </div>}
        {roomQuery && matchingHomes.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-sub">일치하는 모임방이 없어요.</p>}
        {regularHomes.length === 0 && !reviewerDemoEnabled ? (
          // 처음 온 사용자: 방이 하나도 없을 때 바로 방 만들기로 보내지 않고 무엇을 하는 곳인지 먼저 보여준다
          <section className="px-1.5">
            <div className="mt-6 flex flex-col items-center rounded-[24px] border border-dashed border-line bg-surface px-6 pt-9 pb-7 text-center">
              <div className="flex items-end gap-1" aria-hidden="true">
                <Flower code="AZALEA" size={28} />
                <Flower code="FORSYTHIA" size={36} />
                <Flower code="FORGET_ME_NOT" size={28} />
              </div>
              <p className="mt-4 text-[17px] font-bold">아직 들어간 모임방이 없어요</p>
              <p className="mt-2 text-[13px] leading-5 text-sub">
                모임방을 만들고 친구를 초대해 보세요.
                <br />
                사진에 한마디씩 남기면 우리 이야기가 두루마리가 돼요.
              </p>
              <button
                type="button"
                onClick={() => navigate(paths.roomCreate())}
                className="mt-6 h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-surface active:opacity-80"
              >
                첫 모임방 만들기
              </button>
              <p className="mt-3 text-[11px] text-muted">친구에게 초대 링크를 받았다면 그 링크로 들어오면 돼요</p>
            </div>
          </section>
        ) : (
          <section className="mt-5">
          {ongoing.length > 0 && (
            <ul className="mt-[15px] flex flex-col gap-[11px]">
              {ongoing.slice(0, ongoingVisible).map((h) => (
                <RoomCard key={h.room.id} home={h} meta={ongoingMeta(h)} />
              ))}
            </ul>
          )}
          <RoomListContinuation total={ongoing.length} visible={ongoingVisible} onMore={() => setOngoingVisible((count) => count + ROOM_PAGE_SIZE)} />
        </section>
        )}

        {((reviewerDemoEnabled && demoDone.length > 0) || done.length > 0) && (
          <section className="mt-3">
            <h2 className="px-1.5 text-[11px] text-sub">완성된 두루마리</h2>
            {reviewerDemoEnabled && demoDone.length > 0 && <section aria-label="완성된 데모용 모임방" className="mt-3">
              <h3 className="mb-2 ml-3 text-[11px] font-semibold text-sub">데모용 두루마리</h3>
              <ul className="overflow-hidden rounded-[20px] border-2 border-ink/35 bg-surface [&>li+li]:border-t [&>li+li]:border-line">{demoDone.map((home) => <RoomCard key={home.room.id} home={home} meta={doneMeta(home)} reviewerDemo={demo} />)}</ul>
            </section>}
            <ul className="mt-3 flex flex-col gap-[11px]">
              {done.slice(0, doneVisible).map((h) => (
                <RoomCard key={h.room.id} home={h} meta={doneMeta(h)} />
              ))}
            </ul>
            <RoomListContinuation total={done.length} visible={doneVisible} onMore={() => setDoneVisible((count) => count + ROOM_PAGE_SIZE)} />
          </section>
        )}
      </div>

      {/* 챗봇 버튼이 마지막 카드를 가리지 않게 아래에 여유를 둔다 */}
      <div className="h-24" aria-hidden="true" />
      {/* 진행 중인 방(할 일 많은 순)부터 실시간으로 지켜본다. 친구의 "방장에게 알리기" 같은 알림이 바로 배지로 뜬다 */}
      {[...(reviewerDemoEnabled ? demoOngoing : []), ...ongoing].slice(0, MAX_LIVE_ROOMS).map((h) => (
        <RoomLiveWatcher key={h.room.id} roomId={h.room.id} onChange={refreshRoom} />
      ))}
      <ChatFab onOpen={() => setChatOpen(true)} />
      {chatOpen && <ChatSheet onClose={() => setChatOpen(false)} />}
      <BottomTabs />
    </main>
  )
}

export default RoomListPage
