import { useState } from 'react'
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

export function JoinByInviteLink() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  return <details className="group my-4 overflow-hidden rounded-[20px] border border-line bg-surface text-[13px]">
    <summary className="flex min-h-[76px] cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-point/10 text-point" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10 13 4-4M8 16l-1 1a4.2 4.2 0 0 1-6-6l4-4a4.2 4.2 0 0 1 6 0m2 1 1-1a4.2 4.2 0 0 1 6 6l-4 4a4.2 4.2 0 0 1-6 0" /></svg></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">초대 링크로 참여</span><span className="mt-1 block text-[11px] leading-4 text-sub">친구가 보내준 모임방에 함께해요</span></span>
      <svg className="shrink-0 text-sub transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <form className="border-t border-line p-4" onSubmit={event => {
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
  </details>
}
