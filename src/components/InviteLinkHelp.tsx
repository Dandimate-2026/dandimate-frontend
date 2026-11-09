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
  return <details className="my-4 rounded-2xl border border-line bg-surface p-3 text-[13px]">
    <summary className="cursor-pointer font-semibold">초대 링크로 참여</summary>
    <form className="mt-3" onSubmit={event => {
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
      <input id="invite-link" type="url" required value={value} onChange={event => setValue(event.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-line px-3" />
      {error && <p role="alert" className="mt-2 text-point">{error}</p>}
      <button type="submit" className="mt-2 min-h-11 w-full rounded-full bg-ink text-surface">초대 확인하기</button>
    </form>
  </details>
}
