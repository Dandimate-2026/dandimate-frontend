import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { getMyRooms } from '../api/rooms'
import type { MyRoom } from '../api/types'
import Button from '../components/Button'
import { deleteAccount, getMe } from '../lib/auth'
import { resetChat } from '../lib/chatStore'
import { clearPendingPayment } from '../api/payments'
import { clearRoomDraft } from '../lib/roomDraft'
import { clearAccountPhotoDrafts } from '../lib/photoDraft'
import { listSavedRoomIds, removeRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

export default function AccountPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<MyRoom[] | null>(null)
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const deleting = useRef(false)
  useEffect(() => {
    let active = true
    void Promise.all([getMyRooms(), getMe()]).then(([list, me]) => { if (active) { setRooms(list ?? []); setUserId(me?.id ?? ''); setError('') } }).catch(() => { if (active) setError('계정 정보를 불러오지 못했어요. 다시 확인해 주세요.') })
    return () => { active = false }
  }, [retry])
  useEffect(() => {
    if (!confirming) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    return () => { previous?.focus() }
  }, [confirming])
  const hostRooms = rooms?.filter(room => room.role === 'HOST' && room.status !== 'GROWING') ?? []
  async function withdraw() {
    if (!agreed || deleting.current || !rooms) return
    deleting.current = true; setBusy(true); setError('')
    try {
      await deleteAccount()
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409 ? '진행 중인 모임방의 방장을 먼저 넘기거나 모임방을 삭제해 주세요.' : cause instanceof Error ? cause.message : '탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.')
      if (cause instanceof ApiError && cause.status === 409) void getMyRooms().then(list => setRooms(list ?? [])).catch(() => {})
      deleting.current = false; setBusy(false); setConfirming(false)
      return
    }
    new Set([...listSavedRoomIds(), ...rooms.map(room => room.roomId)]).forEach(removeRoomSession)
    clearPendingPayment(); clearRoomDraft(); resetChat()
    if (userId) await clearAccountPhotoDrafts(userId)
    navigate(paths.login(), { replace: true })
  }
  return <main className="min-h-dvh bg-bg px-5 pt-12 pb-10 text-ink">
    <header><Link to={paths.roomList()} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold"><span aria-hidden="true">‹</span> 계정 설정</Link></header>
    <section className="mt-6 rounded-3xl border border-line bg-surface p-5">
      <h1 className="text-[20px] font-bold">내 계정</h1>
      <p className="mt-2 text-[13px] leading-6 text-sub">카카오로 연결한 두루두루 계정이에요.</p>
      <Link to={paths.notifications()} className="mt-4 flex min-h-12 items-center justify-between rounded-2xl bg-bg px-4 text-[13px] font-semibold">전체 알림 보기 <span aria-hidden="true">›</span></Link>
      <div className="mt-3 flex gap-4 text-[12px] text-sub"><Link className="py-2 underline" to={paths.terms()}>이용약관</Link><Link className="py-2 underline" to={paths.privacy()}>개인정보 처리방침</Link></div>
    </section>
    <section className="mt-6 rounded-3xl border border-line bg-surface p-5" aria-labelledby="withdraw-title">
      <h2 id="withdraw-title" className="text-[17px] font-bold">회원 탈퇴</h2>
      <p className="mt-3 text-[13px] leading-6 text-sub">카카오 계정 연결과 개인 대화·사용량·알림 구독이 삭제돼요. 탈퇴 후에는 기존 계정으로 돌아갈 수 없어요.</p>
      <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[12px] leading-6 text-amber-950"><strong>함께 남긴 사진과 이야기는 모임방에 남아요.</strong><br />공동 기록과 작성자 표시는 탈퇴 후에도 유지돼요.</p>
      {hostRooms.length > 0 && <div className="mt-4 rounded-2xl border border-line p-4"><p className="text-[13px] font-semibold">먼저 방장을 넘기거나 모임방을 삭제해 주세요</p><ul className="mt-2">{hostRooms.map(room => <li key={room.roomId}><Link to={paths.roomSettings(room.roomId)} className="flex min-h-11 items-center justify-between gap-3 text-[13px] text-point"><span className="min-w-0 break-words">{room.name}</span><span className="shrink-0">설정 ›</span></Link></li>)}</ul></div>}
      {error && <p role="alert" className="mt-4 text-[13px] leading-6 text-point">{error}</p>}
      {rooms === null && <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 min-h-11 text-[13px] font-semibold">{error ? '계정 정보 다시 확인하기' : '계정 정보를 확인하고 있어요…'}</button>}
      <Button variant="outline" className="mt-5 w-full text-red-700" disabled={rooms === null || hostRooms.length > 0 || busy} onClick={() => { setAgreed(false); setConfirming(true) }}>회원 탈퇴하기</Button>
    </section>
    {confirming && <dialog ref={dialog} aria-labelledby="withdraw-confirm-title" onCancel={event => { event.preventDefault(); if (!busy) setConfirming(false) }} className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-sm rounded-3xl border-0 bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40">
      <h2 id="withdraw-confirm-title" className="text-[20px] font-bold">두루두루를 탈퇴할까요?</h2>
      <p className="mt-3 text-[13px] leading-6 text-sub">개인 대화와 계정 정보는 삭제되고, 공동 기록인 사진·이야기와 작성자 표시는 남아요.</p>
      <label className="mt-4 flex min-h-12 items-start gap-3 rounded-2xl bg-bg p-3 text-[13px] leading-6"><input type="checkbox" checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-point" />탈퇴 후 되돌릴 수 없다는 내용을 확인했어요.</label>
      <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" autoFocus disabled={busy} onClick={() => setConfirming(false)}>취소</Button><Button disabled={!agreed || busy} onClick={() => void withdraw()}>{busy ? '탈퇴 중…' : '탈퇴하기'}</Button></div>
    </dialog>}
  </main>
}
