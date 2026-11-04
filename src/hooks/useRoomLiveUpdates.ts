import { useEffect, useRef } from 'react'
import { USE_MOCK } from '../api/mock'
import { issueEventToken } from '../api/notifications'

/** SSE를 쓸 수 없을 때 다시 불러오는 간격 (명세: 5초) */
const POLL_INTERVAL_MS = 5000
/**
 * SSE가 연결돼 있어도 이 간격으로 한 번씩 다시 불러온다.
 * 서버가 친구 입장처럼 이벤트로 알려 주지 않는 변화가 있어서다 (2026-11 백엔드 기준 입장 이벤트 없음)
 */
const SAFETY_POLL_INTERVAL_MS = 10000

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
]

/**
 * 방에 변화가 생기면 onChange를 부른다.
 * 서버 이벤트(SSE)에 붙고, 이벤트가 없는 변화(친구 입장 등)는 10초마다 확인한다.
 * SSE에 붙지 못하거나 끊기면 명세대로 5초마다 확인한다. 앱으로 돌아오면 바로 한 번 확인한다
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

    const poll = (intervalMs: number) => {
      if (timer) clearInterval(timer)
      timer = setInterval(refresh, intervalMs)
    }

    const fallBackToPolling = () => {
      source?.close()
      source = null
      if (!stopped) poll(POLL_INTERVAL_MS)
    }

    // 연결되기 전에도 바뀐 걸 놓치지 않도록 우선 확인을 시작한다
    poll(SAFETY_POLL_INTERVAL_MS)

    issueEventToken(roomId, token)
      .then(({ eventsUrl }) => {
        if (stopped) return
        source = new EventSource(eventsUrl, { withCredentials: true })
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
