import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getNotifications, markNotificationRead } from '../api/notifications'
import type { NotificationType, RoomNotification } from '../api/types'
import { timeAgo } from '../lib/date'
import { getRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'

function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NOTIFICATION_TEXT: Record<NotificationType, { title: string; detail: string }> = {
  ASKBACK_RECEIVED: { title: '나에게 질문이 왔어요', detail: '한 문장만 답하면 이야기가 더 풍성해져요' },
  SCROLL_READY: { title: '두루마리가 완성됐어요', detail: '우리 이야기를 펼쳐 보세요' },
  REPLY_APPLIED: { title: '답가가 두루마리에 엮였어요', detail: '바뀐 문단을 확인해 보세요' },
  PLAN_UPGRADE_REQUESTED: { title: '플랜을 바꿔 달라는 요청이 왔어요', detail: '친구가 더 남기고 싶어 해요' },
}

// 플랜 변경 요청은 어떤 한도 때문인지 설명을 바꿔 보여준다
const PLAN_REQUEST_DETAIL: Record<string, string> = {
  PHOTO: '친구가 사진을 더 올리고 싶어 해요',
  VOICE: '친구가 목소리로 더 남기고 싶어 해요',
  REWEAVE: '친구가 두루마리를 더 엮고 싶어 해요',
}

/** 모임방 알림: 받은 질문, 두루마리 완성, 답가 반영 */
function RoomNotificationsPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [items, setItems] = useState<RoomNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    getNotifications(roomId, session.memberAccessToken)
      .then((list) => setItems([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setError('알림을 불러오지 못했어요'))
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (error) return <NotFoundPage message={error} />
  if (!items) return <main className="flex-1 bg-bg" aria-busy="true" />

  const handleOpen = (item: RoomNotification) => {
    // 읽음 표시가 실패해도 이동은 막지 않는다
    if (!item.readAt) markNotificationRead(item.id, session.memberAccessToken).catch(() => {})
    if (item.type === 'ASKBACK_RECEIVED') navigate(paths.askback(roomId, item.resourceId))
    // 방장이 플랜 변경 요청을 누르면 플랜 화면으로 간다
    else if (item.type === 'PLAN_UPGRADE_REQUESTED') navigate(paths.roomPlan(roomId))
    else navigate(paths.roomWeaving(roomId))
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="px-1">
        <button
          type="button"
          onClick={() => navigate(paths.roomHome(roomId))}
          className="flex items-center gap-2.5 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          알림
        </button>
      </header>

      {items.length === 0 ? (
        <p className="mt-24 text-center text-[13px] text-sub">아직 온 알림이 없어요</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {items.map((item) => {
            const text = NOTIFICATION_TEXT[item.type]
            const unread = !item.readAt
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  className={`flex w-full items-start gap-3 rounded-[20px] border px-4 py-3.5 text-left active:opacity-80 ${
                    unread ? 'border-[#f0cfdc] bg-[#fbf0f4]' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${unread ? 'bg-point' : 'bg-transparent'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{text.title}</span>
                    <span className="mt-0.5 block text-[11px] text-sub">
                      {(item.type === 'PLAN_UPGRADE_REQUESTED' && PLAN_REQUEST_DETAIL[item.resourceType]) || text.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-sub">{timeAgo(item.createdAt)}</span>
                  {unread && <span className="sr-only">안 읽음</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default RoomNotificationsPage
