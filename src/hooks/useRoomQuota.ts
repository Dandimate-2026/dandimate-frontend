import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getRoomHome, requestPlanUpgrade } from '../api/rooms'
import type { PlanRequestReason, RoomHome } from '../api/types'
import { paths } from '../routes/paths'

/**
 * 플랜 한도를 확인하려고 모임방 홈 정보를 한 번 불러온다.
 * 불러오지 못하면 null로 두고, 한도는 서버가 422로 막을 때 알려 준다
 */
export function useRoomHomeForQuota(roomId: string, token: string | undefined) {
  const [home, setHome] = useState<RoomHome | null>(null)

  useEffect(() => {
    if (token === undefined) return
    getRoomHome(roomId, token)
      .then(setHome)
      .catch(() => {})
  }, [roomId, token])

  return home
}

/** 서버가 기능별 한도를 넘었다고 막은 응답인지 (422) */
export function isLimitError(e: unknown) {
  return typeof e === 'object' && e !== null && 'status' in e && (e as { status: number }).status === 422
}

/** 방장에게 한도를 늘려 달라고 단톡방 등으로 부탁하는 메시지를 보낸다 */
export async function askHost(text: string) {
  if (navigator.share) {
    await navigator.share({ text }).catch(() => {})
    return
  }
  await navigator.clipboard?.writeText(text).catch(() => {})
}

const ASK_TEXT: Record<PlanRequestReason, string> = {
  PHOTO: '사진을 더 올리고 싶어요',
  VOICE: '목소리로 더 남기고 싶어요',
  REWEAVE: '두루마리를 더 엮고 싶어요',
}

/**
 * 한도 시트의 플랜 버튼. 사진·말하기·재엮기 모두 같은 규칙을 쓴다.
 * - 방장: [플랜 보기] → 플랜 화면. 뒤로 가면 보던 화면으로 돌아온다
 * - 멤버: [방장에게 알리기] → 방장의 방 알림(🔔)으로 요청. 서버에서 보낼 수 없으면 공유창으로 직접 부탁한다
 */
export function usePlanLimitAction(
  roomId: string,
  home: RoomHome | null,
  reason: PlanRequestReason,
  /** 방장에게 알린 뒤 화면에 안내 문구를 띄울 때 */
  onAsked?: (message: string) => void,
) {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const isHost = home?.me.role === 'HOST'

  const action = isHost
    ? {
        label: '플랜 보기',
        onClick: () => navigate(paths.roomPlan(roomId), { state: { fromLimit: true } }),
      }
    : {
        label: '방장에게 알리기',
        onClick: () => {
          requestPlanUpgrade(roomId, reason)
            .then(() => {
              const message = '방장에게 알렸어요. 플랜이 바뀌면 바로 쓸 수 있어요'
              setNotice(message)
              onAsked?.(message)
            })
            .catch(() => askHost(`방장님, ${home?.room.name ?? '우리 방'}에서 ${ASK_TEXT[reason]}. 플랜을 바꿔 줄 수 있을까요?`))
        },
      }

  return { isHost, action, notice }
}
