import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { useNavigate } from 'react-router'
import type { ChatCitation, ChatSource } from '../api/recordMap'
import { getRoomHome } from '../api/rooms'
import type { RoomStatus } from '../api/types'
import { canAsk } from '../api/chatQuota'
import { refreshChatQuota, resetChat, sendChat, useChat, type ChatLine } from '../lib/chatStore'
import { FLOWER_COLOR } from '../lib/flower'
import { getRoomSession, listSavedRoomIds } from '../lib/session'
import { paths } from '../routes/paths'
import { BotIcon, StoreIcon } from './ChatFab'
import Flower from './Flower'

/** 손잡이를 이만큼 아래로 끌면 시트를 내린다 */
const CLOSE_DRAG_PX = 90

const MAX_MESSAGE_LENGTH = 2000
const SUGGESTIONS = ['부산에서 누가 제일 많이 웃었지?', '경주 여행에서 뭐 먹었더라?', '가장 최근 모임은 어땠어?']

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  )
}

/** 두루 프로필: 모임방 목록의 떠 있는 챗봇 버튼과 같은 캐릭터 */
function DuruAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-point"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* 안테나 때문에 아래로 처져 보여서 살짝 올린다 */}
      <span className="flex" style={{ marginTop: -Math.round(size * 0.1) }}>
        <BotIcon size={Math.round(size * 0.72)} />
      </span>
    </span>
  )
}

/** 답의 근거가 된 원문 인용. 쓴 친구의 꽃 색으로 왼쪽 줄을 긋는다 */
function Quote({ citation }: { citation: ChatCitation }) {
  const color = citation.author ? FLOWER_COLOR[citation.author.flowerCode] : '#c9bfb2'
  return (
    <blockquote className="rounded-r-[10px] border-l-[3px] bg-bg px-3 py-2.5" style={{ borderColor: color }}>
      {citation.author && (
        <p className="flex items-center gap-1 text-[11px] text-sub">
          <Flower code={citation.author.flowerCode} size={14} />
          {citation.author.nickname}
        </p>
      )}
      <p className="mt-1 text-[14px] leading-5 font-bold">“{citation.quote}”</p>
    </blockquote>
  )
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/**
 * 답의 근거가 된 사진 카드. 접혀 있을 땐 썸네일·방 이름만, 펼치면 사진을 크게 보여주고
 * 그 사진에 바로 덧붙이거나 모임방으로 갈 수 있다
 */
function SourceCard({ source }: { source: ChatSource }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // 두루마리가 완성된 방이면 덧붙이기 대신 두루마리 보기·답가로 보낸다. 펼칠 때 방 상태를 확인한다
  const [status, setStatus] = useState<RoomStatus | null>(null)
  const room = source.room
  const session = room ? getRoomSession(room.roomId) : null
  useEffect(() => {
    if (!open || status || !room || !session) return
    getRoomHome(room.roomId, session.memberAccessToken)
      .then((home) => setStatus(home.room.status))
      .catch(() => {})
  }, [open, status, room, session])
  if (!room) return null
  // 이 기기에 입장 정보가 있는 방만 열 수 있다
  const canOpen = Boolean(session)
  const completed = status === 'GROWING'
  const photo = source.photo
  const owner = photo?.uploader?.nickname
  const thumb = (className: string) =>
    photo?.imageUrl ? (
      <img src={photo.imageUrl} alt={owner ? `${owner}의 사진` : '사진'} className={`${className} object-cover`} />
    ) : (
      <span className={`${className} bg-gradient-to-br from-[#f2c9b8] to-[#8e6a86]`} aria-hidden="true" />
    )

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 p-2 text-left active:opacity-80"
      >
        {thumb('size-10 shrink-0 rounded-[10px]')}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{room.name}</span>
          <span className="block truncate text-[11px] text-sub">
            {owner ? `${owner}님이 올린 사진` : '이 이야기가 담긴 사진'} · {open ? '접기' : '사진 보기'}
          </span>
        </span>
        <span className="pr-1 text-sub">
          <ChevronDown open={open} />
        </span>
      </button>

      {open && (
        <div className="border-t border-line p-2.5">
          {thumb('block aspect-[4/3] w-full rounded-[12px]')}
          {source.firstEntry?.text && (
            <p className="mt-2 text-[13px] leading-5 text-sub">
              {source.firstEntry.author && (
                <span className="font-semibold text-ink">{source.firstEntry.author.nickname} · </span>
              )}
              {source.firstEntry.text}
            </p>
          )}
          {canOpen ? (
            completed ? (
              // 완성된 방: 두루마리를 보고, 이 사진 문단에 답가를 남긴다
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(paths.roomWeaving(room.roomId))}
                  className="h-10 rounded-full border border-line text-[13px] active:opacity-80"
                >
                  두루마리 보기
                </button>
                {photo ? (
                  <button
                    type="button"
                    onClick={() => navigate(paths.roomScrollReply(room.roomId, photo.photoId))}
                    className="h-10 rounded-full bg-point text-[13px] font-semibold text-surface active:opacity-80"
                  >
                    이 문단에 답가 남기기
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(paths.roomHome(room.roomId))}
                  className="h-10 rounded-full border border-line text-[13px] active:opacity-80"
                >
                  모임방 가기
                </button>
                {photo ? (
                  <button
                    type="button"
                    // 답을 보고 떠오른 이야기를 바로 이 사진에 덧붙인다
                    onClick={() => navigate(paths.roomCirculation(room.roomId, photo.photoId))}
                    className="h-10 rounded-full bg-point text-[13px] font-semibold text-surface active:opacity-80"
                  >
                    이 사진에 덧붙이기
                  </button>
                ) : (
                  <span />
                )}
              </div>
            )
          ) : (
            <p className="mt-2 text-[11px] text-muted">이 기기에서 들어간 방이 아니라 열 수 없어요</p>
          )}
        </div>
      )}
    </div>
  )
}

/** 두루의 답 말풍선: 답 → 원문 인용 → 바로가기 → 출처 안내 */
/** 기록으로 답하지 못한 답(인사·범위 밖·근거 부족) 아래에 붙여, 다음에 물어볼 만한 질문을 보여준다 */
const FOLLOW_UP_OUTCOMES = ['SMALL_TALK', 'OUT_OF_SCOPE', 'INSUFFICIENT', 'INVALID']

function DuruBubble({
  line,
  onAsk,
}: {
  line: ChatLine
  onAsk: (question: string) => void
}) {
  const citations = line.citations ?? []
  // 같은 사진(사진이 없으면 같은 방)이 여러 번 나오면 바로가기는 한 번만 보여준다
  const sourceKey = (s: ChatSource) => s.photo?.photoId ?? s.room?.roomId ?? ''
  const sources = (line.sources ?? []).filter(
    (s, i, all) => s.room && all.findIndex((o) => sourceKey(o) === sourceKey(s)) === i,
  )
  const grounded = citations.length > 0 || sources.length > 0
  return (
    <div className="flex items-start gap-2.5">
      <DuruAvatar />
      <div className="min-w-0 flex-1 rounded-[18px] border border-line bg-surface px-3.5 py-3">
        <p className="text-[15px] leading-6 whitespace-pre-wrap">{line.text}</p>
        {citations.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {citations.map((c, i) => (
              <Quote key={c.entryId ?? i} citation={c} />
            ))}
          </div>
        )}
        {sources.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {sources.map((s) => (
              <SourceCard key={sourceKey(s)} source={s} />
            ))}
          </div>
        )}
        {grounded && <p className="mt-2 text-[11px] text-muted">AI가 원문에서 찾았어요</p>}
        {line.outcome && FOLLOW_UP_OUTCOMES.includes(line.outcome) && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="text-[11px] text-sub">
              {line.outcome === 'SMALL_TALK' ? '이렇게 물어볼 수 있어요' : '이렇게 물어보면 잘 찾아요'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onAsk(q)}
                  className="rounded-full border border-point/40 px-3 py-1.5 text-[12px] text-point active:opacity-70"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** 두루가 답을 찾는 동안의 점 세 개 */
function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5" role="status" aria-label="두루가 답을 찾고 있어요">
      <DuruAvatar />
      <span className="flex h-11 items-center gap-1.5 rounded-[18px] border border-line bg-surface px-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-bounce rounded-full bg-point"
            style={{ animationDelay: `${i * 150}ms`, opacity: 0.5 + i * 0.25 }}
          />
        ))}
      </span>
    </div>
  )
}

/**
 * 두루 챗봇 바텀시트. 내가 참여한 방의 기록을 바탕으로 답한다.
 * 시트를 내려도 대화는 남아 있어서 다시 열면 이어서 물어볼 수 있다
 */
function ChatSheet({ onClose }: { onClose: () => void }) {
  const { lines, sending, quota } = useChat()
  // 상점은 따로 화면으로 연다. 대화는 chatStore에 남아 있어서 돌아오면 이어진다
  const navigate = useNavigate()
  const openStore = () => navigate(paths.store())
  // 시트를 열 때 남은 질문 횟수를 받아 온다
  useEffect(() => {
    void refreshChatQuota()
  }, [])
  const outOfQuestions = !canAsk(quota)
  const [roomCount] = useState(() => listSavedRoomIds().length)
  const [input, setInput] = useState('')
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  // 새 대화 확인 창 (브라우저 기본 알림창 대신 시트 안에 띄운다)
  const [confirmReset, setConfirmReset] = useState(false)
  const dragStart = useRef<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, sending])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 확인 창이 떠 있으면 그것만 닫는다
      if (confirmReset) setConfirmReset(false)
      else onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, confirmReset])

  const send = (text: string) => {
    setInput('')
    void sendChat(text)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  // 위쪽 손잡이·헤더를 아래로 끌어 내리면 닫는다
  const onDragStart = (e: PointerEvent) => {
    dragStart.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: PointerEvent) => {
    if (dragStart.current === null) return
    setDragY(Math.max(0, e.clientY - dragStart.current))
  }
  const onDragEnd = () => {
    if (dragStart.current === null) return
    dragStart.current = null
    setDragging(false)
    if (dragY > CLOSE_DRAG_PX) onClose()
    setDragY(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="두루에게 물어보기"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : 'transform 0.2s' }}
        className="relative mx-auto flex h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-bg text-ink"
      >
      <header
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="touch-none border-b border-line bg-surface px-5 pt-2.5 pb-3.5"
      >
        <span className="mx-auto block h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <div className="mt-3 flex items-center gap-3">
          <DuruAvatar size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold">두루</h2>
            <p className="text-[12px] text-sub">
              {roomCount > 0 ? `내 모임방 ${roomCount}곳의 이야기를 기억해요` : '내 모임방의 이야기를 기억해요'}
            </p>
          </div>
          {/* 상점: 크레딧을 사서 더 물어본다 */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openStore}
            aria-label="상점"
            className="flex size-9 items-center justify-center rounded-full border border-line text-ink active:opacity-70"
          >
            <StoreIcon />
          </button>
          {/* 지난 대화를 지우고 처음부터 다시 묻는다 */}
          {lines.length > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setConfirmReset(true)}
              disabled={sending}
              className="rounded-full border border-line px-3 py-1.5 text-[12px] text-sub active:opacity-70 disabled:opacity-40"
            >
              새 대화
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="닫기 (대화는 남아 있어요)"
            className="p-1 text-sub active:opacity-70"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {lines.length === 0 && (
          <div className="pt-6">
            <p className="text-[20px] leading-7 font-bold">
              우리 추억,
              <br />
              뭐든 물어보세요
            </p>
            <p className="mt-2 text-[12px] text-sub">내가 함께한 모임방의 이야기로 답해요</p>
            <ul className="mt-5 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] active:opacity-80"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="flex flex-col gap-3.5">
          {lines.map((line, i) =>
            line.from === 'me' ? (
              <li key={i} className="flex justify-end">
                <p className="max-w-[80%] rounded-[20px] bg-ink px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap text-surface">
                  {line.text}
                </p>
              </li>
            ) : (
              <li key={i}>
                <DuruBubble line={line} onAsk={send} />
              </li>
            ),
          )}
          {sending && (
            <li>
              <TypingBubble />
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-surface pb-[max(14px,env(safe-area-inset-bottom))]">
        {outOfQuestions ? (
          // 무료도 크레딧도 다 썼을 때: 입력창 대신 안내. 상점을 강조하되, 내일 다시 올 수 있다고도 알려 준다
          <div className="mx-4 mt-3 rounded-[20px] bg-bg px-4 pt-4 pb-3.5 text-center">
            <p className="text-[15px] font-bold">오늘 물어볼 수 있는 횟수를 다 썼어요</p>
            <p className="mt-1.5 text-[12px] leading-5 text-sub">
              내일 0시에 다시 {quota?.freeLimit ?? 4}번이 생겨요.
              <br />
              지금 더 물어보려면 상점에서 구매할 수 있어요.
            </p>
            <button
              type="button"
              onClick={openStore}
              className="mt-3.5 h-12 w-full rounded-full bg-point text-[15px] font-semibold text-surface active:opacity-80"
            >
              <span className="inline-flex items-center gap-1.5">
                <StoreIcon size={17} />
                상점에서 구매하기
              </span>
            </button>
            <button type="button" onClick={onClose} className="mt-2 py-1 text-[12px] text-sub active:opacity-70">
              내일 다시 올게요
            </button>
          </div>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 pt-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="추억에 대해 물어보세요"
            aria-label="두루에게 보낼 말"
            className="h-12 min-w-0 flex-1 rounded-full bg-bg px-5 text-[15px] outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="보내기"
            disabled={!input.trim() || sending}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-surface active:opacity-80 disabled:opacity-30"
          >
            <ArrowIcon />
          </button>
        </form>
        )}
        {/* 보내기 아래: 오늘 남은 무료 질문 · 남은 크레딧 */}
        {quota && (
          <p className="mt-2 text-center text-[11px] text-sub">
            오늘의 남은 횟수 <b className="font-semibold text-ink">{quota.freeRemaining}/{quota.freeLimit}</b>
            <span className="mx-1.5 text-line">|</span>
            남은 크레딧 <b className="font-semibold text-ink">{quota.credits}</b>
          </p>
        )}
      </div>
        {confirmReset && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-ink/40 px-8"
            onClick={() => setConfirmReset(false)}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-title"
              aria-describedby="reset-desc"
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-[24px] bg-surface px-5 pt-6 pb-5 text-center"
            >
              <h3 id="reset-title" className="text-[16px] font-bold">
                새 대화를 시작할까요?
              </h3>
              <p id="reset-desc" className="mt-2 text-[13px] leading-5 text-sub">
                지금까지 나눈 대화는 지워져요.
                <br />
                모임방의 기록은 그대로 남아 있어요.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmReset(false)}
                  className="h-12 rounded-full border border-line bg-surface text-[15px] font-semibold active:opacity-80"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetChat()
                    setConfirmReset(false)
                  }}
                  className="h-12 rounded-full bg-ink text-[15px] font-semibold text-surface active:opacity-80"
                >
                  새로 시작
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default ChatSheet
