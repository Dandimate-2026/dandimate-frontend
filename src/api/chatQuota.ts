// 두루 챗봇 질문 횟수: 매일 무료 4번 + 상점에서 산 크레딧(질문 1번 = 1개).
// 서버가 세고 막는다. 서버 API가 아직 없으면 null을 돌려주고 화면은 횟수 표시 없이 동작한다
import { ApiError, request } from './client'

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

/** 횟수를 다 쓴 질문에 서버가 돌려주는 코드 */
export const CHAT_LIMIT_CODE = 'CHAT_LIMIT_EXCEEDED'

export const FREE_DAILY_LIMIT = 4

export async function getChatQuota(): Promise<ChatQuota | null> {
  try {
    return await request<ChatQuota>('/chat/quota')
  } catch (e) {
    // 아직 서버에 없으면(404 등) 횟수 표시 없이 쓴다
    if (e instanceof ApiError && e.status < 500) return null
    throw e
  }
}

export function canAsk(quota: ChatQuota | null) {
  return !quota || quota.freeRemaining > 0 || quota.credits > 0
}
