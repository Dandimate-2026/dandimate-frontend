import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import type { FlowerCode } from '../api/types'
import Flower from '../components/Flower'
import { type MockRole, USE_MOCK } from '../api/mock'
import { getInvitePreview } from '../api/rooms'
import { getMe, loginWithKakao, takeLoginRedirect } from '../lib/auth'
import { paths } from '../routes/paths'
import InviteLoginView from './InviteLoginView'

const FLOWER_ROW: FlowerCode[] = ['AZALEA', 'CANOLA', 'FORGET_ME_NOT', 'FORSYTHIA', 'LILAC']

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M9 1.5C4.58 1.5 1 4.32 1 7.8c0 2.25 1.5 4.22 3.75 5.33l-.77 2.82c-.07.25.22.45.43.31l3.36-2.22c.4.05.82.08 1.23.08 4.42 0 8-2.82 8-6.3S13.42 1.5 9 1.5Z" />
    </svg>
  )
}

/** 로그인 뒤 돌아갈 주소. 다른 사이트로 넘어가지 않도록 앱 안 경로만 허용한다 */
function safeRedirect(redirect: string | null) {
  return redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : paths.roomList()
}

/** 첫 화면: 카카오로 시작하기 */
function LoginPage() {
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const [loggedIn, setLoggedIn] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  // 초대 링크(/invite/{코드})에서 넘어왔으면 초대받은 사람 전용 로그인 화면을 보여준다
  const inviteToken = redirect.match(/^\/invite\/([^/?#]+)/)?.[1]
  const [inviteRoomName, setInviteRoomName] = useState<string>()

  // 초대 정보는 로그인 없이 볼 수 있어서 로그인 전에 방 이름을 보여준다. 못 불러오면 방 이름 없이 보여준다
  useEffect(() => {
    if (!inviteToken) return
    getInvitePreview(inviteToken)
      .then((preview) => setInviteRoomName(preview.roomName))
      .catch(() => {})
  }, [inviteToken])

  // 카카오 로그인을 마치고 돌아왔거나 이미 로그인했으면 가려던 곳으로 보낸다
  useEffect(() => {
    getMe()
      .then((me) => setLoggedIn(me !== null))
      .catch(() => {})
  }, [])

  if (loggedIn) {
    const stored = takeLoginRedirect()
    return <Navigate to={stored ? safeRedirect(stored) : redirect} replace />
  }

  const handleLogin = (mockRole?: MockRole) => {
    setLoggingIn(true)
    loginWithKakao(redirect, mockRole)
  }

  // 초대받은 사람은 멤버로 들어온다 (데모에서도 멤버로 로그인)
  if (inviteToken) {
    return <InviteLoginView roomName={inviteRoomName} loggingIn={loggingIn} onLogin={() => handleLogin('MEMBER')} />
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-12 pb-8 text-ink">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Flower code="ROYAL_AZALEA" size={66} />
        <h1 className="mt-[18px] text-[32px] leading-10 font-extrabold">두루두루</h1>
        <p className="mt-3 text-[14px] leading-[22px] text-sub">
          친구들과 함께 엮는
          <br />
          우리만의 두루마리
        </p>
        <ul className="mt-8 flex gap-1.5">
          {FLOWER_ROW.map((code) => (
            <li key={code}>
              <Flower code={code} size={24} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="pt-6">
        {USE_MOCK ? (
          // 데모(mock)에서는 같은 방들을 방장 또는 멤버 입장에서 볼 수 있게 역할을 고르고 들어간다
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-center text-[11px] text-sub">데모 모드 · 어떤 입장으로 볼까요?</p>
            <button
              type="button"
              onClick={() => handleLogin('HOST')}
              disabled={loggingIn}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] text-[15px] font-semibold text-black/85 active:opacity-80"
            >
              <KakaoIcon />
              방장으로 시작하기
            </button>
            <button
              type="button"
              onClick={() => handleLogin('MEMBER')}
              disabled={loggingIn}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[#e6cf00] bg-surface text-[15px] font-semibold text-black/85 active:opacity-80"
            >
              <KakaoIcon />
              멤버로 시작하기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleLogin()}
            disabled={loggingIn}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] text-[15px] font-semibold text-black/85 active:opacity-80"
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>
        )}
        <p className="mt-4 text-center text-[11px] leading-[17px] text-sub">
          시작하면{' '}
          <Link to={paths.terms()} className="text-point">
            이용약관
          </Link>
          과{' '}
          <Link to={paths.privacy()} className="text-point">
            개인정보 처리방침
          </Link>
          ,
          <br />
          사진·음성의 외부 AI 처리에 동의하게 돼요
        </p>
      </footer>
    </main>
  )
}

export default LoginPage
