import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { getMockRole, USE_MOCK } from '../api/mock'
import { getMyRooms, getRoomHome } from '../api/rooms'
import type { RoomHome, RoomStatus } from '../api/types'
import BottomTabs, { BOTTOM_TABS_SPACE } from '../components/BottomTabs'
import ChatFab from '../components/ChatFab'
import Flower from '../components/Flower'
import { formatDateSpaced } from '../lib/date'
import { logout } from '../lib/auth'
import { getRoomSession, listSavedRoomIds, saveRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

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

/** 내가 할 일이 남아 있는 방인지 */
function hasTodo({ myTodo }: RoomHome) {
  return myTodo.needsFirstEntry || myTodo.topAskback !== null || myTodo.pendingCirculationCount > 0
}

/** 진행 중인 방의 남은 시간 · 참여 인원 */
function ongoingMeta({ room, members }: RoomHome) {
  const hours = Math.ceil((new Date(room.deadlineAt).getTime() - Date.now()) / (60 * 60 * 1000))
  return `${hours > 0 ? `${hours}시간 남음` : '곧 마감'} · 참여 ${members.length}명`
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

function RoomCard({ home, meta }: { home: RoomHome; meta: string }) {
  const { room } = home
  const line = todoLine(home)
  return (
    <li>
      <Link
        to={paths.roomHome(room.id)}
        className="flex gap-[7px] rounded-[20px] border border-line bg-surface px-3 pt-[14px] pb-[13px] active:opacity-80"
      >
        {/* TODO: 대표 사진이 홈 응답에 없어서 빈 칸으로 둔다 */}
        <div className="size-14 shrink-0 rounded-2xl bg-bg" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-[14px] min-w-[55px] rounded-full px-2 text-center text-[8px] leading-[14px] ${STATUS_CLASS[room.status]}`}
            >
              {STATUS_LABEL[room.status]}
            </span>
            {/* 이 방에서 내가 누구인지: 내 꽃 · 닉네임 · 방장 여부 */}
            <span className="flex items-center gap-1 text-[10px] text-sub">
              <Flower code={home.me.flowerCode} size={14} />
              {home.me.nickname}
              {home.me.role === 'HOST' && <span className="font-semibold text-point">· 방장</span>}
            </span>
          </div>
          <p className="mt-[5px] truncate text-[16px] leading-5 font-semibold">{room.name}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-sub">{meta}</p>
          {line && <p className={`mt-[3px] text-[11px] leading-4 ${line.todo ? 'text-point' : 'text-sub'}`}>{line.text}</p>}
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

  useEffect(() => {
    // 로그인한 계정의 방 목록을 받아 방마다 홈 정보를 불러온다. 지워졌거나 더 들어갈 수 없는 방은 뺀다
    // (mock 모드에서는 계정이 없어서 이 기기에 저장된 방 목록을 쓴다)
    getMyRooms()
      .then((rooms) => {
        // 다른 기기에서 들어간 방도 이 기기에서 열 수 있게 방 이름을 기억해 둔다. 초대 토큰은 그대로 둔다
        rooms?.forEach((r) =>
          saveRoomSession(r.roomId, { memberAccessToken: '', ...getRoomSession(r.roomId), roomName: r.name }),
        )
        const ids = rooms ? rooms.map((r) => r.roomId) : listSavedRoomIds()
        return Promise.allSettled(ids.map((id) => getRoomHome(id, '')))
      })
      .then((results) => setHomes(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))))
      .catch(() => setHomes([]))
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate(paths.login(), { replace: true })
    }
  }

  if (homes?.length === 0) return <Navigate to={paths.roomCreate()} replace />
  if (!homes) return <main className="flex-1 bg-bg" aria-busy="true" />

  const ongoing = homes
    .filter((h) => h.room.status !== 'GROWING')
    .sort(
      (a, b) =>
        Number(hasTodo(b)) - Number(hasTodo(a)) ||
        new Date(a.room.deadlineAt).getTime() - new Date(b.room.deadlineAt).getTime(),
    )
  const done = homes
    .filter((h) => h.room.status === 'GROWING')
    .sort((a, b) => (b.room.meetingDate ?? '').localeCompare(a.room.meetingDate ?? ''))

  return (
    <main className={`flex min-h-dvh flex-col bg-bg text-ink ${BOTTOM_TABS_SPACE}`}>
      <div className="px-5 pt-[clamp(40px,8dvh,64px)] pb-6">
        <div className="flex items-center justify-between px-[13px]">
          <p className="flex items-center gap-2 text-[16px] font-bold">
            두루두루
            {/* 데모에서 지금 어떤 입장으로 보고 있는지. 바꾸려면 로그아웃하고 다시 고른다 */}
            {USE_MOCK && (
              <span className="rounded-full bg-[#f6e3ea] px-2 py-0.5 text-[10px] font-semibold text-point">
                데모 · {getMockRole() === 'HOST' ? '방장으로' : '멤버로'} 보는 중
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-[11px] text-sub active:opacity-80"
            >
              로그아웃
            </button>
            <button
              type="button"
              onClick={() => navigate(paths.roomCreate())}
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-surface active:opacity-80"
            >
              + 새 모임방
            </button>
          </div>
        </div>

        <section className="mt-[clamp(28px,6dvh,48px)]">
          <h1 className="px-1.5 text-[26px] leading-8 font-bold">내 모임방</h1>
          <p className="mt-2 px-1.5 text-[11px] text-sub">할 일이 있는 방이 먼저 보여요</p>
          {ongoing.length > 0 && (
            <ul className="mt-[15px] flex flex-col gap-[11px]">
              {ongoing.map((h) => (
                <RoomCard key={h.room.id} home={h} meta={ongoingMeta(h)} />
              ))}
            </ul>
          )}
        </section>

        {done.length > 0 && (
          <section className="mt-3">
            <h2 className="px-1.5 text-[11px] text-sub">완성된 두루마리</h2>
            <ul className="mt-3 flex flex-col gap-[11px]">
              {done.map((h) => (
                <RoomCard key={h.room.id} home={h} meta={doneMeta(h)} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* 챗봇 버튼이 마지막 카드를 가리지 않게 아래에 여유를 둔다 */}
      <div className="h-24" aria-hidden="true" />
      <ChatFab />
      <BottomTabs />
    </main>
  )
}

export default RoomListPage
