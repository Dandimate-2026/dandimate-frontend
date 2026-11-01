import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getRoomHome, ROOM_CAPACITY } from '../api/rooms'
import type { Member, RoomHome, RoomStatus, RoomSummary } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import { SparkleIcon } from '../components/entry/EntryIcons'
import Flower, { EmptySlot } from '../components/Flower'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { useInviteShare } from '../hooks/useInviteShare'
import { FLOWER_COLOR } from '../lib/flower'
import { getRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'

const STATUS_LABEL: Record<RoomStatus, string> = {
  COLLECTING: '모으는 중',
  CIRCULATING: '돌려보는 중',
  WEAVING: '엮는 중',
  GROWING: '자라는 중',
}

/** 마감까지 남은 시간 안내 문구 */
function deadlineText(deadlineAt: string) {
  const hours = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / (60 * 60 * 1000))
  return hours > 0 ? `첫 두루마리까지 ${hours}시간` : '곧 첫 두루마리가 나와요'
}

/** 내 할 일 카드 문구 */
function todoText({ myTodo, allCompleted }: RoomHome) {
  if (allCompleted) return '오늘 할 일을 모두 마쳤어요'
  if (myTodo.needsFirstEntry) return '내 사진에 첫 한마디 남기기'
  if (myTodo.pendingCirculationCount > 0) return `친구 사진 ${myTodo.pendingCirculationCount}장에 이야기 붙이기`
  return '친구들의 이야기를 기다리는 중이에요'
}

function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 참여현황 한 줄: 꽃 + 이름, 사진/이야기 수, 참여율 막대 */
function MemberProgress({ member }: { member: Member }) {
  const rate = Math.min(Math.max(member.responseRate ?? 0, 0), 1)
  return (
    <li>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px]">
          <Flower code={member.flowerCode} size={21} />
          {member.nickname}
          {member.role === 'HOST' && ' · 방장'}
        </span>
        <span className="text-[11px] text-sub">
          사진 {member.photoCount ?? 0}장 · 이야기 {member.storyCount ?? 0}개
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${rate * 100}%`, backgroundColor: FLOWER_COLOR[member.flowerCode] }}
        />
      </div>
    </li>
  )
}

/** 방 이름(뒤로 가기), 상태, 마감까지 남은 시간 */
function RoomHeader({ room, gathering }: { room: RoomSummary; gathering: boolean }) {
  const navigate = useNavigate()
  return (
    <header className="px-1">
      {/* TODO: 뒤로 가기 목적지 확정 필요. 지금은 브라우저 히스토리 기준이라
        입장 화면으로 돌아가거나, 링크로 바로 들어온 경우 사이트를 벗어날 수 있음 */}
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2.5 text-[16px] font-bold">
        <ChevronLeftIcon />
        {room.name}
      </button>
      <div className="mt-3.5 flex items-center gap-2.5">
        <span
          className={`rounded-full px-3 py-0.5 text-[9px] ${gathering ? 'bg-[#efe9df] text-[#6b6b6b]' : 'bg-[#f6e3ea] text-point'}`}
        >
          {STATUS_LABEL[room.status]}
        </span>
        <span className="text-[11px] text-sub">{deadlineText(room.deadlineAt)}</span>
      </div>
    </header>
  )
}

// 친구를 기다리는 동안 보여줄 빈 자리 수
const EMPTY_TODAY_SLOTS = 5
const EMPTY_MEMBER_SLOTS = 2

const SHARE_BUTTON_CLASS =
  'flex h-[57px] items-center justify-center gap-1.5 rounded-[20px] border border-line bg-surface text-[13px] text-sub active:opacity-80'

/** 방이 열리고 친구들이 다 모이기 전: 초대 링크 공유와 내 첫 사진 올리기 */
function GatheringHome({ home, inviteToken }: { home: RoomHome; inviteToken?: string }) {
  const navigate = useNavigate()
  const { room, members, todayFlowers, myTodo } = home
  const { copied, copy, share } = useInviteShare(inviteToken ?? '')
  const emptyMemberSlots = Math.min(EMPTY_MEMBER_SLOTS, ROOM_CAPACITY - members.length)
  const memberNames = members.map((m) => (m.role === 'HOST' ? `${m.nickname} · 방장` : m.nickname)).join(', ')

  return (
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-[clamp(40px,8dvh,64px)] pb-6">
        <RoomHeader room={room} gathering />

        <section className="mt-3.5 px-1.5">
          <h2 className="text-[11px] text-sub">오늘 핀 꽃</h2>
          <ul className="mt-2 flex flex-wrap gap-[5px]">
            {todayFlowers.length > 0
              ? todayFlowers.map((f, i) => (
                  <li key={`${f.memberId}-${i}`}>
                    <Flower code={f.flowerCode} />
                  </li>
                ))
              : Array.from({ length: EMPTY_TODAY_SLOTS }, (_, i) => (
                  <li key={i}>
                    <EmptySlot />
                  </li>
                ))}
          </ul>
          <p className="mt-2 text-[11px] text-sub">
            {todayFlowers.length > 0
              ? `이야기 ${todayFlowers.length}개 · 친구가 오면 꽃이 더해져요`
              : '아직 핀 꽃이 없어요 · 첫 꽃을 피워 보세요'}
          </p>
        </section>

        <Card className="mt-5 px-[23px] pt-3.5 pb-[15px]">
          <div className="flex items-center justify-between px-[3px] text-[11px]">
            <p className="text-sub">친구를 기다리고 있어요</p>
            <p>
              {members.length}/{ROOM_CAPACITY}명
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
          {/* 원본 초대 토큰은 방장만 갖고 있어서, 방장에게만 공유 버튼을 보여준다 */}
          {inviteToken && (
            <div className="mt-2.5 grid grid-cols-2 gap-[15px]">
              <button type="button" onClick={() => copy()} className={SHARE_BUTTON_CLASS}>
                <CopyIcon />
                {copied ? '복사됨' : '링크복사'}
              </button>
              <button type="button" onClick={() => share()} className={SHARE_BUTTON_CLASS}>
                <ShareIcon />
                단톡방에 보내기
              </button>
            </div>
          )}
        </Card>
      </div>

      <footer className="mt-auto px-5 pt-3 pb-6">
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
        </Card>
      </footer>
    </main>
  )
}

/** 모임방 홈: 방 상태, 오늘 핀 꽃, 받은 질문, 참여현황, 내 할 일 */
function RoomHomePage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    getRoomHome(roomId, session.memberAccessToken)
      .then(setHome)
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError && e.status === 403 ? '이 방에 들어갈 수 없어요' : '방 정보를 불러오지 못했어요',
        ),
      )
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (error) return <NotFoundPage message={error} />
  if (!home) return <main className="flex-1 bg-bg" aria-busy="true" />

  // 사진을 모으는 동안 친구들이 다 들어오기 전까지는 친구를 기다리는 화면을 보여준다
  if (home.room.status === 'COLLECTING' && home.members.length < ROOM_CAPACITY) {
    return <GatheringHome home={home} inviteToken={session.inviteToken} />
  }

  const { room, me, members, todayFlowers, myTodo } = home

  return (
    // 내용이 짧으면 내 할 일 카드가 화면 아래에 붙고, 길면 페이지 전체가 함께 스크롤된다
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-16 pb-6">
        <RoomHeader room={room} gathering={false} />

        <section className="mt-5 px-1.5">
          <h2 className="text-[11px] text-sub">오늘 핀 꽃</h2>
          <ul className="mt-2.5 flex flex-wrap gap-0.5">
            {todayFlowers.map((f, i) => (
              <li key={`${f.memberId}-${i}`}>
                <Flower code={f.flowerCode} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-sub">이야기 {todayFlowers.length}개 · 친구가 오면 꽃이 더해져요</p>
        </section>

        {myTodo.topAskback && (
          <section className="mt-5 rounded-xl bg-[#f6e3ea] px-3.5 py-4">
            <p className="flex items-center gap-1.5 text-[11px] text-point">
              <SparkleIcon />
              {me.nickname}님에게 질문이 왔어요
            </p>
            <p className="mt-2.5 text-[16px] font-bold">“{myTodo.topAskback.question}”</p>
            <Button
              variant="outline"
              onClick={() => myTodo.topAskback && navigate(paths.askback(room.id, myTodo.topAskback.id))}
              className="mt-3 rounded-full border-ink px-4 py-2.5 text-[13px]"
            >
              한 문장만 답하기
            </Button>
          </section>
        )}

        <section className="mt-7">
          <h2 className="px-0.5 text-[11px] text-sub">참여현황</h2>
          <ul className="mt-3 flex flex-col gap-4">
            {members.map((m) => (
              <MemberProgress key={m.id} member={m} />
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-auto px-5 pt-3 pb-6">
        <Card className="px-[26px] pt-5 pb-6">
          <p className="text-[11px] text-sub">내 할 일</p>
          <p className="mt-1.5 text-[15px] font-bold">{todoText(home)}</p>
          {/* TODO: 돌려보기 화면 연결 */}
          <Button
            onClick={() => navigate(paths.roomCirculation(room.id))}
            disabled={home.allCompleted}
            className="mt-4 w-full"
          >
            이어서 하기
          </Button>
        </Card>
        <div className="mt-4 flex justify-center">
          <Button
            variant="text"
            onClick={() => navigate(paths.roomShare(room.id))}
            className="flex h-auto items-center gap-2 text-[11px] font-normal text-sub"
          >
            <ShareIcon />
            단톡방에 알리기
          </Button>
        </div>
      </footer>
    </main>
  )
}

export default RoomHomePage
