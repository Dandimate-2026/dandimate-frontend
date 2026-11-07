import { useState } from 'react'
import { ApiError } from '../api/client'
import { updateRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import Button from './Button'
import { latestDeadline } from '../lib/date'

const pad = (n: number) => String(n).padStart(2, '0')
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 오늘로부터 n일 뒤 날짜 */
function daysLater(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dateValue(d)
}

/** "11월 8일 (토) 밤 9:00" */
function describe(at: Date) {
  const h = at.getHours()
  const part = h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${at.getMonth() + 1}월 ${at.getDate()}일 (${DAYS[at.getDay()]}) ${part} ${h12}:${pad(at.getMinutes())}`
}

const QUICK = [
  { label: '오늘', days: 0 },
  { label: '내일', days: 1 },
  { label: '3일 뒤', days: 3 },
  { label: '일주일 뒤', days: 7 },
]
const TIMES = [
  { label: '아침 9시', value: '09:00' },
  { label: '낮 12시', value: '12:00' },
  { label: '저녁 6시', value: '18:00' },
  { label: '밤 9시', value: '21:00' },
]

const INPUT_CLASS = 'mt-2 h-11 w-full rounded-full border border-line bg-bg px-4 text-[14px] outline-none focus:border-ink'

/**
 * 방장에게 "두루마리를 언제 엮을까요?"를 묻는 안내 카드.
 * 홈에는 한 줄 카드만 두고, [정하기]를 누르면 시트에서 날짜·시간을 고른다.
 * 자주 쓰는 날·시간은 눌러서 고르고, [다른 날]·[직접]을 누르면 입력칸이 열려 달력·시계로 고른다.
 * 방을 만든 날로부터 1년 안에서만 고를 수 있다. 방장이 한 번 정하면 더 묻지 않고, 이후 변경은 설정 화면에서 한다.
 */
export default function WeaveDatePrompt({ home, token, onSaved }: { home: RoomHome; token: string; onSaved: () => void }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('21:00')
  // [다른 날]·[직접]을 눌렀을 때만 입력칸을 연다
  const [customDate, setCustomDate] = useState(false)
  const [customTime, setCustomTime] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 화면을 연 시각 기준으로 지난 시각인지 본다 (저장할 때 서버가 한 번 더 확인한다)
  const [now] = useState(() => Date.now())
  // 고르는 칸은 시트로 띄운다. 닫아도 고른 날짜·시간은 그대로 남아서 다시 열면 이어서 고를 수 있다
  const [sheet, setSheet] = useState(false)
  const { room, me } = home

  const open = room.status === 'COLLECTING' || room.status === 'CIRCULATING'
  if (me.role !== 'HOST' || !open || (room.deadlineAt && room.deadlineChangedByHost)) return null

  const latest = latestDeadline(room.createdAt)
  const at = date && time ? new Date(`${date}T${time}`) : null
  const problem = !at
    ? null
    : at.getTime() <= now
      ? '이미 지난 시각이에요. 더 뒤로 골라 주세요'
      : at.getTime() > latest.getTime()
        ? '방을 만든 날로부터 1년 안에서 골라 주세요'
        : null

  const pickDate = (d: string, custom = false) => { setDate(d); setCustomDate(custom); setError(null) }
  const pickTime = (t: string, custom = false) => { setTime(t); setCustomTime(custom); setError(null) }

  const save = async () => {
    if (!at || problem) return
    setSaving(true)
    setError(null)
    try {
      await updateRoom(room.id, { deadlineAt: at.toISOString() }, token)
      setSheet(false)
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 && e.message ? e.message : '정하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const chip = (active: boolean) =>
    `h-9 rounded-full border px-3.5 text-[13px] active:opacity-80 ${active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink'}`

  return (
    <>
      <section className="mb-3 flex items-center gap-3 rounded-[20px] border border-point/30 bg-[#fbeef3] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-point">방장에게만 보여요</p>
          <h2 className="mt-0.5 text-[14px] font-bold">두루마리를 언제 엮을까요?</h2>
          <p className="truncate text-[12px] text-sub">{at && !problem ? `${describe(at)} 고르는 중` : '아직 안 정했어요'}</p>
        </div>
        <button type="button" onClick={() => setSheet(true)} className="h-10 shrink-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface active:opacity-80">
          정하기
        </button>
      </section>

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={() => setSheet(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="weave-date-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] text-ink"
          >
            <span className="mx-auto block h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="mt-3 flex items-start justify-between">
              <h2 id="weave-date-title" className="text-[17px] font-bold">두루마리를 언제 엮을까요?</h2>
              <button type="button" onClick={() => setSheet(false)} aria-label="닫기" className="-mt-1 flex size-9 items-center justify-center text-[22px] text-sub">×</button>
            </div>
            <p className="mt-0.5 text-[12px] leading-[18px] text-sub">그때까지 모인 사진과 이야기로 엮어요. 나중에 설정에서 바꿀 수 있어요</p>

            <p className="mt-3.5 text-[12px] font-semibold">날짜</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK.map((q) => {
                const v = daysLater(q.days)
                return (
                  <button key={q.label} type="button" onClick={() => pickDate(v)} className={chip(!customDate && date === v)}>
                    {q.label}
                  </button>
                )
              })}
              <button type="button" onClick={() => pickDate(date, true)} className={chip(customDate)}>
                다른 날
              </button>
            </div>
            {customDate && (
              <input
                type="date"
                aria-label="엮을 날짜"
                value={date}
                min={dateValue(new Date())}
                max={dateValue(latest)}
                onChange={(e) => pickDate(e.target.value, true)}
                className={INPUT_CLASS}
              />
            )}

            <p className="mt-3 text-[12px] font-semibold">시간</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TIMES.map((t) => (
                <button key={t.value} type="button" onClick={() => pickTime(t.value)} className={chip(!customTime && time === t.value)}>
                  {t.label}
                </button>
              ))}
              <button type="button" onClick={() => pickTime(time, true)} className={chip(customTime)}>
                직접
              </button>
            </div>
            {customTime && (
              <input
                type="time"
                aria-label="엮을 시간"
                value={time}
                onChange={(e) => pickTime(e.target.value, true)}
                className={INPUT_CLASS}
              />
            )}

            <p className={`mt-3.5 rounded-[14px] bg-bg px-3.5 py-2.5 text-[13px] ${problem ? 'text-point' : at ? 'text-ink' : 'text-sub'}`} role="status">
              {problem ?? (at ? <><b>{describe(at)}</b>에 두루마리를 엮어요</> : '날짜를 먼저 골라 주세요')}
            </p>
            {/* 방은 만든 날로부터 1년 뒤 자동으로 지워진다. 그 날 가까이 고르면 더 눈에 띄게 알린다 */}
            <p className={`mt-1.5 px-1 text-[11px] ${at && latest.getTime() - at.getTime() < 30 * 86_400_000 ? 'font-semibold text-point' : 'text-sub'}`}>
              이 방은 {latest.getFullYear()}년 {latest.getMonth() + 1}월 {latest.getDate()}일에 자동으로 지워질 예정이에요
              {at && !problem && latest.getTime() - at.getTime() < 30 * 86_400_000 && ' · 엮고 나서 금방 지워지니 미리 저장해 두세요'}
            </p>
            {error && <p className="mt-1.5 px-2 text-[11px] text-point" role="alert">{error}</p>}
            <Button className="mt-2.5 w-full" disabled={!at || Boolean(problem) || saving} onClick={() => void save()}>
              {saving ? '정하는 중…' : '이때로 정하기'}
            </Button>
          </section>
        </div>
      )}
    </>
  )
}
