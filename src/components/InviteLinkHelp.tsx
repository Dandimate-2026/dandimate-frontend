import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { SITE_ORIGIN } from '../lib/siteUrl'

/** iOS cannot be forced to launch a Home Screen app from an external HTTPS link. */
export function InviteLinkHelp({ invitePath }: { invitePath?: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  if (standalone) return null
  const kakao = /KAKAOTALK/i.test(navigator.userAgent)
  return <div className="mt-4 rounded-2xl border border-line bg-surface p-3 text-left text-[12px] leading-5 text-sub">
    <p>{kakao ? '카카오톡 안에서 열렸어요. 메뉴에서 기본 브라우저로 열기를 선택해 주세요.' : '홈 화면에 설치한 두루두루에서도 초대를 받을 수 있어요.'}</p>
    <p className="mt-1">앱이 열리지 않으면 초대 링크를 복사한 뒤, 홈 화면의 두루두루 → 초대 링크로 참여에 붙여넣어 주세요.</p>
    <button type="button" className="mt-2 min-h-11 w-full rounded-full border border-line font-semibold text-ink" onClick={async () => {
      try { await navigator.clipboard.writeText(invitePath ? new URL(invitePath, window.location.origin).href : window.location.href); setCopied(true); setError('') }
      catch { setError('주소창의 초대 링크를 복사해 주세요') }
    }}>{copied ? '초대 링크를 복사했어요' : '초대 링크 복사'}</button>
    {error && <p role="status">{error}</p>}
  </div>
}

export function JoinByInviteLink({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    element?.querySelector('input')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <dialog ref={dialog} aria-labelledby="join-invite-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
  }} className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-sm max-h-[calc(100dvh-32px)] overflow-y-auto rounded-3xl border-0 bg-surface p-5 text-[13px] text-ink shadow-xl backdrop:bg-ink/35">
    <div className="flex items-center justify-between gap-3"><h2 id="join-invite-title" className="text-[18px] font-bold">초대 링크로 참여</h2><button type="button" onClick={onClose} aria-label="닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl">×</button></div>
    <p className="mt-1 text-[12px] text-sub">친구가 보내준 모임방에 함께해요</p>
    <form className="mt-5" onSubmit={event => {
      event.preventDefault()
      try {
        const url = new URL(value.trim())
        const trustedOrigin = [new URL(SITE_ORIGIN).origin, window.location.origin].includes(url.origin)
        const validProtocol = url.protocol === 'https:' || (import.meta.env.DEV && url.protocol === 'http:')
        if (!trustedOrigin || !validProtocol || !/^\/invite\/[^/]+\/?$/.test(url.pathname)) throw new Error()
        setError('')
        navigate(url.pathname)
      } catch { setError('두루두루 초대 링크를 확인해 주세요') }
    }}>
      <label htmlFor="invite-link" className="text-sub">복사한 초대 링크를 붙여넣어 주세요</label>
      <input id="invite-link" type="url" required value={value} onChange={event => { setValue(event.target.value); setError('') }} placeholder="https://…/invite/…" aria-invalid={Boolean(error)} className="mt-2 h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-[13px] outline-none focus:border-ink/40" />
      {error && <p role="alert" className="mt-2 text-point">{error}</p>}
      <button type="submit" disabled={!value.trim()} className="mt-3 min-h-11 w-full rounded-full bg-ink font-semibold text-surface disabled:opacity-40">초대 확인하기</button>
    </form>
  </dialog>
}
