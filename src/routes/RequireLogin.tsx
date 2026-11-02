import { Navigate, Outlet, useLocation } from 'react-router'
import { isLoggedIn } from '../lib/auth'
import { paths } from './paths'

/** 로그인하지 않았으면 로그인 화면으로 보내고, 로그인한 뒤 원래 가려던 주소로 돌아오게 한다 */
function RequireLogin() {
  const location = useLocation()
  if (!isLoggedIn()) return <Navigate to={paths.login(location.pathname + location.search)} replace />
  return <Outlet />
}

export default RequireLogin
