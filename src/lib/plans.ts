// 방마다 한 번 고르는 플랜. 가격과 한도는 서버(GET /plans)에서 받고, 받기 전이나 실패하면 아래 기본값을 쓴다
// (기본값은 2026-11 공개 API 응답과 같은 값이다. 꾸미기 설명은 서버에 없어 프론트에만 있다)

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
  /** 첫 한마디 녹음 최대 초 */
  firstMaxSeconds: number
  /** 덧붙임·되묻기 답변·답가 녹음 최대 초 */
  otherMaxSeconds: number
  /** 지금 이 플랜으로 방을 만들 수 있는지 (유료는 결제가 붙기 전까지 false) */
  available: boolean
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
    firstMaxSeconds: 30,
    otherMaxSeconds: 20,
    available: true,
    decor: '기본 꾸미기',
    summary: ['사진 1인 3장 · 말하기 15분 · 재엮기 3회'],
  },
  {
    id: 'lite',
    name: 'Lite',
    price: 2900,
    photosPerMember: 6,
    voiceMinutes: 40,
    reweaves: 6,
    firstMaxSeconds: 60,
    otherMaxSeconds: 30,
    available: false,
    decor: '기본 + 지역 템플릿 5종',
    summary: ['사진 1인 6장 · 말하기 40분 · 재엮기 6회 · 지역 템플릿 5종'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5900,
    photosPerMember: 10,
    voiceMinutes: 90,
    reweaves: 12,
    firstMaxSeconds: 120,
    otherMaxSeconds: 60,
    available: false,
    decor: '일반 + 특별 꾸미기',
    summary: ['사진 1인 10장 · 말하기 90분 · 재엮기 12회 · 특별 꾸미기'],
  },
]

export const RECOMMENDED_PLAN_ID: PlanId = 'lite'

export function findPlan(id: string | null): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

// 영문·숫자를 읽었을 때 받침으로 끝나는 글자 (엘·엠·엔·알 / 영·일·삼·육·칠·팔)
const BATCHIM_SOUNDS = new Set(['l', 'm', 'n', 'r', '0', '1', '3', '6', '7', '8'])

/** 이름 마지막 글자에 받침이 있는지 (한글은 받침, 영문·숫자는 읽는 소리 기준) */
function endsWithBatchim(name: string) {
  const last = name.trim().slice(-1)
  const code = last.charCodeAt(0) - 0xac00
  if (code >= 0 && code <= 11171) return code % 28 !== 0
  return BATCHIM_SOUNDS.has(last.toLowerCase())
}

/** 이름 뒤에 붙일 주격 조사. '경주 1박2일' → '이', '가을 MT' → '가' */
export function subjectParticle(name: string) {
  return endsWithBatchim(name) ? '이' : '가'
}

/** 이름 뒤에 붙일 목적격 조사. '경주 1박2일' → '을', '리센느' → '를' */
export function objectParticle(name: string) {
  return endsWithBatchim(name) ? '을' : '를'
}

/** 2900 → '₩2,900' */
export function formatWon(amount: number) {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/** GET /plans 한 줄 */
export interface PlanCatalogItem {
  planType: 'FREE' | 'LITE' | 'PRO'
  price: number
  roomCreationAvailable: boolean
  photosPerMember: number
  firstMaxSeconds: number
  otherMaxSeconds: number
  voiceLimitMs: number
  regenerationLimit: number
}

/** 서버 플랜 목록의 가격·한도로 기본 플랜을 덮어쓴다. 서버에 없는 플랜은 기본값 그대로 둔다 */
export function mergePlanCatalog(items: PlanCatalogItem[]): Plan[] {
  return PLANS.map((plan) => {
    const item = items.find((i) => i.planType.toLowerCase() === plan.id)
    if (!item) return plan
    const voiceMinutes = Math.round(item.voiceLimitMs / 60000)
    const limits = `사진 1인 ${item.photosPerMember}장 · 말하기 ${voiceMinutes}분 · 재엮기 ${item.regenerationLimit}회`
    return {
      ...plan,
      price: item.price,
      photosPerMember: item.photosPerMember,
      voiceMinutes,
      reweaves: item.regenerationLimit,
      firstMaxSeconds: item.firstMaxSeconds,
      otherMaxSeconds: item.otherMaxSeconds,
      available: item.roomCreationAvailable,
      summary: [`${limits}${plan.id === 'free' ? '' : plan.id === 'lite' ? ' · 지역 템플릿 5종' : ' · 특별 꾸미기'}`],
    }
  })
}
