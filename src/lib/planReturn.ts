// 두루마리 템플릿을 고르다가 플랜을 올리러 갔으면, 결제를 마친 뒤 그 두루마리로 돌려보낸다.
// 토스 결제창에 다녀오면 페이지가 통째로 바뀌어서 sessionStorage에 둔다 (이 탭에서만)
const key = (roomId: string) => `duruduru:plan-return:${roomId}`

export function rememberPlanReturn(roomId: string, path: string) {
  try {
    sessionStorage.setItem(key(roomId), path)
  } catch {
    // 저장하지 못하면 결제 뒤 방 홈으로 돌아간다
  }
}

/** 기억해 둔 돌아갈 주소 (없으면 null) */
export function readPlanReturn(roomId: string): string | null {
  try {
    return sessionStorage.getItem(key(roomId))
  } catch {
    return null
  }
}

export function clearPlanReturn(roomId: string) {
  try {
    sessionStorage.removeItem(key(roomId))
  } catch {
    // 지우지 못해도 다음 결제 뒤 같은 두루마리로 돌아갈 뿐이다
  }
}
