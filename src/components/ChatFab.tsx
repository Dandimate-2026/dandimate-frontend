import { useNavigate } from 'react-router'
import { paths } from '../routes/paths'

function BotIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <circle cx="15" cy="5" r="2" fill="white" />
      <path d="M15 7v3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5" y="10" width="20" height="14" rx="7" fill="white" />
      <rect x="9" y="14.5" width="12" height="5.5" rx="2.75" fill="#2a2623" />
      <circle cx="12.5" cy="17.25" r="1.2" fill="white" />
      <circle cx="17.5" cy="17.25" r="1.2" fill="white" />
    </svg>
  )
}

/** 모임방 목록 위에 떠 있는 두루 챗봇 버튼과 말풍선 */
function ChatFab() {
  const navigate = useNavigate()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[430px] items-center justify-end gap-2 px-5">
      <button
        type="button"
        onClick={() => navigate(paths.chat())}
        className="pointer-events-auto rounded-[14px] border border-line bg-surface px-3.5 py-2 text-left shadow-[0_4px_16px_rgba(42,38,35,0.08)]"
      >
        <span className="block text-[13px] font-bold">두루에게 우리 추억을 물어보세요</span>
        <span className="mt-0.5 block text-[11px] text-sub">“부산에서 누가 제일 많이 웃었지?”</span>
      </button>
      <button
        type="button"
        aria-label="두루에게 물어보기"
        onClick={() => navigate(paths.chat())}
        className="pointer-events-auto flex size-[58px] shrink-0 items-center justify-center rounded-full bg-point shadow-[0_6px_18px_rgba(160,60,100,0.35)] active:opacity-90"
      >
        <BotIcon />
      </button>
    </div>
  )
}

export default ChatFab
