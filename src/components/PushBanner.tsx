import { useEffect, useState } from 'react'
import { dismissPushBanner, enablePush, getPushState, isPushBannerDismissed, isPushEnabled, type PushState } from '../lib/push'

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

/**
 * 모임방 목록 위 알림 안내.
 * - 아직 안 켰으면: "새 이야기가 오면 알려 드릴까요?" [알림 켜기]
 * - 아이폰 사파리: 홈 화면에 추가하면 알림을 받을 수 있다고 안내
 * 이미 켰거나, 막았거나, 닫았으면 보이지 않는다
 */
function PushBanner() {
  const [state] = useState<PushState>(getPushState)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [hidden, setHidden] = useState(isPushBannerDismissed)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    isPushEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(false))
  }, [])

  if (hidden || enabled !== false || state === 'denied' || state === 'unsupported') return null

  const close = () => {
    dismissPushBanner()
    setHidden(true)
  }

  const turnOn = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await enablePush()
      setMessage('알림을 켰어요. 새 이야기가 오면 알려 드릴게요')
      setTimeout(() => setHidden(true), 2500)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '알림을 켜지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative mt-4 flex items-start gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5" aria-label="알림 받기">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fbe9f0] text-point">
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1 pr-5">
        {state === 'ios-needs-install' ? (
          <>
            <p className="text-[14px] font-bold">홈 화면에 추가하면 알림을 받을 수 있어요</p>
            <p className="mt-1 text-[12px] leading-[18px] text-sub">
              사파리 아래쪽 공유 버튼 → <b className="font-semibold text-ink">홈 화면에 추가</b>를 누른 뒤,
              <br />
              홈 화면의 두루두루로 들어와 알림을 켜 주세요
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold">새 이야기가 오면 알려 드릴까요?</p>
            <p className="mt-1 text-[12px] leading-[18px] text-sub">친구가 덧붙이거나, 두루마리가 완성되면 바로 알려 드려요</p>
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={busy}
              className="mt-2.5 h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-surface active:opacity-80 disabled:opacity-50"
            >
              {busy ? '켜는 중…' : '알림 켜기'}
            </button>
          </>
        )}
        {message && (
          <p className="mt-2 text-[12px] text-point" role="status">
            {message}
          </p>
        )}
      </div>
      <button type="button" onClick={close} aria-label="닫기" className="absolute top-2.5 right-3 p-1 text-[16px] text-sub">
        ×
      </button>
    </section>
  )
}

export default PushBanner
