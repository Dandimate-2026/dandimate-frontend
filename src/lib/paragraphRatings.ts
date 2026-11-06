const STORAGE_KEY = 'duruduru:paragraph-ratings:v1'
const completedRatings = new Map<string, number>()

function ratingKey(roomId: string, memberId: string, paragraphId: string, version: number) {
  return JSON.stringify([roomId, memberId, paragraphId, version])
}

/** 서버가 내 평가를 조회 응답에 포함하기 전까지, 저장 성공한 평가만 이 기기에 기억한다. */
export function getParagraphRating(roomId: string, memberId: string, paragraphId: string, version: number): number | undefined {
  const key = ratingKey(roomId, memberId, paragraphId, version)
  const cached = completedRatings.get(key)
  if (cached !== undefined) return cached
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const score: unknown = (stored as Record<string, unknown>)[key]
      if (typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5) {
        completedRatings.set(key, score)
        return score
      }
    }
  } catch {
    // 저장소 접근이 제한되더라도 현재 화면의 평가 상태는 유지한다.
  }
  return undefined
}

export function rememberParagraphRating(roomId: string, memberId: string, paragraphId: string, version: number, score: number) {
  if (!Number.isInteger(score) || score < 1 || score > 5) return
  const key = ratingKey(roomId, memberId, paragraphId, version)
  completedRatings.set(key, score)
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const stored = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, [key]: score }))
  } catch {
    // 저장소를 쓸 수 없어도 서버 저장에 성공한 평가를 다시 노출하지 않는다.
  }
}
