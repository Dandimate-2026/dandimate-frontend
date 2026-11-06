import { useEffect, useRef } from 'react'
import { devProxyUrl } from '../api/client'
import { USE_MOCK } from '../api/mock'
import { issueEventToken } from '../api/notifications'

/**
 * 실시간 연결(SSE)이 끊겼을 때만 이 간격으로 다시 불러온다.
 * 화면이 가려져 있으면 확인하지 않는다
 */
const POLL_INTERVAL_MS = 2000

/**
 * 서버가 보내는 이름 붙은 SSE 이벤트 (백엔드 RoomEvents 기준).
 * 이름 붙은 이벤트는 EventSource.onmessage로 들어오지 않아서 이름마다 따로 듣는다
 */
const ROOM_EVENT_NAMES = [
  'photo.published',
  'photo.uploaded',
  'entry.created',
  'askback.created',
  'job.updated',
  'scroll.ready',
  'paragraph.updated',
  'notification.created',
  'askback.updated',
  // 친구가 들어오거나 나가거나, 이름·방장이 바뀌거나, 방 설정·플랜이 바뀌면 온다
  'member.joined',
  'member.left',
  'member.updated',
  'room.updated',
]

/**
 * 방에 변화가 생기면 onChange를 부른다.
 * 서버 이벤트(SSE)로 바로 받고, 연결이 안 되거나 끊기면 화면을 보는 동안 2초마다 확인한다.
 * 앱으로 돌아오면 바로 한 번 확인한다
 */
export function useRoomLiveUpdates(roomId: string, token: string | undefined, onChange: () => void) {
  // 매 렌더마다 바뀌는 콜백을 다시 연결하지 않도록 최신 값만 기억해 둔다
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (USE_MOCK || token === undefined) return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopped = false
    const refresh = () => onChangeRef.current()

    // 실시간 연결이 안 될 때만 짧게 확인한다. 다른 앱·탭으로 가 있는 동안에는 서버에 묻지 않는다
    const fallBackToPolling = () => {
      source?.close()
      source = null
      if (stopped || timer) return
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refresh()
      }, POLL_INTERVAL_MS)
    }

    issueEventToken(roomId, token)
      .then(({ eventsUrl }) => {
        if (stopped) return
        source = new EventSource(devProxyUrl(eventsUrl), { withCredentials: true })
        ROOM_EVENT_NAMES.forEach((name) => source?.addEventListener(name, refresh))
        // 이름 없이 오는 이벤트가 생겨도 다시 불러온다
        source.onmessage = refresh
        source.onerror = fallBackToPolling
      })
      .catch(fallBackToPolling)

    // 다른 앱·탭에 갔다가 돌아오면 바로 한 번 확인한다
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      stopped = true
      source?.close()
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [roomId, token])
}
