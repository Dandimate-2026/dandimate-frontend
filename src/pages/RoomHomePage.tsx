import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getRoomHome } from '../api/rooms'
import type { Member, RoomHome, RoomStatus } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
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

function SparkleIcon() {
  // 시안 SVG 좌표 그대로 사용
  return (
    <svg width="12" height="12" viewBox="35 232 12 12" fill="currentColor" aria-hidden="true">
      <path d="M38.465 239.83C38.6211 239.942 38.8081 240.001 39 240.001C39.1919 240.001 39.3789 239.942 39.535 239.83C39.6911 239.713 39.8096 239.553 39.876 239.37L40.223 238.303C40.3064 238.052 40.4472 237.823 40.6344 237.636C40.8215 237.449 41.0498 237.308 41.301 237.225L42.387 236.871C42.5691 236.806 42.7261 236.685 42.8358 236.525C42.9455 236.366 43.0023 236.176 42.9982 235.983C42.9941 235.789 42.9293 235.602 42.813 235.447C42.6967 235.293 42.5347 235.179 42.35 235.121L41.281 234.775C41.0294 234.692 40.8008 234.551 40.6133 234.364C40.4257 234.177 40.2846 233.948 40.201 233.697L39.848 232.613C39.7839 232.434 39.666 232.279 39.5104 232.17C39.3548 232.061 39.1691 232.002 38.979 232.003C38.7862 232.002 38.5979 232.062 38.4409 232.174C38.2839 232.286 38.166 232.444 38.104 232.627L37.748 233.717C37.6644 233.961 37.5267 234.183 37.3452 234.366C37.1637 234.549 36.9432 234.689 36.7 234.775L35.616 235.126C35.4349 235.19 35.2783 235.309 35.168 235.466C35.0577 235.623 34.9991 235.811 35.0006 236.003C35.002 236.195 35.0633 236.382 35.176 236.538C35.2886 236.693 35.447 236.81 35.629 236.871L36.696 237.218C36.9479 237.302 37.1768 237.444 37.3644 237.632C37.552 237.82 37.6933 238.049 37.777 238.301L38.129 239.381C38.1918 239.562 38.3086 239.719 38.465 239.83ZM43.536 243.851C43.6715 243.947 43.8337 243.999 44 243.999C44.1679 243.997 44.3312 243.943 44.4671 243.845C44.6031 243.746 44.7051 243.608 44.759 243.449L45.007 242.688C45.0607 242.53 45.1499 242.386 45.2678 242.268C45.3857 242.15 45.5291 242.061 45.687 242.007L46.459 241.755C46.6183 241.7 46.7562 241.596 46.853 241.458C46.9497 241.32 47.0005 241.155 46.9979 240.987C46.9954 240.818 46.9397 240.655 46.8388 240.52C46.7378 240.385 46.5969 240.285 46.436 240.235L45.672 239.985C45.514 239.932 45.3705 239.843 45.2525 239.726C45.1345 239.608 45.0454 239.465 44.992 239.307L44.74 238.533C44.6858 238.374 44.5829 238.236 44.446 238.139C44.309 238.042 44.145 237.99 43.977 237.991C43.8091 237.992 43.6458 238.046 43.5103 238.146C43.3748 238.245 43.2739 238.384 43.222 238.544L42.975 239.306C42.9241 239.463 42.8376 239.605 42.7225 239.723C42.6073 239.841 42.4665 239.931 42.311 239.985L41.535 240.238C41.4174 240.279 41.3109 240.346 41.224 240.436C41.1372 240.525 41.0723 240.633 41.0347 240.752C40.997 240.87 40.9875 240.996 41.007 241.119C41.0265 241.242 41.0745 241.359 41.147 241.46C41.246 241.6 41.386 241.704 41.547 241.76L42.31 242.007C42.4693 242.059 42.6139 242.148 42.7321 242.267C42.8503 242.385 42.9387 242.53 42.99 242.69L43.243 243.464C43.298 243.62 43.4 243.755 43.535 243.851" />
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
    // 위쪽 내용은 스크롤되고, 내 할 일 카드는 화면 아래에 고정한다 (멤버 수에 따라 내용 길이가 달라짐)
    <main className="flex h-dvh flex-col bg-bg text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-16 pb-6">
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
            {/* TODO: 되묻기 답변 화면 연결 */}
            <Button
              variant="outline"
              onClick={() => myTodo.topAskback && navigate(paths.askback(myTodo.topAskback.id))}
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

      <footer className="shrink-0 px-5 pt-3 pb-6">
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
