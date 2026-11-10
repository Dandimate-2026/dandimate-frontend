import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { MIN_ROOM_CAPACITY, ROOM_CAPACITY } from '../api/rooms'
import Button from '../components/Button'
import Card from '../components/Card'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { formatDateSpaced, todayIsoDate, toLocalDateTimeInput, latestDeadline } from '../lib/date'
import { getRoomDraft, saveRoomDraft } from '../lib/roomDraft'
import { uploadRoomCover } from '../api/roomCovers'
import { getRoomExtras, saveRoomExtras, shrinkImage } from '../lib/roomExtras'
import { paths } from '../routes/paths'
import { LengthNotice } from '../components/LengthNotice'
import { clampText } from '../lib/textLimit'

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
                    (option === ROOM_CAPACITY || option === 1) && (
                      <span className="text-[11px] text-sub">{option === 1 ? '혼자 여행' : '최대'}</span>
                    )
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
  invalid = false,
}: {
  id: string
  value: string
  maxLength: number
  placeholder: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  return (
    <div className="relative">
      <input
        id={id}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(clampText(e.target.value, maxLength))}
        placeholder={placeholder}
        className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-[18px] outline-none placeholder:text-muted focus:border-sub"
      />
      <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
        {value.length}/{maxLength}
      </span>
      <LengthNotice length={value.length} max={maxLength} className="pl-[18px]" />
    </div>
  )
}

function Field({
  htmlFor,
  label,
  hint,
  error,
  children,
}: {
  htmlFor: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="pl-[18px] text-[11px] font-semibold">
        {label}
        {hint && <span className="font-normal text-sub"> · {hint}</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-2 px-3 text-[12px] leading-5 break-keep text-red-700">{error}</p>}
    </div>
  )
}

/** 방장이 모임 이름·날짜·자기 이름을 정해 모임방을 여는 첫 화면 */
function RoomCreatePage() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  // 플랜 화면에서 뒤로 돌아왔으면 입력했던 내용을 다시 채운다
  const [draft] = useState(getRoomDraft)
  const [roomName, setRoomName] = useState(draft?.name ?? '')
  const [meetingDate, setMeetingDate] = useState(draft?.meetingDate ?? todayIsoDate)
  const [deadline, setDeadline] = useState(draft?.deadlineAt ? toLocalDateTimeInput(draft.deadlineAt) : '')
  const [nickname, setNickname] = useState(draft?.hostNickname ?? '')
  const [capacity, setCapacity] = useState(draft?.capacity ?? DEFAULT_CAPACITY)
  const [extras] = useState(getRoomExtras)
  const [coverPhoto, setCoverPhoto] = useState(extras.coverPhoto ?? '')
  // 고르자마자 서버에 올려 두고, 방을 만들 때 이 주소를 같이 보낸다
  const [coverImageUrl, setCoverImageUrl] = useState(draft?.coverImageUrl)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveRoomDraft({ name: roomName, meetingDate, deadlineAt: deadline && Number.isFinite(Date.parse(deadline)) ? new Date(deadline).toISOString() : undefined, hostNickname: nickname, capacity, coverImageUrl })
  }, [roomName, meetingDate, deadline, nickname, capacity, coverImageUrl])

  // 대표 사진은 골라도 안 골라도 된다 (올리는 중이면 끝날 때까지 기다린다)
  const canSubmit =
    roomName.trim().length > 0 && meetingDate !== '' && nickname.trim().length > 0 && !uploadingCover && (!deadline || (Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) > now && Date.parse(deadline) <= latestDeadline(new Date(now).toISOString()).getTime()))

  const handlePhoto = async (file?: File) => {
    if (!file) return
    setPhotoError('')
    let preview: string
    try {
      preview = await shrinkImage(file, 960)
    } catch {
      setPhotoError('사진을 열 수 없어요. 다른 사진을 골라 주세요')
      return
    }
    setCoverPhoto(preview)
    setUploadingCover(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const cover = await uploadRoomCover(blob)
      setCoverImageUrl(cover.imageUrl)
    } catch {
      setCoverImageUrl(undefined)
      setPhotoError('대표 사진을 올리지 못했어요. 다시 골라 주세요')
    } finally {
      setUploadingCover(false)
    }
  }

  // 서버는 방을 만들 때 플랜을 받으므로, 여기서는 입력만 들고 플랜 선택으로 넘어간다. 방은 플랜을 고른 뒤 만든다
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit) {
      const id = !roomName.trim() ? 'room-name' : !meetingDate ? 'meeting-date' : !nickname.trim() ? 'host-nickname' : 'weave-deadline'
      document.getElementById(id)?.focus()
      return
    }
    saveRoomDraft({ name: roomName.trim(), meetingDate, deadlineAt: deadline ? new Date(deadline).toISOString() : undefined, hostNickname: nickname.trim(), capacity, coverImageUrl })
    saveRoomExtras({ coverPhoto: coverPhoto || undefined })
    navigate(paths.roomCreatePlan())
  }

  // 앱 안에서 넘어왔으면 그 화면으로, 주소로 바로 열었으면 방 목록으로 돌아간다
  const goBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (historyIndex > 0) navigate(-1)
    else navigate(paths.roomList(), { replace: true })
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 pt-12 pb-[clamp(24px,6dvh,48px)] text-ink">
      <header className="px-1">
        <button type="button" onClick={goBack} aria-label="뒤로 가기" className="flex h-6 w-6 items-center">
          <ChevronLeftIcon />
        </button>
      </header>
      <button type="button" onClick={() => navigate(`${paths.roomList()}?join=1`)} aria-haspopup="dialog" className="mt-5 flex items-start gap-3 rounded-[20px] border border-line bg-surface px-4 py-3.5 text-left">
        <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-point/10 text-point"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></svg></span>
        <span className="min-w-0"><span className="block text-[13px] font-bold break-keep">초대 링크로 참여하기 ›</span><span className="mt-1 block text-[12px] leading-5 break-keep text-sub">친구에게 받은 초대 링크가 있다면 여기를 눌러 주세요.</span></span>
      </button>
      <section className="mt-[clamp(8px,calc(16dvh_-_48px),76px)] mb-12 px-1.5">
        <h1 className="text-[20px] leading-[24px] font-bold">
          사진에 한마디씩 남기면
          <br />
          우리 이야기가 두루마리로
        </h1>
        <p className="mt-3 text-[11px] text-sub">링크 하나로 친구들과 함께 써요</p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="mt-auto">
        <Card className="pt-5 pb-6">
          <Field htmlFor="room-name" label="모임 이름" error={submitted && !roomName.trim() ? '모임 이름을 입력해 주세요.' : undefined}>
            <CountedInput
              id="room-name"
              value={roomName}
              invalid={submitted && !roomName.trim()}
              maxLength={MAX_ROOM_NAME_LENGTH}
              placeholder="경주 1박 2일"
              onChange={setRoomName}
            />
          </Field>

          <div className="mt-4 space-y-4">
            <Field htmlFor="meeting-date" label="모임 날짜" error={submitted && !meetingDate ? '모임 날짜를 선택해 주세요.' : undefined}>
              {/* 날짜 칸은 시안 모양으로 보여주고, 실제 입력은 위에 투명하게 깐 기본 날짜 선택기로 받는다 */}
              <div className="relative flex h-[52px] items-center justify-between rounded-full border border-line bg-surface pr-4 pl-4 text-[13px]">
                <span className={meetingDate ? '' : 'text-muted'}>
                  {meetingDate ? formatDateSpaced(meetingDate) : '날짜 고르기'}
                </span>
                <CalendarIcon />
                <input
                  id="meeting-date"
                  aria-invalid={submitted && !meetingDate}
                  aria-describedby={submitted && !meetingDate ? 'meeting-date-hint meeting-date-error' : 'meeting-date-hint'}
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
              <p id="meeting-date-hint" className="mt-2 px-3 text-[11px] leading-5 break-keep text-sub">여러 날의 모임은 첫날로 골라 주세요.</p>
            </Field>
            <Field htmlFor="host-nickname" label="내 이름" error={submitted && !nickname.trim() ? '이름을 입력해 주세요.' : undefined}>
              <CountedInput
                id="host-nickname"
                value={nickname}
                invalid={submitted && !nickname.trim()}
                maxLength={MAX_NICKNAME_LENGTH}
                placeholder="서연"
                onChange={setNickname}
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field htmlFor="weave-deadline" label="두루마리 엮는 날" hint="선택 · 나중에 정해도 돼요">
              <input id="weave-deadline" type="datetime-local" value={deadline} min={toLocalDateTimeInput(new Date(now).toISOString())} max={toLocalDateTimeInput(latestDeadline(new Date(now).toISOString()).toISOString())} onChange={event => setDeadline(event.target.value)} className="h-[52px] w-full min-w-0 rounded-2xl border border-line bg-surface px-4 text-[13px]" />
            </Field>
            {deadline && (Date.parse(deadline) <= now || !Number.isFinite(Date.parse(deadline)) || Date.parse(deadline) > latestDeadline(new Date(now).toISOString()).getTime()) && <p id="weave-deadline-error" role="alert" className="mt-2 text-[12px] text-red-700">엮는 날은 지금부터 1년 안의 미래 날짜와 시간으로 정해 주세요.</p>}
          </div>

          <div className="mt-3">
            <Field htmlFor="capacity" label="함께할 인원" hint="나 포함">
              <CapacitySelect id="capacity" value={capacity} onChange={setCapacity} />
            </Field>
          </div>

          <div className="mt-3">
            <Field htmlFor="cover-photo" label="대표 사진" hint="선택">
              <input
                ref={photoInputRef}
                id="cover-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handlePhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className={`flex w-full items-center gap-3.5 rounded-[20px] border bg-surface p-2.5 text-left ${
                  coverPhoto ? 'border-line' : 'border-dashed border-line'
                }`}
              >
                {coverPhoto ? (
                  <img src={coverPhoto} alt="" className="size-[60px] shrink-0 rounded-[14px] object-cover" />
                ) : (
                  <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[14px] bg-bg text-[24px] text-sub">
                    +
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">
                    {coverPhoto ? '대표 사진을 골랐어요' : '앨범에서 고르기'}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-sub">
                    {coverPhoto ? '모임방 목록에 이 사진이 보여요' : '나중에 골라도 괜찮아요'}
                  </span>
                </span>
                {coverPhoto && <span className="pr-1.5 text-[13px] font-semibold text-point">바꾸기 ›</span>}
              </button>
            </Field>
            {photoError && (
              <p className="mt-2 pl-[18px] text-[11px] text-point" role="alert">
                {photoError}
              </p>
            )}
          </div>

          <Button type="submit" disabled={uploadingCover} className="mt-4 w-full">
            모임방 만들기
          </Button>
        </Card>
      </form>

      <p className="mt-4 text-center text-[11px] text-sub">
        만들면{' '}
        <Link to={paths.terms()} className="text-point">
          이용 안내
        </Link>
        에 동의하게 돼요
      </p>

    </main>
  )
}

export default RoomCreatePage
