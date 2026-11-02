// 카카오 로그인 상태를 기기에 저장해 둔다
// TODO: 백엔드 로그인 API가 준비되면 Kakao JS SDK로 받은 인가 코드를 넘기고, 받은 토큰을 저장하도록 바꾼다

const AUTH_KEY = 'duruduru:auth'

export function isLoggedIn() {
  try {
    return localStorage.getItem(AUTH_KEY) !== null
  } catch {
    return false
  }
}

/** 지금은 카카오 로그인에 성공했다고 치고 로그인 표시만 남긴다 */
export async function loginWithKakao() {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ provider: 'KAKAO', loggedInAt: new Date().toISOString() }))
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)은 무시
  }
}
