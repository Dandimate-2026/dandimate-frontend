import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { closeRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import { paths } from '../routes/paths'
import Button from './Button'
import Flower from './Flower'

export default function EarlyCloseButton({ home, token }: { home: RoomHome; token: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [open])
  if (home.me.role !== 'HOST' || !['COLLECTING', 'CIRCULATING'].includes(home.room.status)) return null
  const close = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await closeRoom(home.room.id, token)
      navigate(paths.roomWeaving(home.room.id, result.job.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '마감하지 못했어요. 다시 시도해 주세요'); setBusy(false) }
  }
  return <>
    <section aria-label="지금 두루마리 엮기" className="mt-3 border-t border-ink/10 pt-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center text-sub" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h11a2 2 0 0 1 0 4H7M7 4a2 2 0 0 0 0 4v10a2 2 0 0 0 0 4h11a2 2 0 0 0 0-4H7M18 8v10M10 11h5M10 14h3" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">지금까지의 이야기로 엮기</p>
          <p className="mt-1 text-[11px] leading-[17px] text-sub">모인 사진과 이야기로 지금 시작해요</p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-ink/20 bg-surface px-4 text-[12px] font-semibold text-ink active:bg-line">두루마리 엮기<span aria-hidden="true">›</span></button>
      </div>
    </section>
    {open && <dialog ref={dialogRef} aria-labelledby="early-close-title" aria-describedby="early-close-description" onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false) }} className="fixed inset-0 m-auto w-[calc(100%_-_48px)] max-w-[340px] rounded-[28px] border-0 bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/35" onClick={(event) => { if (event.target === event.currentTarget && !busy) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false) } }}>
      <div className="flex justify-center pt-2" aria-hidden="true"><Flower code="AZALEA" size={36} /></div>
      <h2 id="early-close-title" className="mt-5 text-center text-[20px] font-bold leading-7">이제 두루마리로 엮을까요?</h2>
      <p id="early-close-description" className="mt-3 text-center text-[13px] leading-[22px] text-sub">지금까지 모은 사진과 이야기를<br />하나의 두루마리로 엮어요.</p>
      <p className="mt-4 rounded-2xl bg-bg px-4 py-3 text-[12px] leading-5 text-sub">엮기를 시작하면 원본 기록은 더 수정할 수 없어요.</p>
      {error && <p role="alert" className="mt-3 text-[12px] leading-5 text-point">{error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-2.5"><Button variant="outline" className="h-12 rounded-full text-[13px]" disabled={busy} onClick={() => setOpen(false)} autoFocus>더 모을게요</Button><Button className="h-12 text-[13px]" disabled={busy} onClick={() => void close()}>{busy ? '엮기 시작 중…' : '두루마리 엮기'}</Button></div>
    </dialog>}
  </>
}
