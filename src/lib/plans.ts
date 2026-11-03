// 방마다 한 번 고르는 플랜. 가격과 한도는 시안의 예시 값이다
// TODO: 플랜·가격이 확정되면 백엔드에서 받아오도록 바꾼다

export type PlanId = 'free' | 'lite' | 'pro'

export interface Plan {
  id: PlanId
  name: string
  price: number
  /** 1인당 올릴 수 있는 사진 수 */
  photosPerMember: number
  /** 방 전체 말하기(음성) 총량, 분 */
  voiceMinutes: number
  /** 다시 엮기 횟수 */
  reweaves: number
  decor: string
  /** 플랜 카드에 보여줄 설명 줄 */
  summary: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    photosPerMember: 3,
    voiceMinutes: 15,
    reweaves: 3,
    decor: '기본 꾸미기',
    summary: ['사진 1인 3장 · 말하기 총 15분 · 재엮기 3회 · 기본 꾸미기'],
  },
  {
    id: 'lite',
    name: 'Lite',
    price: 2900,
    photosPerMember: 6,
    voiceMinutes: 40,
    reweaves: 6,
    decor: '일반 꾸미기 전부',
    summary: ['사진 1인 6장 · 말하기 총 40분 · 재엮기 6회', '일반 꾸미기 전부'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5900,
    photosPerMember: 10,
    voiceMinutes: 90,
    reweaves: 12,
    decor: '일반 + 특별 꾸미기',
    summary: ['사진 1인 10장 · 말하기 총 90분 · 재엮기 12회', '일반 + 특별 꾸미기 (화전놀이 테마 등)'],
  },
]

export const FREE_PLAN = PLANS[0]
export const RECOMMENDED_PLAN_ID: PlanId = 'lite'

export function findPlan(id: string | null): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

// 영문·숫자를 읽었을 때 받침으로 끝나는 글자 (엘·엠·엔·알 / 영·일·삼·육·칠·팔)
const BATCHIM_SOUNDS = new Set(['l', 'm', 'n', 'r', '0', '1', '3', '6', '7', '8'])

/** 이름 뒤에 붙일 주격 조사. '경주 1박2일' → '이', '가을 MT' → '가' */
export function subjectParticle(name: string) {
  const last = name.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  if (code >= 0 && code <= 11171) return code % 28 === 0 ? '가' : '이'
  return BATCHIM_SOUNDS.has(last.toLowerCase()) ? '이' : '가'
}

/** 2900 → '₩2,900' */
export function formatWon(amount: number) {
  return `₩${amount.toLocaleString('ko-KR')}`
}
