import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { MAX_PHOTOS } from '../api/photos'
import { closeRoom, getRoomHome, ROOM_CAPACITY } from '../api/rooms'
import type { CirculationCard, Member, RoomHome, RoomStatus, RoomSummary } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import { SparkleIcon } from '../components/entry/EntryIcons'
import Flower, { EmptySlot } from '../components/Flower'
import BranchFlowers from '../components/BranchFlowers'
import { participationRate, useRoomCards } from '../lib/participation'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { useInviteShare } from '../hooks/useInviteShare'
import { copyForShare, shareWithDevice } from '../lib/share'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import RecentPhotosCarousel from '../components/RecentPhotosCarousel'
import { FLOWER_COLOR } from '../lib/flower'
import { getRoomSession } from '../lib/session'
import WeaveDatePrompt from '../components/WeaveDatePrompt'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'
import { useSheetDrag } from '../hooks/useSheetDrag'
import { siteUrl } from '../lib/siteUrl'
import { useRoomInvite } from '../hooks/useRoomInvite'

const STATUS_LABEL: Record<RoomStatus, string> = {
  COLLECTING: '모으는 중',
  CIRCULATING: '돌려보는 중',
  WEAVING: '엮는 중',
  GROWING: '자라는 중',
}

/** 마감까지 남은 시간 안내 문구 */
function deadlineText(room: { deadlineAt: string | null; deadlineChangedByHost?: boolean }) {
  if (!room.deadlineAt || !room.deadlineChangedByHost) return ''
  const d = new Date(room.deadlineAt)
  return `${d.getMonth() + 1}월 ${d.getDate()}일에 엮어요`
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
function ScrollIcon() {
  return (
    <div className="relative h-[60px] w-[50px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 h-2.5 rounded-full bg-ink" />
      <span className="absolute top-[11px] left-1/2 -translate-x-1/2">
        <Flower code="ROYAL_AZALEA" size={34} />
      </span>
      <span className="absolute inset-x-0 bottom-0 h-2.5 rounded-full bg-ink" />
    </div>
  )
}

/** 참여현황 한 줄: 꽃 + 이름, 사진/이야기 수(다 봤으면 체크), 참여율 막대 */
/** 방 전체에 모인 사진·이야기 수. 하나도 없을 때만 핀 꽃 아래에 안내를 띄운다 */
const sumOf = (members: Member[], key: 'photoCount' | 'storyCount') => members.reduce((n, m) => n + (m[key] ?? 0), 0)
const activityTotal = (members: Member[]) => sumOf(members, 'photoCount') + sumOf(members, 'storyCount')

function MemberProgress({ member, done, cards }: { member: Member; done: boolean; cards: CirculationCard[] | null }) {
  // 참여율 = 참여한 사진(올린 사진 + 이야기를 남긴 사진) ÷ 방 전체 사진. 모두 다 봤으면 막대를 꽉 채운다
  const rate = done ? 1 : cards ? participationRate(cards, member) : Math.min(Math.max(member.responseRate ?? 0, 0), 1)
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
  return (
    <header className="px-1">
      <div className="flex items-center justify-between">
        {/* 어디서 들어왔든(방 만들기·초대 링크·카톡 링크) 뒤로 가면 내 모임방 목록으로 간다 */}
        <button
          type="button"
          onClick={() => navigate(paths.roomList())}
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
        {deadlineText(room) && <span className="text-[11px] text-sub">{deadlineText(room)}</span>}
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
          <BranchFlowers roomId={room.id} members={members} cards={roomCards} />
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
      </footer>
    </main>
  )
}

/** 내 할 일: 내 사진 더 올리기, 친구 사진에 이야기 붙이기 */
function MyTodoCard({ home }: { home: RoomHome }) {
  const navigate = useNavigate()
  const { room, me, members, myTodo } = home
  // 사진 한도는 플랜마다 다르다(1인 3/6/10장). 서버가 준 한도를 쓰고, 없으면 기본 3장으로 본다
  const maxPhotos = room.quota?.photosPerMember ?? MAX_PHOTOS
  const myPhotos = room.quota?.myPhotoCount ?? me.photoCount ?? 0
  const canAddPhotos = myPhotos < maxPhotos
  // 친구 사진 수는 나를 뺀 참여자의 사진 수를 더하고, 본 수는 거기서 남은 수를 뺀다
  const friendPhotos = members.filter((m) => m.id !== me.id).reduce((sum, m) => sum + (m.photoCount ?? 0), 0)
  const pending = myTodo.pendingCirculationCount
  const viewed = Math.max(friendPhotos - pending, 0)

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
        {pending > 0 ? `친구 사진 ${pending}장에 이야기 붙이기` : '친구 사진을 모두 봤어요'}
      </p>
      <p className="text-[11px] leading-4 text-sub">
        {viewed}/{friendPhotos}장 봤어요
      </p>
      {pending > 0 && (
        <Button onClick={() => navigate(paths.roomCirculation(room.id))} className="mt-3 w-full">
          이야기 붙이기
        </Button>
      )}
    </Card>
  )
}

/**
 * 엮을 때가 되면 아래에서 올라오는 알림 시트.
 * - timeUp: 약속한 시간이 다 됐을 때
 * - allDone: 마감 전에 모두가 다 봤을 때 (조기 엮기)
 * 내리면 홈 아래쪽 카드로 같은 내용이 남아 있다
 */
function TimeUpSheet({
  reason = 'timeUp',
  isHost,
  weaving,
  error,
  onWeave,
  onClose,
}: {
  reason?: 'timeUp' | 'allDone'
  isHost: boolean
  weaving: boolean
  error: string | null
  onWeave: () => void
  onClose: () => void
}) {
  const sheetDrag = useSheetDrag(onClose)
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeup-title"
        onClick={(e) => e.stopPropagation()}
        style={sheetDrag.sheetStyle}
        className="flex w-full max-w-[430px] flex-col items-center rounded-t-[28px] bg-surface px-6 pt-3 pb-8 text-center text-ink"
      >
        <div {...sheetDrag.handleProps} className="-my-2 flex w-full justify-center py-2" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="mt-6">
          <ScrollIcon />
        </div>
        <h2 id="timeup-title" className="mt-3 text-[18px] font-bold">
          {reason === 'allDone' ? '모두 다 봤어요' : '약속한 시간이 다 됐어요'}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-sub">
          {reason === 'allDone' ? (
            isHost ? (
              <>
                이제 첫 두루마리를 엮을 수 있어요
                <br />
                지금 바로 엮을 수 있어요
              </>
            ) : (
              <>
                친구들이 모두 다 봤어요
                <br />
                방장이 엮으면 첫 두루마리가 나와요
              </>
            )
          ) : isHost ? (
            <>
              지금까지 모인 이야기로
              <br />첫 두루마리를 엮어 볼까요?
            </>
          ) : (
            <>
              방장이 엮으면
              <br />첫 두루마리가 나와요
            </>
          )}
        </p>
        {error && <p className="mt-2 text-[12px] text-point">{error}</p>}
        {isHost ? (
          <>
            <Button onClick={onWeave} disabled={weaving} className="mt-6 w-full">
              {weaving ? '엮는 중…' : '엮으러 가기'}
            </Button>
            <button type="button" onClick={onClose} className="mt-3 py-1 text-[13px] text-sub active:opacity-80">
              조금 있다가 할게요
            </button>
          </>
        ) : (
          <Button onClick={onClose} className="mt-6 w-full">
            확인
          </Button>
        )}
      </section>
    </div>
  )
}

/** 모임방 홈: 방 상태, 핀 꽃, 받은 질문, 참여현황, 내 할 일 */
function RoomHomePage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [weaving, setWeaving] = useState(false)
  const [weaveError, setWeaveError] = useState<string | null>(null)
  // 모두 다 봤을 때 시트: 들어올 때 한 번, 내리면 아래 카드로만 남는다
  const [allDoneClosed, setAllDoneClosed] = useState(false)
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

  const handleWeave = async () => {
    setWeaving(true)
    setWeaveError(null)
    try {
      const result = await closeRoom(room.id, session.memberAccessToken)
      navigate(paths.roomWeaving(room.id, result.job.id))
    } catch (e) {
      // 마감 시각이 지나 서버가 이미 엮기 시작했으면(409) 엮는 화면으로 간다
      if (e instanceof ApiError && e.status === 409) {
        navigate(paths.roomWeaving(room.id))
        return
      }
      setWeaveError('엮기를 시작하지 못했어요. 다시 시도해 주세요')
      setWeaving(false)
    }
  }

  /** 공유 화면으로 가지 않고 바로 기기 공유창을 연다. 못 열면 글+링크를 복사하고 알려 준다 */
  const handleShareToChat = async () => {
    const text = `${room.name} 두루마리 같이 채우자! 사진 올리고 한마디 남겨줘`
    if (inviteToken) {
      await shareInvite(text)
      return
    }
    const url = siteUrl(paths.roomHome(room.id))
    if (await shareWithDevice(text, url)) return
    await copyForShare(text, url)
  }

  const timeUpSheet =
    room.status === 'CIRCULATING' && home.allCompleted && !allDoneClosed ? (
      <TimeUpSheet
        reason="allDone"
        isHost={me.role === 'HOST'}
        weaving={weaving}
        error={weaveError}
        onWeave={handleWeave}
        onClose={() => setAllDoneClosed(true)}
      />
    ) : null

  // 사진을 모으는 동안 친구들이 다 들어오기 전까지는 친구를 기다리는 화면을 보여준다
  if (room.status === 'COLLECTING' && members.length < (room.capacity ?? ROOM_CAPACITY)) {
    return (
      <>
        <GatheringHome home={home} roomCards={roomCards} inviteToken={inviteToken} datePrompt={<WeaveDatePrompt home={home} token={token ?? ''} onSaved={reloadHome} />} />
        {timeUpSheet}
      </>
    )
  }

  // 돌려보는 중에 모두가 할 일을 마치면 마감을 기다리지 않고 엮을 수 있다
  const readyToWeave = room.status === 'CIRCULATING' && home.allCompleted
  // 두루마리가 완성된 방도 시안처럼 모두 다 본 모양(체크·꽉 찬 막대)으로 보여준다
  const grown = room.status === 'GROWING'
  const allDone = readyToWeave || grown

  return (
    // 내용이 짧으면 내 할 일 카드가 화면 아래에 붙고, 길면 페이지 전체가 함께 스크롤된다
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-16 pb-5">
        <RoomHeader room={room} gathering={false} unreadCount={home.unreadCount} />

        <section className="mt-2.5 px-1.5">
          <h2 className="text-[11px] text-sub">핀 꽃</h2>
          <BranchFlowers roomId={room.id} members={members} cards={roomCards} />
          <p className="mt-1 text-[11px] text-sub">
            {activityTotal(members) === 0 && '아직 핀 꽃이 없어요 · 첫 꽃을 피워 보세요'}
          </p>
        </section>

        {/* 사진을 올린 방이면 상태와 관계없이 내 사진의 장소를 기록 지도에 붙일 수 있다. */}
        {roomCards?.some((card) => card.myResponse.status === 'OWN_PHOTO') && (
          <RecentPhotosCarousel roomId={room.id} token={token ?? ''} version={home} myMemberId={me.id} />
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
              {members.length}/{room.capacity ?? ROOM_CAPACITY}명{allDone && ' 다 봤어요'}
            </p>
          </div>
          <ul className="mt-0.5 flex flex-col gap-2.5">
            {members.map((m) => (
              <MemberProgress key={m.id} member={m} done={allDone} cards={roomCards} />
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-auto px-5 pb-5 [@media(min-height:900px)]:mt-2">
        <WeaveDatePrompt home={home} token={token ?? ''} onSaved={reloadHome} />
        {grown ? (
          <Card className="flex flex-col items-center pt-[22px] pb-5 text-center">
            <ScrollIcon />
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
        ) : readyToWeave ? (
          <Card className="flex flex-col items-center pt-[22px] pb-5 text-center">
            <ScrollIcon />
            <p className="mt-2 text-[15px] font-bold">모두 다 봤어요. 이제 엮을 수 있어요</p>
            {/* 마감 전에 엮기(조기 마감)는 방장만 할 수 있다 */}
            {me.role === 'HOST' ? (
              <>
                <p className="mt-2 text-[11px] text-sub">
                  지금 바로 엮을 수 있어요
                </p>
                {weaveError && <p className="mt-2 text-[11px] text-point">{weaveError}</p>}
                <Button onClick={handleWeave} disabled={weaving} className="mt-3.5 w-full">
                  {weaving ? '엮는 중…' : '엮으러 가기'}
                </Button>
              </>
            ) : (
              <p className="mt-2 text-[11px] text-sub">방장이 엮으면 두루마리가 나와요</p>
            )}
            {/* 엮기 전에 아직 남길 이야기가 있으면 더 덧붙일 수 있다고 알려 준다 */}
            <button
              type="button"
              onClick={() => navigate(paths.roomCirculation(room.id))}
              className="mt-3 py-1 text-[12px] text-sub active:opacity-80"
            >
              아직 남길 이야기가 있나요? <span className="font-semibold text-point">더 덧붙이기 ›</span>
            </button>
          </Card>
        ) : (
          <MyTodoCard home={home} />
        )}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void handleShareToChat()}
            className="flex items-center gap-2 py-0.5 text-[11px] text-sub active:opacity-80"
          >
            <ShareIcon />
            단톡방에 알리기
          </button>
        </div>
      </footer>
      {timeUpSheet}
    </main>
  )
}

export default RoomHomePage
