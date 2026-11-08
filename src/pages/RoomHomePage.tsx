import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { ReviewerDemo } from '../api/reviewerDemo'
import { ApiError } from '../api/client'
import { MAX_PHOTOS } from '../api/photos'
import { getRoomHome, ROOM_CAPACITY } from '../api/rooms'
import type { CirculationCard, FlowerCode, Member, RoomHome, RoomStatus, RoomSummary } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import { SparkleIcon } from '../components/entry/EntryIcons'
import Flower, { EmptySlot } from '../components/Flower'
import BranchFlowers from '../components/BranchFlowers'
import { participationRate, useRoomCards } from '../lib/participation'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { useInviteShare } from '../hooks/useInviteShare'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import RecentPhotosCarousel from '../components/RecentPhotosCarousel'
import { FLOWER_COLOR } from '../lib/flower'
import { getRoomSession } from '../lib/session'
import WeaveDatePrompt from '../components/WeaveDatePrompt'
import EarlyCloseButton from '../components/EarlyCloseButton'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'
import { useRoomInvite } from '../hooks/useRoomInvite'

const STATUS_LABEL: Record<RoomStatus, string> = {
  COLLECTING: '모으는 중',
  CIRCULATING: '돌려보는 중',
  WEAVING: '엮는 중',
  GROWING: '자라는 중',
}

/** 방장이 정한 엮는 시각까지 남은 시간 ("3일 남았어요", "5시간 남았어요"). 방장이 정하기 전에는 비운다 */
function deadlineText(room: { deadlineAt: string | null; deadlineChangedByHost?: boolean }, now: number) {
  if (!room.deadlineAt || !room.deadlineChangedByHost) return ''
  const left = new Date(room.deadlineAt).getTime() - now
  if (left <= 0) return '곧 엮어요'
  const hours = Math.floor(left / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.ceil(left / 60_000))}분 남았어요`
  if (hours < 24) return `${hours}시간 남았어요`
  return `${Math.floor(hours / 24)}일 남았어요`
}


function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    // 꽃잎처럼 둥근 톱니 6개를 겹친 톱니바퀴
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <circle key={deg} cx="12" cy="4.6" r="3" transform={`rotate(${deg} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.6" fill="var(--color-bg)" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0-6 6v3.6l-1.5 2.6A1.2 1.2 0 0 0 5.5 17h13a1.2 1.2 0 0 0 1-1.8L18 12.6V9a6 6 0 0 0-6-6Z" />
      <circle cx="12" cy="19.5" r="2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
      <path d="M1 7L7 13L17 1" stroke="#6b6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 엮기 카드의 두루마리 그림 */
/** 두루마리 아이콘. 가운데 꽃은 방장 꽃 색을 따라간다 */
function ScrollIcon({ flower }: { flower: FlowerCode }) {
  return (
    <div className="relative h-[60px] w-[50px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 h-2.5 rounded-full bg-ink" />
      <span className="absolute top-[11px] left-1/2 -translate-x-1/2">
        <Flower code={flower} size={34} />
      </span>
      <span className="absolute inset-x-0 bottom-0 h-2.5 rounded-full bg-ink" />
    </div>
  )
}

/** 참여현황 한 줄: 꽃 + 이름, 사진/이야기 수(다 봤으면 체크), 참여율 막대 */
/** 방 전체에 모인 사진·이야기 수. 하나도 없을 때만 핀 꽃 아래에 안내를 띄운다 */
const sumOf = (members: Member[], key: 'photoCount' | 'storyCount') => members.reduce((n, m) => n + (m[key] ?? 0), 0)
const activityTotal = (members: Member[]) => sumOf(members, 'photoCount') + sumOf(members, 'storyCount')

/** 참여율(0~1) = 참여한 고유 사진 ÷ 방 전체 사진. 서버 값이 있으면 그걸 쓰고, 없으면 돌려보기 목록으로 센다 */
function memberRate(member: Member, cards: CirculationCard[] | null) {
  const server = member.totalPhotoCount ? (member.participatedPhotoCount ?? 0) / member.totalPhotoCount : null
  return Math.min(Math.max(server ?? (cards ? participationRate(cards, member) : member.responseRate ?? 0), 0), 1)
}

function MemberProgress({ member, cards }: { member: Member; cards: CirculationCard[] | null }) {
  // 방 상태와 상관없이 실제 참여율로 그린다. 100%가 된 사람만 체크
  const rate = memberRate(member, cards)
  const done = rate >= 1
  return (
    <li>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px]">
          <Flower code={member.flowerCode} size={21} />
          {member.nickname}
          {member.role === 'HOST' && ' · 방장'}
        </span>
        {done ? (
          <CheckIcon />
        ) : (
          <span className="text-[11px] text-sub">
            사진 {member.photoCount ?? 0}장 · 이야기 {member.storyCount ?? 0}개
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${rate * 100}%`, backgroundColor: FLOWER_COLOR[member.flowerCode] }}
        />
      </div>
    </li>
  )
}

/** 방 이름(뒤로 가기), 상태, 마감까지 남은 시간 */
function RoomHeader({ room, gathering, unreadCount }: { room: RoomSummary; gathering: boolean; unreadCount: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const reviewerDemo = (location.state as { reviewerDemo?: ReviewerDemo } | null)?.reviewerDemo
  // 남은 시간은 화면을 연 시각 기준 (렌더 중에 시계를 읽지 않는다)
  const [now] = useState(() => Date.now())
  const left = deadlineText(room, now)
  return (
    <header className="px-1">
      <div className="flex items-center justify-between">
        {/* 어디서 들어왔든(방 만들기·초대 링크·카톡 링크) 뒤로 가면 내 모임방 목록으로 간다 */}
        <button
          type="button"
          onClick={() => navigate(paths.roomList(), { state: reviewerDemo ? { reviewerDemo } : null })}
          className="flex items-center gap-2.5 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          {room.name}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 안 읽음` : '알림'}
            onClick={() => navigate(paths.roomNotifications(room.id))}
            className="relative p-2 text-sub active:opacity-80"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-point px-1 text-[9px] font-semibold text-surface">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="모임방 설정"
            onClick={() => navigate(paths.roomSettings(room.id))}
            className="-mr-2 p-2 text-sub active:opacity-80"
          >
            <GearIcon />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <span
          className={`rounded-full px-3 py-0.5 text-[9px] ${gathering ? 'bg-[#efe9df] text-[#6b6b6b]' : 'bg-[#f6e3ea] text-point'}`}
        >
          {STATUS_LABEL[room.status]}
        </span>
        {left && <span className="text-[11px] text-sub">{left}</span>}
      </div>
    </header>
  )
}

// 친구를 기다리는 동안 보여줄 빈 자리 수
const EMPTY_MEMBER_SLOTS = 2

const SHARE_BUTTON_CLASS =
  'flex h-[57px] items-center justify-center gap-1.5 rounded-[20px] border border-line bg-surface text-[13px] text-sub active:opacity-80'

/** 방이 열리고 친구들이 다 모이기 전: 초대 링크 공유와 내 첫 사진 올리기 */
function GatheringHome({ home, inviteToken, datePrompt, roomCards }: { home: RoomHome; inviteToken?: string; datePrompt?: React.ReactNode; roomCards: CirculationCard[] | null }) {
  const navigate = useNavigate()
  const { room, members, myTodo } = home
  const { link, copied, copy, share } = useInviteShare(inviteToken ?? '')
  const emptyMemberSlots = Math.min(EMPTY_MEMBER_SLOTS, (room.capacity ?? ROOM_CAPACITY) - members.length)
  const memberNames = members.map((m) => (m.role === 'HOST' ? `${m.nickname} · 방장` : m.nickname)).join(', ')

  return (
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-[clamp(40px,8dvh,64px)] pb-6">
        <RoomHeader room={room} gathering unreadCount={home.unreadCount} />

        <section className="mt-3.5 px-1.5">
          <h2 className="text-[11px] text-sub">핀 꽃</h2>
          {/* 지금 들어온 인원수만큼 자리를 두고 핀 꽃부터 채운다 */}
          <BranchFlowers status={room.status} roomId={room.id} members={members} cards={roomCards} />
          <p className="mt-2 text-[11px] text-sub">
            {activityTotal(members) === 0 && '아직 핀 꽃이 없어요 · 첫 꽃을 피워 보세요'}
          </p>
        </section>

        <Card className="mt-5 px-[23px] pt-3.5 pb-[15px]">
          <div className="flex items-center justify-between px-[3px] text-[11px]">
            <p className="text-sub">친구를 기다리고 있어요</p>
            <p>
              {members.length}/{room.capacity ?? ROOM_CAPACITY}명
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-[5px] gap-y-2 px-[3px]">
            <ul className="flex flex-wrap gap-[5px]">
              {members.map((m) => (
                <li key={m.id} className="rounded-full border border-dashed border-sub">
                  <Flower code={m.flowerCode} size={28} />
                </li>
              ))}
              {Array.from({ length: emptyMemberSlots }, (_, i) => (
                <li key={`empty-${i}`}>
                  <EmptySlot />
                </li>
              ))}
            </ul>
            <p className="ml-[7px] text-[11px] text-sub">{memberNames}</p>
          </div>
        </Card>
      </div>

      {/* 긴 화면(노트북 등)에서는 아래에 붙이지 않고 내용 바로 아래에 둔다 */}
      <footer className="mt-auto px-5 pt-3 pb-6 [@media(min-height:900px)]:mt-2">
        {datePrompt}
        <Card className="px-[26px] pt-[15px] pb-6">
          <p className="text-[11px] text-sub">내 할 일</p>
          <p className="mt-1 text-[15px] font-bold">
            {myTodo.needsFirstEntry ? '사진 올리고 한 마디 남기기' : '친구들이 모이길 기다리고 있어요'}
          </p>
          {myTodo.needsFirstEntry && (
            <Button onClick={() => navigate(paths.photoUpload(room.id))} className="mt-3 w-full">
              사진 고르기
            </Button>
          )}

          {/* 친구를 부르는 것도 지금 할 일: 고정 초대 링크와 공유 버튼 */}
          {inviteToken && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[11px] text-sub">친구 초대하기</p>
              <p className="mt-1.5 truncate rounded-xl bg-bg px-3 py-2.5 text-[12px] text-sub">{link}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => copy()} className={SHARE_BUTTON_CLASS}>
                  <CopyIcon />
                  {copied ? '복사됨' : '링크 복사'}
                </button>
                <button type="button" onClick={() => share()} className={SHARE_BUTTON_CLASS}>
                  <ShareIcon />
                  단톡방에 공유하기
                </button>
              </div>
            </div>
          )}
        </Card>
        <EarlyCloseButton home={home} token={getRoomSession(room.id)?.memberAccessToken ?? ''} />
      </footer>
    </main>
  )
}

/** 내 할 일: 내 사진 더 올리기, 친구 사진에 이야기 붙이기 */
function MyTodoCard({ home, cards }: { home: RoomHome; cards: CirculationCard[] | null }) {
  const navigate = useNavigate()
  const { room, me, members, myTodo } = home
  // 사진 한도는 플랜마다 다르다(1인 3/6/10장). 서버가 준 한도를 쓰고, 없으면 기본 3장으로 본다
  const maxPhotos = room.quota?.photosPerMember ?? MAX_PHOTOS
  const myPhotos = room.quota?.myPhotoCount ?? me.photoCount ?? 0
  const canAddPhotos = myPhotos < maxPhotos
  // 친구 사진 수는 돌려보기 목록으로 센다 (목록을 아직 못 받았으면 서버 숫자로). 친구 사진이 있으면 늘 둘러볼 수 있다
  const friendCards = cards?.filter((c) => c.myResponse.status !== 'OWN_PHOTO') ?? null
  const friendPhotos = friendCards ? friendCards.length : members.filter((m) => m.id !== me.id).reduce((sum, m) => sum + (m.photoCount ?? 0), 0)

  return (
    <Card className="pt-[18px] pb-5">
      <p className="text-[11px] text-sub">내 할 일</p>
      <div className="mt-2 flex items-start justify-between gap-3 border-b border-line pb-2.5">
        <div>
          <p className="text-[15px] leading-5 font-bold">
            내 사진 {myPhotos}/{maxPhotos}장
          </p>
          <p className="text-[11px] leading-4 text-sub">
            {myTodo.needsFirstEntry
              ? '사진에 첫 한마디를 남겨 주세요'
              : canAddPhotos
                ? `${maxPhotos - myPhotos}장 더 올릴 수 있어요`
                : '사진을 모두 올렸어요'}
          </p>
        </div>
        {canAddPhotos && (
          <button
            type="button"
            onClick={() => navigate(paths.photoUpload(room.id))}
            // 시안처럼 버튼 가운데를 제목 줄에 맞춘다
            className="-mt-2.5 h-[39px] shrink-0 rounded-full border border-ink px-[25px] text-[13px] active:opacity-80"
          >
            사진 고르기
          </button>
        )}
      </div>
      <p className="mt-2.5 text-[15px] leading-5 font-bold">
        친구 사진에 이야기 붙이기
      </p>
      {/* 사진 하나에 덧붙이는 건 그 사진 카드에서, 여기서는 언제든 방 사진 전체를 돌려본다 */}
      {friendPhotos > 0 && (
        <Button onClick={() => navigate(paths.roomCirculation(room.id))} className="mt-3 w-full">
          친구 사진 둘러보기
        </Button>
      )}
    </Card>
  )
}

/** 모임방 홈: 방 상태, 핀 꽃, 받은 질문, 참여현황, 내 할 일 */
function RoomHomePage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 방장은 원본 초대 토큰이 있어서 초대 링크를, 멤버는 이 방 주소를 단톡방에 보낸다
  // 고정 초대 링크: 이 기기에 없으면 서버에서 받아 온다 (방 참가자 누구나 같은 링크)
  const inviteToken = useRoomInvite(roomId)
  const { share: shareInvite } = useInviteShare(inviteToken ?? '')

  // 쿠키로 인증해서 토큰은 비어 있을 수 있다. 이 기기에 방 정보가 아예 없을 때(undefined)만 막는다
  const token = session?.memberAccessToken

  useEffect(() => {
    if (token === undefined) return
    getRoomHome(roomId, token)
      .then(setHome)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError && e.status === 403 ? '이 방에 들어갈 수 없어요' : '방 정보를 불러오지 못했어요',
        ),
      )
  }, [roomId, token])

  // 친구가 들어오거나 이야기를 남기면 홈을 다시 불러온다. 다시 불러오다 실패하면 지금 화면을 그대로 둔다
  useRoomLiveUpdates(roomId, token, () => {
    if (token === undefined) return
    getRoomHome(roomId, token)
      .then(setHome)
      .catch((e: unknown) => {
        // 방장이 나를 내보냈거나 방이 지워졌으면 더 볼 수 없어서 안내한다
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setError('이 방에 더 들어갈 수 없어요')
      })
  })

  const reloadHome = () => {
    if (token === undefined) return
    getRoomHome(roomId, token).then(setHome).catch(() => {})
  }

  // 핀 꽃·참여현황이 같이 쓰는 둘러보기 사진 목록 (홈이 갱신되면 같이 다시 불러온다)
  const roomCards = useRoomCards(roomId, token, home)

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (error) return <NotFoundPage message={error} />
  if (!home) return <main className="flex-1 bg-bg" aria-busy="true" />

  const { room, me, members, myTodo } = home

  /** 모든 초대 공유는 토큰이 포함된 초대 링크를 사용한다. */
  const handleShareToChat = async () => {
    const text = `${room.name} 두루마리 같이 채우자! 사진 올리고 한마디 남겨줘`
    await shareInvite(text)
  }

  // 사진을 모으는 동안 친구들이 다 들어오기 전까지는 친구를 기다리는 화면을 보여준다
  if (room.status === 'COLLECTING' && members.length < (room.capacity ?? ROOM_CAPACITY)) {
    return (
      <GatheringHome home={home} roomCards={roomCards} inviteToken={inviteToken} datePrompt={<WeaveDatePrompt home={home} token={token ?? ''} onSaved={reloadHome} />} />
    )
  }

  // 돌려보는 중에 모두가 할 일을 마치면 마감을 기다리지 않고 엮을 수 있다
  const readyToWeave = room.status === 'CIRCULATING' && home.allCompleted
  // 두루마리가 완성된 방도 시안처럼 모두 다 본 모양(체크·꽉 찬 막대)으로 보여준다
  const grown = room.status === 'GROWING'
  const allDone = readyToWeave || grown
  // 모든 사람이 참여율 100%면 두루마리를 만들기에 충분하다고 알려 준다 (엮는 건 방장이 정한 시각에)
  const everyoneFull = members.length > 0 && members.every((m) => memberRate(m, roomCards) >= 1)
  // 혼자 쓰는 방: 참여현황에 '1/1명 다 봤어요' 대신 '혼자 기록하는 중', 알릴 친구가 없어 단톡방 알리기는 숨긴다
  const solo = members.length === 1
  // 두루마리 아이콘 꽃은 방장 꽃 색 (방장을 못 찾으면 내 꽃)
  const hostFlower = members.find((m) => m.role === 'HOST')?.flowerCode ?? me.flowerCode

  return (
    // 내용이 짧으면 내 할 일 카드가 화면 아래에 붙고, 길면 페이지 전체가 함께 스크롤된다
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-16 pb-5">
        <RoomHeader room={room} gathering={false} unreadCount={home.unreadCount} />

        <section className="mt-2.5 px-1.5">
          <h2 className="text-[11px] text-sub">핀 꽃</h2>
          <BranchFlowers status={room.status} roomId={room.id} members={members} cards={roomCards} />
          <p className="mt-1 text-[11px] text-sub">
            {activityTotal(members) === 0 && '아직 핀 꽃이 없어요 · 첫 꽃을 피워 보세요'}
          </p>
        </section>

        {/* 방에 올라온 사진(친구 사진 포함)을 최근 것부터, 여러 장이면 옆으로 넘긴다 */}
        {roomCards && roomCards.length > 0 && (
          <RecentPhotosCarousel roomId={room.id} token={token ?? ''} version={home} />
        )}

        {!allDone && myTodo.topAskback && (
          <section className="mt-4 rounded-xl bg-[#f6e3ea] px-3.5 pt-3.5 pb-4">
            <p className="flex items-center gap-1.5 text-[11px] text-point">
              <SparkleIcon />
              {me.nickname}님에게 질문이 왔어요
            </p>
            <p className="mt-1 text-[16px] leading-6 font-bold">“{myTodo.topAskback.question}”</p>
            <button
              type="button"
              onClick={() => myTodo.topAskback && navigate(paths.askback(room.id, myTodo.topAskback.id))}
              className="mt-1 h-[39px] rounded-full border border-ink bg-surface px-[15px] text-[13px] active:opacity-80"
            >
              한 문장만 답하기
            </button>
          </section>
        )}

        <section className="mt-2">
          <div className="flex items-center justify-between px-0.5 text-[11px]">
            <h2 className="text-sub">참여현황</h2>
            <p>
              {solo ? '혼자 기록하는 중' : <>{members.length}/{room.capacity ?? ROOM_CAPACITY}명</>}
            </p>
          </div>
          <ul className="mt-0.5 flex flex-col gap-2.5">
            {members.map((m) => (
              <MemberProgress key={m.id} member={m} cards={roomCards} />
            ))}
          </ul>
          {/* 모두 100%면: 두루마리를 만들기에 충분해요 (엮기는 방장이 정한 시각에) */}
          {everyoneFull && !grown && room.status !== 'WEAVING' && (
            <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[#eef3e8] px-3 py-2 text-[12px] font-semibold text-[#4f6b3f]" role="status">
              <span aria-hidden="true">✓</span> 모두 참여했어요. 두루마리를 만들기에 충분해요
            </p>
          )}
        </section>
      </div>

      <footer className="mt-auto px-5 pb-5 [@media(min-height:900px)]:mt-2">
        {/* 엮는 시각은 방장이 정한다 (모두 다 봐도 바로 엮지 않고, 정한 시각에 엮는다) */}
        <WeaveDatePrompt home={home} token={token ?? ''} onSaved={reloadHome} />
        <EarlyCloseButton home={home} token={token ?? ''} />
        {grown ? (
          <Card className="flex flex-col items-center pt-[22px] pb-5 text-center">
            <ScrollIcon flower={hostFlower} />
            <p className="mt-2 text-[15px] font-bold">첫 두루마리가 완성됐어요</p>
            <p className="mt-2 text-[11px] text-sub">답가를 달면 두루마리가 계속 자라요</p>
            <Button onClick={() => navigate(paths.roomWeaving(room.id))} className="mt-3.5 w-full">
              두루마리 보기
            </Button>
          </Card>
        ) : room.status === 'WEAVING' ? (
          <Button onClick={() => navigate(paths.roomWeaving(room.id))} className="w-full">
            엮는 중 확인하기
          </Button>
        ) : (
          <MyTodoCard home={home} cards={roomCards} />
        )}
        {!solo && <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void handleShareToChat()}
            className="flex items-center gap-2 py-0.5 text-[11px] text-sub active:opacity-80"
          >
            <ShareIcon />
            단톡방에 알리기
          </button>
        </div>}
      </footer>
    </main>
  )
}

export default RoomHomePage
