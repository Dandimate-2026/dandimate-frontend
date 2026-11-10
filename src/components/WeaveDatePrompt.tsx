import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { getRoomHome, updateRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import Button from './Button'
import { latestDeadline, toLocalDateTimeInput } from '../lib/date'
import EarlyCloseButton from './EarlyCloseButton'

function describe(at: Date) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(at)
}

export default function WeaveDatePrompt({ home, token, onSaved }: { home: RoomHome; token: string; onSaved: () => void }) {
  const { room, me } = home
  const draftKey = `duruduru:weave-date:${room.id}:${me.id}`
  const serverDeadline = room.deadlineChangedByHost ? room.deadlineAt ?? '' : ''
  const [selection, setSelection] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as { value?: unknown; base?: unknown } | null
      if (saved && saved.base === serverDeadline && typeof saved.value === 'string') return { value: saved.value, base: serverDeadline }
    } catch { /* optional draft */ }
    return { value: serverDeadline ? toLocalDateTimeInput(serverDeadline) : '', base: serverDeadline }
  })
  const deadline = selection.base === serverDeadline ? selection.value : serverDeadline ? toLocalDateTimeInput(serverDeadline) : ''
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(false)
  const [options, setOptions] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const optionsDialog = useRef<HTMLDialogElement>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify({ value: deadline, base: serverDeadline })) } catch { /* optional draft */ } }, [draftKey, deadline, serverDeadline])
  useEffect(() => {
    const element = sheet ? dialog.current : options ? optionsDialog.current : null
    if (!element) return
    const previous = document.activeElement as HTMLElement | null
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [sheet, options])
  const decided = room.deadlineAt && room.deadlineChangedByHost ? new Date(room.deadlineAt) : null
  const latest = latestDeadline(room.createdAt)
  const at = deadline ? new Date(deadline) : null
  const problem = at && (!Number.isFinite(at.getTime()) || at.getTime() <= now || at.getTime() > latest.getTime()) ? '지금보다 뒤, 방을 만든 날로부터 1년 안의 날짜와 시간을 골라 주세요.' : ''
  async function save() {
    if (!at || problem || savingRef.current) return
    if (at.getTime() <= new Date().getTime()) { setError('이미 지난 시각이에요. 더 뒤로 골라 주세요.'); return }
    savingRef.current = true; setSaving(true); setError('')
    try {
      const current = await getRoomHome(room.id, token)
      const currentDeadline = current.room.deadlineChangedByHost ? current.room.deadlineAt ?? '' : ''
      if (currentDeadline !== serverDeadline) {
        setError('다른 곳에서 예약이 변경됐어요. 최신 날짜와 시간을 확인한 뒤 다시 저장해 주세요.')
        onSaved()
        return
      }
      await updateRoom(room.id, { deadlineAt: at.toISOString() }, token)
      setSelection({ value: deadline, base: at.toISOString() })
      setSheet(false); onSaved()
    } catch (cause) { setError(cause instanceof ApiError && cause.status < 500 ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  if (!['COLLECTING', 'CIRCULATING'].includes(room.status) || (me.role !== 'HOST' && !decided)) return null
  return <>
    <section className="mb-3 rounded-[20px] bg-[#ebe7e1] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="text-[12px] font-bold">두루마리 엮는 날</p><p className="mt-1 text-[13px] leading-5 text-sub [overflow-wrap:anywhere]">{decided ? `${describe(decided)}에 엮어요` : '언제 두루마리로 엮을까요?'}</p></div>
        {me.role === 'HOST' && <button type="button" onClick={() => setOptions(true)} className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-[12px] font-semibold text-surface">엮기 설정</button>}
      </div>
    </section>
    {options && <dialog ref={optionsDialog} onCancel={event => { event.preventDefault(); setOptions(false) }} aria-labelledby="weave-options-title" className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-0 bg-bg px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] text-ink backdrop:bg-ink/40">
      <header className="mb-4 flex items-center justify-between"><h2 id="weave-options-title" className="text-[18px] font-bold">두루마리 엮기 설정</h2><button type="button" onClick={() => setOptions(false)} aria-label="닫기" className="size-11 text-2xl">×</button></header>
      <button type="button" onClick={() => { setOptions(false); setError(''); setSheet(true) }} className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left"><span><strong className="block text-[14px]">{decided ? '예약 날짜 바꾸기' : '날짜 정해서 엮기'}</strong><span className="mt-1 block text-[12px] leading-5 text-sub">정한 날까지 기록을 모아 자동으로 엮어요</span></span><span aria-hidden="true">›</span></button>
      <EarlyCloseButton home={home} token={token} />
    </dialog>}
    {sheet && <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!saving) setSheet(false) }} aria-labelledby="weave-date-title" className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-0 bg-surface px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] text-ink backdrop:bg-ink/40">
      <header className="flex items-center justify-between gap-2"><h2 id="weave-date-title" className="text-[19px] font-bold">날짜 및 시간 설정</h2><button type="button" disabled={saving} onClick={() => setSheet(false)} aria-label="닫기" className="size-11 shrink-0 text-2xl">×</button></header>
      <p className="mt-2 text-[13px] leading-6 text-sub">그때까지 모인 사진과 이야기로 엮어요.<br />현재 {room.planType ?? 'FREE'} 플랜으로 예약해요.</p>
      <label htmlFor="scheduled-weave" className="mt-5 block text-[13px] font-bold">두루마리 엮는 날</label>
      <input id="scheduled-weave" type="datetime-local" value={deadline} disabled={saving} min={toLocalDateTimeInput(new Date(now).toISOString())} max={toLocalDateTimeInput(latest.toISOString())} onChange={event => { setSelection({ value: event.target.value, base: serverDeadline }); setError('') }} className="mt-2 h-[52px] w-full min-w-0 rounded-2xl border border-line bg-bg px-4 text-[14px]" />
      <p className="mt-3 rounded-2xl bg-bg p-4 text-[13px] leading-6" role="status">{problem || (at ? `${describe(at)}에 두루마리를 엮어요.` : '날짜와 시간을 선택해 주세요.')}</p>
      <p className="mt-3 text-[11px] leading-5 text-sub">이 방은 {latest.toLocaleDateString('ko-KR')}에 자동으로 지워질 예정이에요. 고른 날짜와 시간은 다시 열어도 유지돼요.</p>
      {selection.base !== serverDeadline && <p role="status" className="mt-3 text-[12px] text-point">예약이 변경되어 최신 날짜와 시간을 표시했어요.</p>}
      {error && <p role="alert" className="mt-3 text-[12px] text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" disabled={saving} onClick={() => setSheet(false)}>취소</Button><Button disabled={!at || Boolean(problem) || saving} onClick={() => void save()}>{saving ? '저장 중…' : '이때로 정하기'}</Button></div>
    </dialog>}
  </>
}
