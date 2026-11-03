import type { ReactNode } from 'react'
import type { RoomPlanType, RoomQuota } from '../api/types'
import { PLANS, type Plan } from '../lib/plans'
import Flower from './Flower'

export type PlanLimitKind = 'photo' | 'voice' | 'reweave'

function PhotoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M3.5 17.5l5-5 4 4 2.5-2.5 5.5 5" strokeLinejoin="round" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
    </svg>
  )
}

const KIND: Record<PlanLimitKind, { label: string; icon: ReactNode; value: (plan: Plan) => string }> = {
  photo: { label: '사진 한도', icon: <PhotoIcon />, value: (p) => `${p.photosPerMember}장` },
  voice: { label: '말하기 총량', icon: <MicIcon />, value: (p) => `${p.voiceMinutes}분` },
  reweave: { label: '재엮기 횟수', icon: <Flower code="ROYAL_AZALEA" size={30} />, value: (p) => `${p.reweaves}회` },
}

const PILL_CLASS = 'h-[52px] w-full rounded-full text-[15px] font-semibold active:opacity-80'

interface Action {
  label: string
  onClick: () => void
}

/**
 * 플랜 한도를 다 썼을 때 아래에서 올라오는 시트.
 * 아이콘 · 한도 이름 · 제목 · 설명, (있으면) 사용량 막대, 플랜 비교 칸 또는 버튼 두 개를 보여준다
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
  secondaryStyle = 'text',
  onClose,
}: {
  kind: PlanLimitKind
  title: ReactNode
  description: ReactNode
  /** 사용량 막대 (예: 방 전체 말하기 15분 / 15분) */
  usage?: { label: string; value: string; ratio: number }
  currentPlan?: RoomPlanType
  showPlans?: boolean
  primary: Action
  secondary?: Action
  /** 두 번째 버튼을 테두리 버튼으로 보일지, 글자 버튼으로 보일지 */
  secondaryStyle?: 'outline' | 'text'
  onClose: () => void
}) {
  const { label, icon, value } = KIND[kind]
  const current = (currentPlan ?? 'FREE').toLowerCase()

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-limit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-t-[28px] bg-surface px-6 pt-3 pb-7 text-ink"
      >
        <div className="flex justify-center">
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        </div>
        <span className="mt-5 flex size-[70px] items-center justify-center rounded-full bg-[#f6e3ea] text-point">
          {icon}
        </span>
        <p className="mt-4 text-[13px] font-semibold text-point">{label}</p>
        <h2 id="plan-limit-title" className="mt-1 text-[22px] leading-[30px] font-bold">
          {title}
        </h2>
        <p className="mt-3 text-[13px] leading-[21px] text-sub">{description}</p>

        {usage && (
          <div className="mt-5 rounded-2xl bg-bg px-5 py-4">
            <div className="flex items-center justify-between text-[13px]">
              <span>{usage.label}</span>
              <span className="font-bold">{usage.value}</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-point"
                style={{ width: `${Math.min(Math.max(usage.ratio, 0), 1) * 100}%` }}
              />
            </div>
          </div>
        )}

        {showPlans && (
          <ul className="mt-5 grid grid-cols-3 gap-2">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === current
              return (
                <li
                  key={plan.id}
                  className={`flex h-[110px] flex-col items-center justify-center rounded-2xl border ${
                    isCurrent ? 'border-ink' : 'border-line text-sub'
                  }`}
                >
                  <span className="text-[13px]">{plan.name}</span>
                  <span className={`mt-1 text-[18px] font-bold ${isCurrent ? 'text-ink' : 'text-sub'}`}>
                    {value(plan)}
                  </span>
                  {isCurrent && <span className="mt-1 text-[11px] font-semibold">지금</span>}
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" onClick={primary.onClick} className={`${PILL_CLASS} mt-6 bg-ink text-surface`}>
          {primary.label}
        </button>
        {secondary &&
          (secondaryStyle === 'outline' ? (
            <button
              type="button"
              onClick={secondary.onClick}
              className={`${PILL_CLASS} mt-2.5 border border-line bg-surface`}
            >
              {secondary.label}
            </button>
          ) : (
            <button
              type="button"
              onClick={secondary.onClick}
              className="mt-3 w-full py-1 text-center text-[13px] text-sub active:opacity-80"
            >
              {secondary.label}
            </button>
          ))}
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
  /** 방장은 [플랜 보기], 멤버는 [방장에게 알리기] */
  planAction: Action
  onClose: () => void
}) {
  return (
    <PlanLimitSheet
      kind="voice"
      title={
        <>
          이 방의 말하기 시간을
          <br />
          모두 썼어요
        </>
      }
      description={
        <>
          글로는 계속 남길 수 있어요.
          <br />
          지금까지 남긴 목소리는 그대로 보관돼요.
        </>
      }
      usage={
        quota?.voiceLimitMs
          ? {
              label: '방 전체 말하기',
              value: `${Math.round((quota.voiceUsedMs ?? 0) / 60000)}분 / ${Math.round(quota.voiceLimitMs / 60000)}분`,
              ratio: (quota.voiceUsedMs ?? 0) / quota.voiceLimitMs,
            }
          : undefined
      }
      showPlans={false}
      primary={{ label: '글로 남기기', onClick: onWriteText }}
      secondary={planAction}
      secondaryStyle="outline"
      onClose={onClose}
    />
  )
}

export default PlanLimitSheet
