import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { getRoomHome } from '../api/rooms'
import Button from '../components/Button'
import Flower from '../components/Flower'
import { useInviteShare } from '../hooks/useInviteShare'
import { usePlans } from '../hooks/usePlans'
import { subjectParticle } from '../lib/plans'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'
import { USE_MOCK } from '../api/mock'
import { PAYMENT_DEMO } from '../api/plans'
import { useRoomInvite } from '../hooks/useRoomInvite'

/** 결제를 마친 뒤 바뀐 한도를 보여주고, 친구를 부르러 보낸다 */
function RoomPlanDonePage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const savedRoomName = session?.roomName
  const plans = usePlans()
  const plan = plans.find((item) => item.id === searchParams.get('plan'))
  const freePlan = plans.find((item) => item.id === 'free')!
  const [roomName, setRoomName] = useState(session?.roomName)
  const memberAccessToken = session?.memberAccessToken
  const inviteToken = useRoomInvite(roomId)
  const { share, copied } = useInviteShare(inviteToken ?? '')

  useEffect(() => {
    if (!roomId || memberAccessToken === undefined || savedRoomName) return
    let cancelled = false
    getRoomHome(roomId, memberAccessToken).then((home) => {
      if (!cancelled) setRoomName(home.room.name)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [roomId, memberAccessToken, savedRoomName])

  if (!session) return <NotFoundPage message="모임방을 찾을 수 없어요" />
  if (!plan) return <NotFoundPage message="플랜을 찾을 수 없어요" />

  const changes = [
    { label: '1인당 사진', before: `${freePlan.photosPerMember}장`, after: `${plan.photosPerMember}장` },
    { label: '말하기 총량', before: `${freePlan.voiceMinutes}분`, after: `${plan.voiceMinutes}분` },
    { label: '재엮기', before: `${freePlan.reweaves}회`, after: `${plan.reweaves}회` },
    { label: '꾸미기', before: '기본', after: plan.id === 'lite' ? '일반 전부' : '일반 + 특별' },
  ]

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg px-[22px] pt-[clamp(80px,calc(100dvh-514px),266px)] pb-10 text-ink">
      <div className="flex items-center justify-center gap-0.5" aria-hidden="true">
        <Flower code="AZALEA" size={26} />
        <Flower code="FORGET_ME_NOT" size={26} />
        <Flower code="FORSYTHIA" size={26} />
      </div>
      <h1 className="mt-2 text-center text-[24px] leading-[30px] font-bold break-keep">
        {roomName ?? '모임방'}
        {subjectParticle(roomName ?? '모임방')}
        <br />
        {plan.name} 플랜이 됐어요
      </h1>
      <p className="mt-1 text-center text-[13px] leading-[18px] text-sub">친구들도 지금 바로 더 많이 올릴 수 있어요</p>
      {/* 결제 API가 없어 실제 서버의 방은 Free 그대로라서, 시연 중임을 알려 둔다 */}
      {!USE_MOCK && PAYMENT_DEMO && (
        <p className="mt-1 text-center text-[11px] text-[#9a9085]">시연용 화면이에요. 실제 한도는 아직 Free예요.</p>
      )}

      <dl className="mt-3 flex flex-col gap-1.5 rounded-[20px] border border-line bg-surface px-6 py-4">
        {changes.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-3 text-[12px] leading-[18px]">
            <dt className="text-sub">{c.label}</dt>
            <dd className="text-right">{c.before} → <span className="font-semibold text-point">{c.after}</span></dd>
          </div>
        ))}
      </dl>

      <footer className="mx-[6px] mt-auto flex flex-col gap-[10px] pt-8">
        {/* 방을 막 만든 참이라 아직 친구가 없다. 바로 공유하거나 초대 링크 화면으로 간다 */}
        <button
          type="button"
          onClick={() => inviteToken ? void share() : navigate(paths.roomSettings(roomId))}
          className="h-[52px] rounded-full bg-surface text-[15px] font-semibold active:opacity-80"
        >
          {copied ? '초대 링크가 복사됐어요' : '단톡방에 알리기'}
        </button>
        <Button onClick={() => navigate(paths.roomHome(roomId), { replace: true })} className="w-full">
          방으로 돌아가기
        </Button>
      </footer>
    </main>
  )
}

export default RoomPlanDonePage
