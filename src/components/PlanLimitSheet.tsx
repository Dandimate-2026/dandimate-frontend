import type { ReactNode } from 'react'
import type { RoomPlanType, RoomQuota } from '../api/types'
import { PLANS, type Plan } from '../lib/plans'
import { useSheetDrag } from '../hooks/useSheetDrag'

export type PlanLimitKind = 'photo' | 'voice' | 'reweave'

/** 사진 두 장이 겹친 아이콘 (시안) */
function PhotoIcon() {
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
      <path d="M2.73 14.54h1.62v1.5c0 1.79.9 2.7 2.73 2.7h13.19c1.81 0 2.73-.91 2.73-2.7V6.79c0-1.78-.92-2.69-2.73-2.69h-1.62V2.7C18.65.9 17.74 0 15.93 0H2.73C.91 0 0 .9 0 2.7v9.15c0 1.8.91 2.69 2.73 2.69Zm.03-1.4c-.87 0-1.36-.46-1.36-1.37v-9c0-.9.49-1.37 1.36-1.37H15.9c.86 0 1.35.47 1.35 1.37V4.1H7.08c-1.83 0-2.73.9-2.73 2.69v6.35H2.76Zm2.99-6.27c0-.9.48-1.37 1.35-1.37h13.14c.87 0 1.36.47 1.36 1.37v7.27l-3.19-3.01a1.28 1.28 0 0 0-1.3-.53c-.49 0-.9.17-1.31.52l-3.91 3.47-1.55-1.41a1.65 1.65 0 0 0-1.18-.5c-.39 0-.74.16-1.12.5l-2.28 1.98V6.87Zm4.72 4.47a2.05 2.05 0 1 0 0-4.11 2.05 2.05 0 0 0 0 4.11Z" />
    </svg>
  )
}

/** 마이크 아이콘 (시안) */
function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8.06" y="2.6" width="7.88" height="12.04" rx="3.94" fill="currentColor" />
      <path d="M18.73 9.38v2.01a6.73 6.73 0 0 1-13.46 0V9.38M12 18.25v4.11m0 0h2.88m-2.88 0H9.12" />
    </svg>
  )
}

/** 다시 엮기(화살표 두 개가 도는) 아이콘 (시안) */
function ReweaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M15.47 14.42c-.14.17-.3.34-.46.5a7.08 7.08 0 0 1-2.43 1.64c-1.89.8-4.08.8-5.97 0a7.15 7.15 0 0 1-4.07-4.08A7.37 7.37 0 0 1 1.93 9.5H.01c0 1.3.25 2.55.76 3.73a9.53 9.53 0 0 0 5.1 5.1 9.54 9.54 0 0 0 7.45 0 9.53 9.53 0 0 0 3.05-2.06c.16-.16.3-.33.46-.5l2.35 2.35V12.37h-5.75l2.04 2.04Zm.9-11.69A9.53 9.53 0 0 0 9.5.18c-1.28 0-2.55.26-3.73.75-1.14.48-2.17 1.18-3.05 2.05-.16.17-.3.34-.46.5L-.09.82v5.75h5.75L3.62 4.53c.14-.17.29-.34.46-.5a7.08 7.08 0 0 1 2.43-1.64c1.89-.8 4.08-.8 5.97 0a7.15 7.15 0 0 1 4.07 4.08c.4.95.6 1.94.6 2.98h1.92c0-1.3-.25-2.55-.76-3.73a9.6 9.6 0 0 0-2.05-3.05l.01.01Z" />
    </svg>
  )
}

const KIND: Record<PlanLimitKind, { icon: ReactNode; value: (plan: Plan) => string }> = {
  photo: { icon: <PhotoIcon />, value: (p) => `${p.photosPerMember}장` },
  voice: { icon: <MicIcon />, value: (p) => `${p.voiceMinutes}분` },
  reweave: { icon: <ReweaveIcon />, value: (p) => `${p.reweaves}회` },
}

const PILL_CLASS = 'h-[52px] w-full rounded-full text-[15px] font-bold active:opacity-80'

interface Action {
  label: string
  onClick: () => void
}

/**
 * 플랜 한도를 다 썼을 때 아래에서 올라오는 시트 (시안: 말하기·사진·재엮기).
 * 분홍 동그라미 아이콘 → 제목 → 설명 → (사용량 막대) → (플랜 비교 칸) → [플랜보기] → 글자 버튼
 */
function PlanLimitSheet({
  kind,
  title,
  description,
  usage,
  currentPlan,
  showPlans = true,
  primary,
  secondary,
  onClose,
}: {
  kind: PlanLimitKind
  title: ReactNode
  description: ReactNode
  /** 사용량 막대 (예: 방 전체 말하기 15/15분) */
  usage?: { label: string; value: string; ratio: number }
  currentPlan?: RoomPlanType
  showPlans?: boolean
  primary: Action
  secondary?: Action
  onClose: () => void
}) {
  const { icon, value } = KIND[kind]
  const current = (currentPlan ?? 'FREE').toLowerCase()
  const sheetDrag = useSheetDrag(onClose)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/45" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-limit-title"
        onClick={(e) => e.stopPropagation()}
        style={sheetDrag.sheetStyle}
        className="w-full max-w-[430px] rounded-t-[24px] bg-[#f3f3f1] px-[27px] pt-2.5 pb-7 text-ink"
      >
        <div {...sheetDrag.handleProps} className="-my-2 flex w-full justify-center py-2" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-[#e3dcd1]" />
        </div>
        <span className="mt-4 flex size-[54px] items-center justify-center rounded-full bg-[#f6e3ea] text-[#b03a6a]">
          {icon}
        </span>
        <h2 id="plan-limit-title" className="mt-5 text-[18px] leading-6 font-bold">
          {title}
        </h2>
        <p className="mt-2.5 text-[12px] leading-[18px] text-[#6b635b]">{description}</p>

        {usage && (
          <div className="mt-5 rounded-2xl bg-[#e3dcd1] px-[19px] py-3.5">
            <div className="flex items-center justify-between text-[12px] text-[#6b635b]">
              <span>{usage.label}</span>
              <span>{usage.value}</span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-[#b03a6a]"
                style={{ width: `${Math.min(Math.max(usage.ratio, 0), 1) * 100}%` }}
              />
            </div>
          </div>
        )}

        {showPlans && (
          <ul className={`${usage ? 'mt-2.5' : 'mt-5'} grid grid-cols-3 gap-[19px]`}>
            {PLANS.map((plan) => {
              const isCurrent = plan.id === current
              return (
                <li
                  key={plan.id}
                  aria-current={isCurrent || undefined}
                  className={`flex h-[71px] flex-col items-center justify-center rounded-xl border ${
                    isCurrent ? 'border-ink' : 'border-[#d5ccbf]'
                  }`}
                >
                  <span className="text-[12px] text-[#6b635b]">{plan.name}</span>
                  <span className="mt-0.5 text-[13px] font-semibold text-ink">{value(plan)}</span>
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" onClick={primary.onClick} className={`${PILL_CLASS} mt-2.5 bg-ink text-surface`}>
          {primary.label}
        </button>
        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            className="mt-4 w-full py-1 text-center text-[15px] font-semibold text-ink active:opacity-70"
          >
            {secondary.label}
          </button>
        )}
      </section>
    </div>
  )
}

/** 방 전체 말하기 시간을 다 썼을 때. 첫 한마디·되묻기 답하기·답가 녹음에서 같이 쓴다 */
export function VoiceLimitSheet({
  quota,
  onWriteText,
  planAction,
  onClose,
}: {
  quota?: RoomQuota
  onWriteText: () => void
  /** 방장은 [플랜보기], 멤버는 [방장에게 알리기] */
  planAction: Action
  onClose: () => void
}) {
  const limit = quota?.voiceLimitMs
  const used = quota?.voiceUsedMs ?? limit ?? 0
  return (
    <PlanLimitSheet
      kind="voice"
      title="말하기 시간을 모두 썼어요"
      description={
        <>
          글로는 계속 남길 수 있어요.
          <br />
          지금까지 남긴 목소리는 그대로 보관돼요
        </>
      }
      usage={
        limit
          ? { label: '방 전체 말하기', value: `${Math.round(used / 60000)}/${Math.round(limit / 60000)}분`, ratio: used / limit }
          : undefined
      }
      showPlans={false}
      primary={planAction}
      secondary={{ label: '글로 남기기', onClick: onWriteText }}
      onClose={onClose}
    />
  )
}

export default PlanLimitSheet
