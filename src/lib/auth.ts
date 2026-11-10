// 카카오 로그인은 서버가 처리하고, 로그인 상태는 서버 세션 쿠키로 확인한다
import { ApiError, request, resetCsrfToken, SERVER_ORIGIN } from '../api/client'

// 카카오 로그인 화면에 다녀오는 동안 돌아올 앱 안 경로를 기억해 둔다
const REDIRECT_KEY = 'duruduru:login-redirect'

export interface Me {
  id: string
  createdAt: string
}

/** 로그인한 계정. 로그인하지 않았으면 null */
export async function getMe(): Promise<Me | null> {
  try {
    return await request<Me>('/users/me')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

/** 카카오 로그인 화면으로 이동한다. 로그인이 끝나면 서버가 프론트로 되돌려 보낸다 */
export function loginWithKakao(redirect: string) {
  try {
    sessionStorage.setItem(REDIRECT_KEY, redirect)
  } catch {
    // 저장소를 쓸 수 없으면 로그인 뒤 내 모임방 목록으로 간다
  }

  window.location.assign(`${SERVER_ORIGIN}/oauth2/authorization/kakao`)
}

/** 카카오 로그인 전에 가려던 경로를 한 번만 꺼낸다 */
export function takeLoginRedirect() {
  try {
    const redirect = sessionStorage.getItem(REDIRECT_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
    return redirect
  } catch {
    return null
  }
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' })
  resetCsrfToken()
}

/** The server blocks deletion while the account hosts an active room (409). */
export async function deleteAccount() {
  await request('/users/me', { method: 'DELETE' })
  resetCsrfToken()
}
