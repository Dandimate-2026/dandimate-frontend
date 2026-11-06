import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { askDuru } from '../api/recordMap'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { paths } from '../routes/paths'

interface ChatLine {
  from: 'me' | 'duru'
  text: string
}

const MAX_MESSAGE_LENGTH = 2000
const SUGGESTIONS = ['부산에서 누가 제일 많이 웃었지?', '경주 여행에서 뭐 먹었더라?', '가장 최근 모임은 어땠어?']

/** 두루 챗봇: 내가 참여한 방의 기록을 바탕으로 답한다 */
function ChatPage() {
  const navigate = useNavigate()
  // 이 화면에 있는 동안 같은 대화로 이어서 묻는다
  const [conversationId] = useState(() => crypto.randomUUID())
  const [lines, setLines] = useState<ChatLine[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, sending])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    setLines((prev) => [...prev, { from: 'me', text: message }])
    setSending(true)
    try {
      const res = await askDuru(message, conversationId)
      setLines((prev) => [...prev, { from: 'duru', text: res.answer }])
    } catch {
      setLines((prev) => [...prev, { from: 'duru', text: '지금은 답하지 못했어요. 잠시 후 다시 물어봐 주세요' }])
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  const goBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (historyIndex > 0) navigate(-1)
    else navigate(paths.roomList(), { replace: true })
  }

  return (
    <main className="flex h-dvh flex-col bg-bg text-ink">
      <header className="flex items-center gap-2.5 px-5 pt-[clamp(40px,8dvh,64px)] pb-3">
        <button type="button" onClick={goBack} aria-label="뒤로 가기" className="flex h-6 w-6 items-center">
          <ChevronLeftIcon />
        </button>
        <h1 className="text-[16px] font-bold">두루에게 물어보기</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3" aria-live="polite">
        {lines.length === 0 && (
          <div className="pt-6">
            <p className="text-[20px] leading-7 font-bold">
              우리 추억,
              <br />
              뭐든 물어보세요
            </p>
            <p className="mt-2 text-[12px] text-sub">내가 함께한 모임방의 이야기로 답해요</p>
            <ul className="mt-5 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] active:opacity-80"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="flex flex-col gap-2.5">
          {lines.map((line, i) => (
            <li key={i} className={line.from === 'me' ? 'self-end' : 'self-start'}>
              <p
                className={`max-w-[80vw] rounded-[18px] px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap sm:max-w-[320px] ${
                  line.from === 'me' ? 'bg-ink text-surface' : 'border border-line bg-surface'
                }`}
              >
                {line.text}
              </p>
            </li>
          ))}
          {sending && (
            <li className="self-start rounded-[18px] border border-line bg-surface px-4 py-2.5 text-[14px] text-sub">
              기록을 찾아보고 있어요…
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="두루에게 물어보기"
          aria-label="두루에게 보낼 말"
          className="h-11 min-w-0 flex-1 rounded-full bg-bg px-4 text-[14px] outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="h-11 rounded-full bg-point px-4 text-[14px] font-semibold text-surface disabled:opacity-40"
        >
          보내기
        </button>
      </form>
    </main>
  )
}

export default ChatPage
