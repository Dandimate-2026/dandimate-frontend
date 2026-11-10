import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { getRoomHome, requestPlanUpgrade } from '../api/rooms'
import type { PlanRequestReason, RoomHome, RoomQuota } from '../api/types'
import { paths } from '../routes/paths'
import type { PlanId } from '../lib/plans'
import { useRoomLiveUpdates } from './useRoomLiveUpdates'

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
  useRoomLiveUpdates(roomId, token, () => {
    if (token !== undefined) void getRoomHome(roomId, token).then(setHome).catch(() => {})
  })

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
  const location = useLocation()
  const [notice, setNotice] = useState<string | null>(null)
  const isHost = home?.me.role === 'HOST'
  const isPro = home?.room.planType === 'PRO'
  const returnPath = location.pathname + location.search

  const action = isPro
    ? { label: '확인', onClick: () => {} }
    : isHost
    ? {
        label: '플랜보기',
        onClick: () => navigate(paths.roomPlan(roomId), { state: { fromLimit: true, returnPath } }),
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
            .catch(() => { const message = '방장에게 요청을 보내지 못했어요. 잠시 후 다시 눌러 주세요'; setNotice(message); onAsked?.(message) })
        },
      }

  const onSelectPlan = isHost && !isPro ? (plan: PlanId) => {
    const current = (home?.room.planType ?? 'FREE').toLowerCase()
    if (['free', 'lite', 'pro'].indexOf(plan) <= ['free', 'lite', 'pro'].indexOf(current)) return
    navigate(paths.roomPlan(roomId), { state: { fromLimit: true, returnPath, selectedPlan: plan } })
  } : undefined

  return { isHost, action, notice, onSelectPlan }
}

// 서버가 한도를 알려 주지 않으면 가장 짧은 Free 기준으로 막는다. 길게 녹음했다가 서버에서 거절당하지 않도록
const FREE_FIRST_MAX_SECONDS = 30
const FREE_OTHER_MAX_SECONDS = 20

/** 녹음 최대 길이(ms). 첫 한마디는 플랜별 30/60/120초, 덧붙임·되묻기 답변·답가는 20/30/60초 */
export function voiceMaxMs(quota: RoomQuota | undefined, kind: 'first' | 'other') {
  const seconds =
    kind === 'first'
      ? (quota?.firstMaxSeconds ?? FREE_FIRST_MAX_SECONDS)
      : (quota?.otherMaxSeconds ?? FREE_OTHER_MAX_SECONDS)
  return seconds * 1000
}

/** 60000 → '1분', 30000 → '30초', 90000 → '1분 30초' */
export function formatVoiceLimit(ms: number) {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds}초`
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`
}
