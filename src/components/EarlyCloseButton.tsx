import { useEffect, useRef, useState } from 'react'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { closeRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import { paths } from '../routes/paths'
import Button from './Button'
import Flower from './Flower'

export default function EarlyCloseButton({ home, token }: { home: RoomHome; token: string }) {
  const navigate = useAppNavigate()
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
  const empty = home.members.every(member => (member.storyCount ?? 0) === 0 && (member.photoCount ?? 0) === 0)
  const soloAtLimit = home.room.capacity === 1 && (home.room.quota?.myPhotosRemaining ?? 1) === 0
  const close = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await closeRoom(home.room.id, token)
      navigate(paths.roomWeaving(home.room.id, result.job.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '마감하지 못했어요. 다시 시도해 주세요'); setBusy(false) }
  }
  return <>
    <button type="button" disabled={empty} onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-4 text-left active:bg-bg">
      <span className="min-w-0"><span className="block text-[14px] font-semibold">{empty ? '엮을 게 없어요' : '지금 엮기'}</span><span className="mt-1 block text-[12px] leading-5 text-sub">지금까지 모인 사진과 이야기로 시작해요</span></span>
      <span className="shrink-0 text-sub" aria-hidden="true">›</span>
    </button>
    {open && <dialog ref={dialogRef} aria-labelledby="early-close-title" aria-describedby="early-close-description" onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false) }} className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-h-[calc(100dvh-32px)] max-w-[380px] overflow-y-auto rounded-[28px] border-0 bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/35" onClick={(event) => { if (event.target === event.currentTarget && !busy) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false) } }}>
      <div className="max-h-[calc(100dvh-120px)] overflow-y-auto px-5 pt-5 pb-4">
      <div className="flex justify-center" aria-hidden="true"><Flower code="AZALEA" size={28} /></div>
      <h2 id="early-close-title" className="mt-3 text-center text-[20px] font-bold leading-7">이제 두루마리로 엮을까요?</h2>
      <p id="early-close-description" className="mt-3 text-center text-[13px] leading-[22px] text-sub">모은 사진과 이야기로 두루마리를 만들어요.</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 rounded-2xl border border-line bg-bg p-3">
        <div><p className="text-[10px] text-sub">현재 플랜</p><p className="mt-1 text-[18px] font-bold">{home.room.planType ?? 'FREE'} <span className="text-[12px] font-normal text-sub">플랜</span></p></div>
        <button type="button" disabled={busy} onClick={() => navigate(paths.roomPlan(home.room.id), { state: { fromWeave: true } })} className="col-span-2 min-h-11 rounded-full border border-ink/20 bg-surface px-3 text-[12px] font-semibold">템플릿·플랜 보기 <span aria-hidden="true">›</span></button>
      </div>
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
        <p className="flex items-center gap-2 text-[13px] font-bold text-amber-950"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>엮으면 원본 기록이 잠겨요</p>
        <p className="mt-2 text-[12px] leading-5 text-amber-950"><strong>사진·첫 한마디는 수정할 수 없어요.</strong><br />사진을 더 올리려면 엮기 전에 플랜을 바꿔 주세요.</p>
        <p className="mt-3 border-t border-amber-200 pt-3 text-[12px] leading-5 text-amber-900">완성된 문장은 <strong>재엮기로 수정</strong>할 수 있어요.{home.room.quota?.regenerationsRemaining !== undefined && <span className="mt-1 block font-semibold">재엮기 {home.room.quota.regenerationsRemaining}회 남음</span>}</p>
      </div>
      {error && <p role="alert" className="mt-3 text-[12px] leading-5 text-point">{error}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-t border-line bg-surface p-4"><Button variant="outline" className="h-12 rounded-full text-[13px]" disabled={busy} onClick={() => setOpen(false)} autoFocus>{soloAtLimit ? '닫기' : '더 모을게요'}</Button><Button className="h-12 text-[13px]" disabled={busy} onClick={() => void close()}>{busy ? '엮기 시작 중…' : '두루마리 엮기'}</Button></div>
    </dialog>}
  </>
}
