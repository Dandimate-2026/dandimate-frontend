import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { createRoom, MIN_ROOM_CAPACITY, ROOM_CAPACITY } from '../api/rooms'
import Button from '../components/Button'
import Card from '../components/Card'
import { formatDateSpaced, todayIsoDate } from '../lib/date'
import { saveRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

const MAX_ROOM_NAME_LENGTH = 20
const MAX_NICKNAME_LENGTH = 10
const DEFAULT_CAPACITY = 4
const CAPACITY_OPTIONS = Array.from(
  { length: ROOM_CAPACITY - MIN_ROOM_CAPACITY + 1 },
  (_, i) => MIN_ROOM_CAPACITY + i,
)

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={open ? 'rotate-180' : ''}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  )
}

/** 함께할 인원을 고르는 드롭다운. 목록은 버튼 위로 펼쳐진다 */
function CapacitySelect({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-[52px] w-full items-center justify-between rounded-full border bg-surface pr-4 pl-[18px] ${
          open ? 'border-ink' : 'border-line'
        }`}
      >
        <span>{value}명</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute right-0 bottom-full left-0 z-10 mb-2 rounded-[20px] border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(42,38,35,0.12)]"
        >
          {CAPACITY_OPTIONS.map((option) => {
            const selected = option === value
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={`flex h-10 w-full items-center justify-between rounded-[14px] px-3 text-left ${
                    selected ? 'bg-point/15 font-semibold text-point' : ''
                  }`}
                >
                  <span>{option}명</span>
                  {selected ? (
                    <CheckIcon />
                  ) : (
                    option === ROOM_CAPACITY && <span className="text-[11px] text-sub">최대</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.33"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.33" y="2.67" width="13.33" height="12" rx="2.67" />
      <path d="M5.33 1.33V4M10.67 1.33V4M1.33 6.67h13.33" />
    </svg>
  )
}

/** 글자 수가 오른쪽에 붙는 둥근 입력칸 */
function CountedInput({
  id,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string
  value: string
  maxLength: number
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-[18px] outline-none placeholder:text-muted focus:border-sub"
      />
      <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
        {value.length}/{maxLength}
      </span>
    </div>
  )
}

function Field({ htmlFor, label, children }: { htmlFor: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="pl-[18px] text-[11px] font-semibold">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** 방장이 모임 이름·날짜·자기 이름을 정해 모임방을 여는 첫 화면 */
function RoomCreatePage() {
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [meetingDate, setMeetingDate] = useState(todayIsoDate)
  const [nickname, setNickname] = useState('')
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = roomName.trim().length > 0 && meetingDate !== '' && nickname.trim().length > 0 && !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      // TODO: 유료 플랜은 서버 결제 검증이 붙기 전까지 만들 수 없어(503), 우선 FREE로 만들고 플랜 화면에서 고르게 둔다
      const { room, inviteToken } = await createRoom({
        name: roomName.trim(),
        meetingDate,
        hostNickname: nickname.trim(),
        planType: 'FREE',
        capacity,
      })
      saveRoomSession(room.id, { memberAccessToken: '', inviteToken, roomName: room.name })
      navigate(paths.roomPlan(room.id), { replace: true })
    } catch {
      setError('모임방을 만들지 못했어요. 다시 시도해 주세요')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 pt-[clamp(32px,16dvh,124px)] pb-[clamp(24px,6dvh,48px)] text-ink">
      <section className="mb-12 px-1.5">
        <h1 className="text-[20px] leading-[24px] font-bold">
          사진에 한마디씩 남기면
          <br />
          우리 이야기가 두루마리로
        </h1>
        <p className="mt-3 text-[11px] text-sub">링크 하나로 친구들과 함께 써요</p>
      </section>

      <form onSubmit={handleSubmit} className="mt-auto">
        <Card className="pt-5 pb-6">
          <Field htmlFor="room-name" label="모임 이름">
            <CountedInput
              id="room-name"
              value={roomName}
              maxLength={MAX_ROOM_NAME_LENGTH}
              placeholder="경주 1박 2일"
              onChange={setRoomName}
            />
          </Field>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field htmlFor="meeting-date" label="모임 날짜">
              {/* 날짜 칸은 시안 모양으로 보여주고, 실제 입력은 위에 투명하게 깐 기본 날짜 선택기로 받는다 */}
              <div className="relative flex h-[52px] items-center justify-between rounded-full border border-line bg-surface pr-4 pl-4 text-[13px]">
                <span className={meetingDate ? '' : 'text-muted'}>
                  {meetingDate ? formatDateSpaced(meetingDate) : '날짜 고르기'}
                </span>
                <CalendarIcon />
                <input
                  id="meeting-date"
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker()
                    } catch {
                      // showPicker를 지원하지 않는 브라우저는 기본 동작에 맡긴다
                    }
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </div>
            </Field>
            <Field htmlFor="host-nickname" label="내 이름">
              <CountedInput
                id="host-nickname"
                value={nickname}
                maxLength={MAX_NICKNAME_LENGTH}
                placeholder="서연"
                onChange={setNickname}
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field htmlFor="capacity" label="함께할 인원">
              <CapacitySelect id="capacity" value={capacity} onChange={setCapacity} />
            </Field>
            <p className="mt-2 pl-[18px] text-[11px] text-sub">나를 포함해 최대 {ROOM_CAPACITY}명까지 들어올 수 있어요</p>
          </div>

          {error && <p className="mt-2 text-[12px] text-point">{error}</p>}
          <Button type="submit" disabled={!canSubmit} className="mt-4 w-full">
            {submitting ? '만드는 중…' : '모임방 만들기'}
          </Button>
        </Card>
      </form>

      <p className="mt-4 text-center text-[11px] text-sub">
        만들면{' '}
        <Link to={paths.terms()} className="text-point">
          이용 안내
        </Link>
        에 동의하게 돼요 · 48시간 뒤 첫 두루마리
      </p>
    </main>
  )
}

export default RoomCreatePage
