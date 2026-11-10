// 두루 챗봇 대화. 시트를 내렸다 다시 열어도 이어지도록 화면 밖(모듈)에 두고,
// 새로고침해도 남도록 이 탭의 sessionStorage에도 적어 둔다. 답을 기다리는 중에 시트를 내려도 답은 들어온다
import { useSyncExternalStore } from 'react'
import { ApiError } from '../api/client'
import { CHAT_LIMIT_CODE, canAsk, getChatQuota, spendMockQuestion, type ChatQuota } from '../api/chatQuota'
import { USE_MOCK } from '../api/mock'
import { askDuru, type ChatCitation, type ChatOutcome, type ChatSource } from '../api/recordMap'

export interface ChatLine {
  from: 'me' | 'duru'
  text: string
  citations?: ChatCitation[]
  sources?: ChatSource[]
  outcome?: ChatOutcome
}

interface ChatState {
  conversationId: string
  lines: ChatLine[]
  sending: boolean
  /** 오늘 남은 무료 질문·크레딧. 서버가 아직 모르면 null (횟수 표시 없이 동작) */
  quota: ChatQuota | null
}

const STORAGE_KEY = 'duruduru:chat'

function load(): ChatState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Omit<ChatState, 'sending'>
      return { ...saved, sending: false, quota: null }
    }
  } catch {
    // 저장소를 못 쓰면 새 대화로 시작한다
  }
  return { conversationId: crypto.randomUUID(), lines: [], sending: false, quota: null }
}

let state: ChatState = load()
let currentScope = (() => { try { return sessionStorage.getItem('duruduru:chat-scope') ?? 'REAL' } catch { return 'REAL' } })()
const listeners = new Set<() => void>()

function setState(next: Partial<ChatState>) {
  state = { ...state, ...next }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ conversationId: state.conversationId, lines: state.lines }))
  } catch {
    // 무시
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useChat() {
  return useSyncExternalStore(subscribe, () => state)
}

/** 남은 질문 횟수를 서버에서 다시 받아 온다 (시트를 열 때·답을 받은 뒤·크레딧을 산 뒤) */
export async function refreshChatQuota() {
  try {
    setState({ quota: await getChatQuota() })
  } catch {
    // 못 받아도 대화는 그대로 쓸 수 있다
  }
}

export async function sendChat(text: string) {
  const message = text.trim()
  if (!message || state.sending || !canAsk(state.quota)) return
  const conversationId = state.conversationId
  setState({ lines: [...state.lines, { from: 'me', text: message }], sending: true })
  try {
    const res = await askDuru(message, state.conversationId)
    if (state.conversationId !== conversationId) return
    if (USE_MOCK) spendMockQuestion()
    setState({
      lines: [
        ...state.lines,
        { from: 'duru', text: res.answer?.trim() || '관련 기록에서 답을 찾지 못했어요. 장소나 다른 기억으로 물어봐 주세요.', citations: res.citations, sources: res.sources, outcome: res.outcome ?? (!res.answer?.trim() ? 'INSUFFICIENT' : undefined) },
      ],
    })
  } catch (e) {
    if (state.conversationId !== conversationId) return
    const limited = e instanceof ApiError && (e.code === CHAT_LIMIT_CODE || e.status === 429)
    setState({
      lines: [
        ...state.lines,
        {
          from: 'duru',
          text: limited ? '오늘 물어볼 수 있는 횟수를 다 썼어요' : e instanceof ApiError && e.status === 503 ? '아직 기록을 정리 중이거나 두루 연결이 잠시 끊겼어요. 다른 질문을 해 보거나 잠시 후 다시 시도해 주세요.' : e instanceof ApiError && e.status === 401 ? '로그인이 만료됐어요. 다시 로그인한 뒤 물어봐 주세요.' : e instanceof ApiError && e.status === 409 ? '질문 중 기록이 바뀌었어요. 다시 물어봐 주세요.' : '지금은 답하지 못했어요. 다른 추천 질문을 골라 보거나 잠시 후 다시 물어봐 주세요',
          outcome: 'INSUFFICIENT',
        },
      ],
    })
  } finally {
    if (state.conversationId === conversationId) {
      setState({ sending: false })
      void refreshChatQuota()
    }
  }
}

/** 대화를 비우고 새로 시작한다 */
export function resetChat() {
  setState({ conversationId: crypto.randomUUID(), lines: [], sending: false, quota: null })
}

/** 계정의 데모 영역이 바뀌면 이전 영역의 화면·진행 중 답변을 비운다. */
export function syncChatScope(scope: string) {
  if (currentScope === scope) return
  currentScope = scope
  resetChat()
  try { sessionStorage.setItem('duruduru:chat-scope', scope) } catch { /* 저장소 사용 불가 */ }
}
