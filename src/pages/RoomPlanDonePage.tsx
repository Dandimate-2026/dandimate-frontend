import { useNavigate, useParams, useSearchParams } from 'react-router'
import Button from '../components/Button'
import Flower from '../components/Flower'
import { useInviteShare } from '../hooks/useInviteShare'
import { FREE_PLAN, findPlan, subjectParticle } from '../lib/plans'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'
import { USE_MOCK } from '../api/mock'
import { PAYMENT_DEMO } from '../api/plans'

/** 결제를 마친 뒤 바뀐 한도를 보여주고, 친구를 부르러 보낸다 */
function RoomPlanDonePage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const plan = findPlan(searchParams.get('plan'))
  const { share } = useInviteShare(session?.inviteToken ?? '')

  if (!session) return <NotFoundPage message="모임방을 찾을 수 없어요" />
  if (!plan) return <NotFoundPage message="플랜을 찾을 수 없어요" />

  const changes = [
    { label: '1인당 사진', value: `${FREE_PLAN.photosPerMember}장 → ${plan.photosPerMember}장` },
    { label: '말하기 총량', value: `${FREE_PLAN.voiceMinutes}분 → ${plan.voiceMinutes}분` },
    { label: '재엮기', value: `${FREE_PLAN.reweaves}회 → ${plan.reweaves}회` },
    { label: '꾸미기', value: plan.decor },
  ]

  return (
    // 시안(780) 기준 위 여백 180px, 화면이 낮아지는 만큼 여백부터 줄여 한 화면에 들어오게 한다
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-[clamp(56px,calc(100dvh-600px),180px)] pb-8 text-ink">
      <div className="flex items-center justify-center gap-1" aria-hidden="true">
        <Flower code="AZALEA" size={34} />
        <Flower code="ROYAL_AZALEA" size={44} />
        <Flower code="FORGET_ME_NOT" size={34} />
      </div>
      <h1 className="mt-[18px] text-center text-[24px] leading-[30px] font-bold">
        {session.roomName}
        {subjectParticle(session.roomName ?? '')}
        <br />
        {plan.name} 플랜이 됐어요
      </h1>
      <p className="mt-2.5 text-center text-[13px] text-sub">친구들도 지금 바로 더 많이 올릴 수 있어요</p>
      {/* 결제 API가 없어 실제 서버의 방은 Free 그대로라서, 시연 중임을 알려 둔다 */}
      {!USE_MOCK && PAYMENT_DEMO && (
        <p className="mt-1 text-center text-[11px] text-[#9a9085]">시연용 화면이에요. 실제 한도는 아직 Free예요.</p>
      )}

      <dl className="mt-6 flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface px-[15px] py-4">
        {changes.map((c) => (
          <div key={c.label} className="flex items-center justify-between text-[13px]">
            <dt className="text-sub">{c.label}</dt>
            <dd className="font-bold">{c.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="mt-auto flex flex-col gap-3 pt-8">
        {/* 방을 막 만든 참이라 아직 친구가 없다. 바로 공유하거나 초대 링크 화면으로 간다 */}
        <button
          type="button"
          onClick={() => share()}
          className="h-11 rounded-full border border-line bg-surface text-[15px] font-semibold active:opacity-80"
        >
          단톡방에 알리기
        </button>
        <Button onClick={() => navigate(paths.roomShare(roomId), { replace: true })} className="w-full">
          방으로 돌아가기
        </Button>
      </footer>
    </main>
  )
}

export default RoomPlanDonePage
