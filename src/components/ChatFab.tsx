import { useState } from 'react'
import duruBot from '../assets/duru-bot.webp'

/** 두루 캐릭터 그림 (꽃 모양 몸통의 로봇). size는 한 변 픽셀 */
export function BotIcon({ size = 44 }: { size?: number }) {
  return <img src={duruBot} alt="" width={size} height={size} draggable={false} className="select-none" aria-hidden="true" />
}

/** 모임방 목록 위에 떠 있는 두루 챗봇 버튼과 말풍선 */
function ChatFab({ onOpen }: { onOpen: () => void }) {
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('duruduru:bot-hint-dismissed') === '1' } catch { return false } })
  const open = () => { setDismissed(true); try { sessionStorage.setItem('duruduru:bot-hint-dismissed', '1') } catch { /* optional */ } onOpen() }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[430px] items-center justify-end gap-2 px-5">
      {!dismissed && <button
        type="button"
        onClick={open}
        className="pointer-events-auto rounded-[14px] border border-line bg-surface px-3.5 py-2 text-left shadow-[0_4px_16px_rgba(42,38,35,0.08)]"
      >
        <span className="block text-[13px] font-bold">두루에게 우리 추억을 물어보세요</span>
        <span className="mt-0.5 block text-[11px] text-sub">장소와 함께 물어보면 더 잘 찾아요</span>
      </button>}
      <button
        type="button"
        aria-label="두루에게 물어보기"
        onClick={open}
        className="pointer-events-auto flex size-[62px] shrink-0 items-center justify-center rounded-full bg-point shadow-[0_6px_18px_rgba(160,60,100,0.35)] active:opacity-90"
      >
        {/* 안테나 때문에 아래로 처져 보여서 살짝 올린다 */}
        <span className="-mt-1.5 flex">
          <BotIcon size={44} />
        </span>
      </button>
    </div>
  )
}

/** 상점 아이콘: 쇼핑백 (선 아이콘) */
export function StoreIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  )
}

export default ChatFab
