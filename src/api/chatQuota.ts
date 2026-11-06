// 두루 챗봇 질문 횟수: 매일 무료 4번 + 상점에서 산 크레딧(질문 1번 = 1개).
// 서버가 세고 막는다. 서버 API가 아직 없으면 null을 돌려주고 화면은 횟수 표시 없이 동작한다
import { ApiError, request } from './client'
import { USE_MOCK } from './mock'

export interface ChatQuota {
  /** 하루 무료 질문 수 */
  freeLimit: number
  freeRemaining: number
  /** 상점에서 산 크레딧 (무료를 다 쓰면 1개씩 쓴다) */
  credits: number
  /** 무료 횟수가 다시 채워지는 시각 (다음 날 0시) */
  resetsAt: string
}

export interface CreditPack {
  id: string
  name: string
  credits: number
  price: number
}

/** 상점 묶음 (가격은 기획안: 10회 900원 · 30회 1,900원 · 50회 2,900원) */
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'light', name: '가볍게', credits: 10, price: 900 },
  { id: 'basic', name: '기본', credits: 30, price: 1900 },
  { id: 'plenty', name: '넉넉하게', credits: 50, price: 2900 },
]

export const FREE_DAILY_LIMIT = 4

/** 횟수를 다 쓴 질문에 서버가 돌려주는 코드 */
export const CHAT_LIMIT_CODE = 'CHAT_LIMIT_EXCEEDED'

function nextMidnight() {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.toISOString()
}

// 데모: 서버 없이 무료 4번 → 크레딧 순서로 줄어드는 모습을 보여준다
let mockQuota: ChatQuota = { freeLimit: FREE_DAILY_LIMIT, freeRemaining: FREE_DAILY_LIMIT, credits: 0, resetsAt: nextMidnight() }

export async function getChatQuota(): Promise<ChatQuota | null> {
  if (USE_MOCK) return mockQuota
  try {
    return await request<ChatQuota>('/chat/quota')
  } catch (e) {
    // 아직 서버에 없으면(404 등) 횟수 표시 없이 쓴다
    if (e instanceof ApiError && e.status < 500) return null
    throw e
  }
}

/** 데모에서 질문 한 번을 쓴다 (무료 → 크레딧 순서). 다 썼으면 false */
export function spendMockQuestion(): boolean {
  if (mockQuota.freeRemaining > 0) mockQuota = { ...mockQuota, freeRemaining: mockQuota.freeRemaining - 1 }
  else if (mockQuota.credits > 0) mockQuota = { ...mockQuota, credits: mockQuota.credits - 1 }
  else return false
  return true
}

export function canAsk(quota: ChatQuota | null) {
  return !quota || quota.freeRemaining > 0 || quota.credits > 0
}

/**
 * 크레딧 묶음을 산다. 실제 결제는 토스 결제창(서버 주문 → 결제 → 승인)으로 연결해야 해서,
 * 서버 API가 생기기 전에는 데모에서만 바로 충전된다
 */
export async function buyCredits(pack: CreditPack): Promise<ChatQuota> {
  if (USE_MOCK) {
    mockQuota = { ...mockQuota, credits: mockQuota.credits + pack.credits }
    return mockQuota
  }
  throw new Error('크레딧 결제는 곧 열려요. 조금만 기다려 주세요')
}
