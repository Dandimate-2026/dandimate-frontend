import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getRoomHome } from '../api/rooms'
import type { Member, RoomHome, RoomStatus } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import { SparkleIcon } from '../components/entry/EntryIcons'
import Flower from '../components/Flower'
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

function ShareIcon() {
  // 시안 SVG 좌표 그대로 사용
  return (
    <svg width="12" height="12" viewBox="126 696 12 12" fill="currentColor" aria-hidden="true">
      <path d="M128.208 704.042C128.832 704.042 129.387 703.75 129.766 703.307L133.773 705.564C133.767 705.64 133.75 705.716 133.75 705.792C133.75 706.918 134.666 707.833 135.792 707.833C136.917 707.833 137.833 706.918 137.833 705.792C137.833 704.666 136.917 703.75 135.792 703.75C135.167 703.75 134.613 704.042 134.234 704.485L130.227 702.228C130.232 702.152 130.25 702.076 130.25 702C130.25 701.924 130.238 701.848 130.227 701.773L134.234 699.515C134.607 699.958 135.162 700.25 135.792 700.25C136.917 700.25 137.833 699.334 137.833 698.208C137.833 697.083 136.917 696.167 135.792 696.167C134.666 696.167 133.75 697.083 133.75 698.208C133.75 698.284 133.762 698.36 133.773 698.436L129.766 700.693C129.576 700.464 129.338 700.28 129.069 700.153C128.8 700.026 128.506 699.959 128.208 699.958C127.082 699.958 126.167 700.874 126.167 702C126.167 703.126 127.082 704.042 128.208 704.042ZM135.792 704.917C136.276 704.917 136.667 705.308 136.667 705.792C136.667 706.276 136.276 706.667 135.792 706.667C135.307 706.667 134.917 706.276 134.917 705.792C134.917 705.308 135.307 704.917 135.792 704.917ZM135.792 697.333C136.276 697.333 136.667 697.724 136.667 698.208C136.667 698.693 136.276 699.083 135.792 699.083C135.307 699.083 134.917 698.693 134.917 698.208C134.917 697.724 135.307 697.333 135.792 697.333ZM128.208 701.125C128.692 701.125 129.083 701.516 129.083 702C129.083 702.484 128.692 702.875 128.208 702.875C127.724 702.875 127.333 702.484 127.333 702C127.333 701.516 127.724 701.125 128.208 701.125Z" />
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

  const { room, me, members, todayFlowers, myTodo } = home

  return (
    // 내용이 짧으면 내 할 일 카드가 화면 아래에 붙고, 길면 페이지 전체가 함께 스크롤된다
    <main className="flex min-h-dvh flex-col bg-bg text-ink">
      <div className="px-5 pt-16 pb-6">
        <header className="px-1">
          {/* TODO: 뒤로 가기 목적지 확정 필요. 지금은 브라우저 히스토리 기준이라
            입장 화면으로 돌아가거나, 링크로 바로 들어온 경우 사이트를 벗어날 수 있음 */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2.5 text-[16px] font-bold"
          >
            <ChevronLeftIcon />
            {room.name}
          </button>
          <div className="mt-3.5 flex items-center gap-2.5">
            <span className="rounded-full bg-[#f6e3ea] px-3 py-0.5 text-[9px] text-point">
              {STATUS_LABEL[room.status]}
            </span>
            <span className="text-[11px] text-sub">{deadlineText(room.deadlineAt)}</span>
          </div>
        </header>

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
