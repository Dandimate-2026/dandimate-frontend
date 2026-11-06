
// 두루 몸통: 흰 꽃잎 5장 (가운데 18.5, 꽃잎 중심까지 4.6)
const BOT_PETALS = [
  [15, 13.9],
  [19.37, 17.08],
  [17.7, 22.22],
  [12.3, 22.22],
  [10.63, 17.08],
]

/** 두루 얼굴: 안테나 + 흰 꽃 몸통 + 검은 화면에 민트색 눈 */
export function BotIcon() {
  return (
    // 안테나 끝(2.5)~꽃잎 아래(26.6)를 원 가운데에 두되, 시안처럼 아주 살짝 위로 올리고 여백 없이 잘라 크게 보이게 한다
    <svg width="36" height="36" viewBox="2.5 2.9 25 25" fill="none" aria-hidden="true">
      <circle cx="15" cy="4.2" r="1.7" fill="white" />
      <path d="M15 5.5v5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      {BOT_PETALS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.4" fill="white" />
      ))}
      <circle cx="15" cy="18.5" r="5" fill="white" />
      <rect x="10.1" y="14.7" width="9.8" height="5.2" rx="2.6" fill="#2a2623" />
      <circle cx="13" cy="17.3" r="1.15" fill="#9be6d2" />
      <circle cx="17" cy="17.3" r="1.15" fill="#9be6d2" />
    </svg>
  )
}

/** 모임방 목록 위에 떠 있는 두루 챗봇 버튼과 말풍선 */
function ChatFab({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[430px] items-center justify-end gap-2 px-5">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto rounded-[14px] border border-line bg-surface px-3.5 py-2 text-left shadow-[0_4px_16px_rgba(42,38,35,0.08)]"
      >
        <span className="block text-[13px] font-bold">두루에게 우리 추억을 물어보세요</span>
        <span className="mt-0.5 block text-[11px] text-sub">“부산에서 누가 제일 많이 웃었지?”</span>
      </button>
      <button
        type="button"
        aria-label="두루에게 물어보기"
        onClick={onOpen}
        className="pointer-events-auto flex size-[58px] shrink-0 items-center justify-center rounded-full bg-point shadow-[0_6px_18px_rgba(160,60,100,0.35)] active:opacity-90"
      >
        <BotIcon />
      </button>
    </div>
  )
}

export default ChatFab
