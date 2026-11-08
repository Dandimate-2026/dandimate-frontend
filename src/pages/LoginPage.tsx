import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { type MockRole, USE_MOCK } from '../api/mock'
import { getInvitePreview } from '../api/rooms'
import { getMe, loginWithKakao, takeLoginRedirect } from '../lib/auth'
import { paths } from '../routes/paths'
import WelcomeView, { KakaoButton } from './WelcomeView'

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
  const [inviterNickname, setInviterNickname] = useState<string | null>()

  // 초대 정보는 로그인 없이 볼 수 있어서 로그인 전에 방 이름을 보여준다. 못 불러오면 방 이름 없이 보여준다
  useEffect(() => {
    if (!inviteToken) return
    getInvitePreview(inviteToken)
      .then((preview) => {
        setInviteRoomName(preview.roomName)
        setInviterNickname(preview.inviterNickname)
      })
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
    return (
      <WelcomeView
        invite
        inviteRoomName={inviteRoomName}
        inviterNickname={inviterNickname}
        actions={<KakaoButton disabled={loggingIn} onClick={() => handleLogin('MEMBER')} />}
      />
    )
  }

  // 그냥 들어온 사람: 초대 문구 없이 같은 첫 화면
  return (
    <WelcomeView
      invite={false}
      actions={
        USE_MOCK ? (
          // 데모(mock)에서는 같은 방들을 방장 또는 멤버 입장에서 볼 수 있게 역할을 고르고 들어간다
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-center text-[11px] text-sub">데모 모드 · 어떤 입장으로 볼까요?</p>
            <KakaoButton label="방장으로 시작하기" disabled={loggingIn} onClick={() => handleLogin('HOST')} />
            <KakaoButton label="멤버로 시작하기" disabled={loggingIn} onClick={() => handleLogin('MEMBER')} />
          </div>
        ) : (
          <KakaoButton disabled={loggingIn} onClick={() => handleLogin()} />
        )
      }
      note={
        <>
          로그인하면{' '}
          <Link to={paths.terms()} className="text-point">
            이용약관
          </Link>
          과{' '}
          <Link to={paths.privacy()} className="text-point">
            개인정보 처리방침
          </Link>
          ,
          <br />
          사진 · 음성의 외부 AI 처리에 동의하게 돼요
        </>
      }
    />
  )
}

export default LoginPage
