import { useAppNavigate } from '../hooks/useAppNavigate'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { getAllNotifications, getNotifications, markNotificationRead } from '../api/notifications'
import type { NotificationType, RoomNotification } from '../api/types'
import { timeAgo } from '../lib/date'
import { getRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'

function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NOTIFICATION_TEXT: Record<NotificationType, { title: string; detail: string }> = {
  HOST_TRANSFERRED: { title: '방장이 바뀌었어요', detail: '새 방장을 확인해 주세요' },
  PHOTO_ADDON_ADDED: { title: '사진에 새 덧붙임이 달렸어요', detail: '친구의 이야기를 확인해 보세요' },
  ROOM_PLAN_UPGRADED: { title: '모임방 플랜이 변경됐어요', detail: '새 플랜으로 함께 기록해 보세요' },
  ASKBACK_RECEIVED: { title: '나에게 질문이 왔어요', detail: '한 문장만 답하면 이야기가 더 풍성해져요' },
  SCROLL_READY: { title: '두루마리가 완성됐어요', detail: '우리 이야기를 펼쳐 보세요' },
  REPLY_APPLIED: { title: '재엮기가 완료됐어요', detail: '바뀐 문단을 확인해 보세요' },
  PLAN_UPGRADE_REQUESTED: { title: '플랜을 바꿔 달라는 요청이 왔어요', detail: '친구가 더 남기고 싶어 해요' },
  ROOM_DELETION_DUE_30D: { title: '모임방 삭제 예정 안내', detail: '삭제 전에 필요한 기록을 저장해 주세요' },
  ROOM_DELETION_DUE_7D: { title: '모임방이 7일 뒤 삭제돼요', detail: '필요한 기록을 미리 저장해 주세요' },
  ROOM_DELETION_DUE_1D: { title: '모임방이 내일 삭제돼요', detail: '오늘 안에 필요한 기록을 저장해 주세요' },
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
  const navigate = useAppNavigate()
  const global = !roomId
  const session = getRoomSession(roomId)
  const [items, setItems] = useState<RoomNotification[] | null>(null)
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(`duruduru:hidden-notifications:${roomId}`) ?? '[]') } catch { return [] } })
  const hide = (id: string) => setHidden(previous => { const next = [...previous, id]; try { localStorage.setItem(`duruduru:hidden-notifications:${roomId}`, JSON.stringify(next)) } catch { /* optional */ } return next })
  const [error, setError] = useState<string | null>(null)
  const token = global ? '' : session?.memberAccessToken
  const load = () => global ? getAllNotifications() : getNotifications(roomId, token ?? '')
  const sequence = useRef(0)

  const reload = () => {
    if (token === undefined) return
    const current = ++sequence.current
    load()
      .then((list) => {
        if (current !== sequence.current) return
        setItems([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setError(null)
      })
      .catch(() => { if (current === sequence.current) setError('알림을 불러오지 못했어요') })
  }
  useEffect(() => {
    if (token === undefined) return
    const requestState = sequence
    const current = ++requestState.current
    const fetchItems = () => !roomId ? getAllNotifications() : getNotifications(roomId, token)
    const update = () => { const requestId = ++requestState.current; void fetchItems().then(list => { if (requestId === requestState.current) { setItems([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setError(null) } }).catch(() => { if (requestId === requestState.current) setError('알림을 불러오지 못했어요') }) }
    const onVisible = () => { if (document.visibilityState === 'visible') update() }
    document.addEventListener('visibilitychange', onVisible)
    fetchItems().then(list => {
      if (current !== requestState.current) return
      setItems([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setError(null)
    }).catch(() => { if (current === requestState.current) setError('알림을 불러오지 못했어요') })
    return () => { requestState.current++; document.removeEventListener('visibilitychange', onVisible) }
  }, [roomId, token])
  useRoomLiveUpdates(roomId, global ? undefined : token, reload)

  if (!global && !session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (error && !items) return <main className="p-5 pt-16"><p role="alert">{error}</p><button type="button" onClick={reload}>다시 불러오기</button></main>
  if (!items) return <main className="flex-1 bg-bg" aria-busy="true" />

  const handleOpen = (item: RoomNotification) => {
    const targetRoomId = item.roomId ?? roomId
    if (!targetRoomId) { setError('이 알림의 모임방을 찾을 수 없어요'); return }
    // 읽음 표시가 실패해도 이동은 막지 않는다
    if (!item.readAt) markNotificationRead(item.id, getRoomSession(targetRoomId)?.memberAccessToken ?? '').catch(() => {})
    if (item.type === 'ASKBACK_RECEIVED') navigate(paths.askback(targetRoomId, item.resourceId))
    // 방장이 플랜 변경 요청을 누르면 플랜 화면으로 간다
    else if (item.type === 'PLAN_UPGRADE_REQUESTED') navigate(paths.roomPlan(targetRoomId))
    else if (item.type === 'PHOTO_ADDON_ADDED') navigate(paths.roomCirculation(targetRoomId, item.resourceType.toUpperCase() === 'PHOTO' ? item.resourceId : undefined))
    else if (item.type === 'HOST_TRANSFERRED') navigate(paths.roomSettings(targetRoomId))
    else if (item.type === 'ROOM_PLAN_UPGRADED') navigate(paths.roomPlan(targetRoomId))
    else if (item.type.startsWith('ROOM_DELETION_DUE_')) navigate(paths.roomHome(targetRoomId))
    else navigate(paths.roomWeaving(targetRoomId))
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => navigate(global ? paths.roomList() : paths.roomHome(roomId))}
          className="flex items-center gap-2.5 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          {global ? '전체 알림' : '알림'}
        </button>
        <button type="button" onClick={reload} className="min-h-11 px-3 text-[12px] font-semibold text-sub">새로고침</button>
      </header>
      {error && <p role="alert" className="mt-3 text-[12px] text-point">{error}</p>}

      {items.filter(item => !hidden.includes(item.id)).length === 0 ? (
        <p className="mt-24 text-center text-[13px] text-sub">아직 온 알림이 없어요</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {items.filter(item => !hidden.includes(item.id)).map((item) => {
            const text = NOTIFICATION_TEXT[item.type] ?? { title: '새 소식이 있어요', detail: '방의 소식을 확인해 주세요' }
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
                    {global && item.roomName && <span className="mt-1 block text-[11px] font-semibold text-point">{item.roomName}</span>}
                    <span className="mt-0.5 block text-[11px] text-sub">
                      {item.message || (item.type === 'PLAN_UPGRADE_REQUESTED' && PLAN_REQUEST_DETAIL[item.resourceType]) || text.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-sub">{timeAgo(item.createdAt)}</span>
                  {unread && <span className="sr-only">안 읽음</span>}
                </button>
                <button type="button" onClick={() => hide(item.id)} className="mt-1 min-h-9 px-3 text-[11px] text-sub underline underline-offset-2" aria-label="이 알림을 이 기기에서 숨기기">이 기기에서 숨기기</button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default RoomNotificationsPage
