import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { getMe, takeLoginRedirect } from '../lib/auth'
import { paths } from './paths'

type LoginState = 'checking' | 'in' | 'out'

/** 로그인하지 않았으면 로그인 화면으로 보내고, 로그인한 뒤 원래 가려던 주소로 돌아오게 한다 */
function RequireLogin() {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<LoginState>('checking')

  useEffect(() => {
    getMe()
      .then((me) => {
        setState(me ? 'in' : 'out')
        if (!me) return
        // 카카오 로그인 뒤 서버가 첫 화면으로 보내 주므로, 로그인 전에 가려던 곳이 있으면 한 번만 그리로 보낸다
        const redirect = takeLoginRedirect()
        if (redirect?.startsWith('/') && !redirect.startsWith('//')) navigate(redirect, { replace: true })
      })
      // 서버에 닿지 않으면 로그인 화면에서 다시 시도하게 한다
      .catch(() => setState('out'))
    // 로그인 확인은 앱에 들어올 때 한 번만 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'checking') return <main className="flex-1 bg-bg" aria-busy="true" />
  if (state === 'out') return <Navigate to={paths.login(location.pathname + location.search)} replace />
  return <Outlet />
}

export default RequireLogin
