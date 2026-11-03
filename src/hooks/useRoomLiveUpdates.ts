import { useEffect, useRef } from 'react'
import { USE_MOCK } from '../api/mock'
import { issueEventToken } from '../api/notifications'

const POLL_INTERVAL_MS = 5000

/**
 * 방에 변화가 생기면 onChange를 부른다.
 * 서버 이벤트(SSE)에 먼저 붙고, 연결이 안 되거나 끊기면 명세대로 5초마다 부르는 방식으로 바꾼다
 */
export function useRoomLiveUpdates(roomId: string, token: string | undefined, onChange: () => void) {
  // 매 렌더마다 바뀌는 콜백을 다시 연결하지 않도록 최신 값만 기억해 둔다
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (USE_MOCK || !token) return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopped = false

    const startPolling = () => {
      source?.close()
      source = null
      if (stopped || timer) return
      timer = setInterval(() => onChangeRef.current(), POLL_INTERVAL_MS)
    }

    issueEventToken(roomId, token)
      .then(({ eventsUrl }) => {
        if (stopped) return
        source = new EventSource(eventsUrl)
        // 이벤트 이름과 상관없이 무언가 오면 다시 불러온다
        source.onmessage = () => onChangeRef.current()
        source.onerror = startPolling
      })
      .catch(startPolling)

    return () => {
      stopped = true
      source?.close()
      if (timer) clearInterval(timer)
    }
  }, [roomId, token])
}
