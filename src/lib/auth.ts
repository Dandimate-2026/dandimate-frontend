// 카카오 로그인은 서버가 처리하고, 로그인 상태는 서버 세션 쿠키로 확인한다
import { ApiError, request, resetCsrfToken, SERVER_ORIGIN } from '../api/client'
import { USE_MOCK } from '../api/mock'

// mock 모드에서는 서버 없이 로그인한 것처럼 기기에 표시만 남긴다
const MOCK_AUTH_KEY = 'duruduru:auth'
// 카카오 로그인 화면에 다녀오는 동안 돌아올 앱 안 경로를 기억해 둔다
const REDIRECT_KEY = 'duruduru:login-redirect'

export interface Me {
  id: string
  createdAt: string
}

/** 로그인한 계정. 로그인하지 않았으면 null */
export async function getMe(): Promise<Me | null> {
  if (USE_MOCK) {
    try {
      return localStorage.getItem(MOCK_AUTH_KEY) ? { id: 'mock-user', createdAt: new Date().toISOString() } : null
    } catch {
      return null
    }
  }
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
  if (USE_MOCK) {
    try {
      localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify({ provider: 'KAKAO', loggedInAt: new Date().toISOString() }))
    } catch {
      // 시크릿 모드 등은 무시
    }
    window.location.assign(redirect)
    return
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
  if (USE_MOCK) {
    try {
      localStorage.removeItem(MOCK_AUTH_KEY)
    } catch {
      // 무시
    }
    return
  }
  await request('/auth/logout', { method: 'POST' })
  resetCsrfToken()
}
