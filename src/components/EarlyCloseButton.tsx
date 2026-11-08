import { useState } from 'react'
import { useNavigate } from 'react-router'
import { closeRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import { paths } from '../routes/paths'
import Button from './Button'

export default function EarlyCloseButton({ home, token }: { home: RoomHome; token: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full py-2 text-[12px] text-sub">지금 마감하고 두루마리 엮기</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <section role="alertdialog" aria-modal="true" aria-labelledby="early-close-title" className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center">
        <h2 id="early-close-title" className="font-bold">지금 모임방을 마감할까요?</h2>
        <p className="mt-3 text-sm text-sub">지금까지 모은 사진과 이야기로 엮기 시작해요. 마감 후에는 원본 기록을 더 수정할 수 없어요.</p>
        {error && <p role="alert" className="mt-3 text-sm text-point">{error}</p>}
        <div className="mt-5 flex gap-3"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>계속 모으기</Button><Button disabled={busy} onClick={() => void close()}>{busy ? '마감 중…' : '마감하고 엮기'}</Button></div>
      </section>
    </div>}
  </>
}
