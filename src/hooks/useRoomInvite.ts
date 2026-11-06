import { useEffect, useState } from 'react'
import { getRoomInvite } from '../api/rooms'
import { getRoomSession, saveRoomSession } from '../lib/session'

/**
 * 이 방의 고정 초대 토큰. 이 기기에 있으면 그걸 쓰고, 없으면(다른 기기에서 들어온 경우) 서버에서 받아 기억해 둔다.
 * 초대 링크는 바뀌지 않아서 방 참가자 누구나 같은 링크를 공유할 수 있다
 */
export function useRoomInvite(roomId: string) {
  const [inviteToken, setInviteToken] = useState(() => getRoomSession(roomId)?.inviteToken)

  useEffect(() => {
    if (inviteToken || !roomId) return
    let active = true
    getRoomInvite(roomId)
      .then((token) => {
        if (!active || !token) return
        const session = getRoomSession(roomId)
        saveRoomSession(roomId, { memberAccessToken: '', ...session, inviteToken: token })
        setInviteToken(token)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [roomId, inviteToken])

  return inviteToken
}
