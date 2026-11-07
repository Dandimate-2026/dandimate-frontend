import { useState } from 'react'
import { ApiError } from '../api/client'
import { updateRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import Button from './Button'

/** 오늘(현지 시각) 날짜를 input[type=date] 값으로 */
function todayValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 방장에게 "두루마리를 언제 엮을까요?"를 묻는 안내 카드.
 * 날짜만 고르면 그날 밤 11시 59분에 엮이도록 마감 시각을 정한다.
 * 방장이 한 번 정하면(deadlineChangedByHost) 더 묻지 않는다. 이후 변경은 설정 화면에서 한다.
 */
export default function WeaveDatePrompt({ home, token, onSaved }: { home: RoomHome; token: string; onSaved: () => void }) {
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { room, me } = home

  const open = room.status === 'COLLECTING' || room.status === 'CIRCULATING'
  if (me.role !== 'HOST' || !open || (room.deadlineAt && room.deadlineChangedByHost)) return null

  const save = async () => {
    if (!date) return
    const deadline = new Date(`${date}T23:59:00`)
    if (deadline.getTime() <= Date.now()) {
      setError('오늘 이후 날짜를 골라 주세요')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateRoom(room.id, { deadlineAt: deadline.toISOString() }, token)
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 && e.message ? e.message : '정하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-3 rounded-[20px] border border-point/30 bg-[#fbeef3] px-5 pt-4 pb-5">
      <p className="text-[11px] font-semibold text-point">방장에게만 보여요</p>
      <h2 className="mt-1 text-[15px] font-bold">두루마리를 언제 엮을까요?</h2>
      <p className="mt-1 text-[12px] leading-[18px] text-sub">고른 날 밤까지 모인 사진과 이야기로 두루마리를 엮어요. 설정에서 언제든 바꿀 수 있어요</p>
      <label className="mt-3 block">
        <span className="sr-only">엮을 날짜</span>
        <input
          type="date"
          value={date}
          min={todayValue()}
          onChange={(e) => { setDate(e.target.value); setError(null) }}
          className="h-[48px] w-full rounded-full border border-line bg-surface px-5 text-[14px] outline-none focus:border-ink"
        />
      </label>
      {error && <p className="mt-1.5 px-2 text-[11px] text-point" role="alert">{error}</p>}
      <Button className="mt-2.5 w-full" disabled={!date || saving} onClick={() => void save()}>
        {saving ? '정하는 중…' : '이 날로 정하기'}
      </Button>
    </section>
  )
}
