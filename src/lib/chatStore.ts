// 두루 챗봇 대화. 시트를 내렸다 다시 열어도 이어지도록 화면 밖(모듈)에 두고,
// 새로고침해도 남도록 이 탭의 sessionStorage에도 적어 둔다. 답을 기다리는 중에 시트를 내려도 답은 들어온다
import { useSyncExternalStore } from 'react'
import { askDuru, type ChatCitation, type ChatSource } from '../api/recordMap'

export interface ChatLine {
  from: 'me' | 'duru'
  text: string
  citations?: ChatCitation[]
  sources?: ChatSource[]
}

interface ChatState {
  conversationId: string
  lines: ChatLine[]
  sending: boolean
}

const STORAGE_KEY = 'duruduru:chat'

function load(): ChatState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Omit<ChatState, 'sending'>
      return { ...saved, sending: false }
    }
  } catch {
    // 저장소를 못 쓰면 새 대화로 시작한다
  }
  return { conversationId: crypto.randomUUID(), lines: [], sending: false }
}

let state: ChatState = load()
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

export async function sendChat(text: string) {
  const message = text.trim()
  if (!message || state.sending) return
  setState({ lines: [...state.lines, { from: 'me', text: message }], sending: true })
  try {
    const res = await askDuru(message, state.conversationId)
    setState({
      lines: [...state.lines, { from: 'duru', text: res.answer, citations: res.citations, sources: res.sources }],
    })
  } catch {
    setState({ lines: [...state.lines, { from: 'duru', text: '지금은 답하지 못했어요. 잠시 후 다시 물어봐 주세요' }] })
  } finally {
    setState({ sending: false })
  }
}

/** 대화를 비우고 새로 시작한다 */
export function resetChat() {
  setState({ conversationId: crypto.randomUUID(), lines: [], sending: false })
}
