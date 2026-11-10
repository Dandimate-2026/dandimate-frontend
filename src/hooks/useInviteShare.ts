import { useEffect, useState } from 'react'
import { roomShareCopy, shareRoomContent, showToast, type RoomShareContext } from '../lib/share'
import { prepareKakaoShare } from '../lib/kakaoShare'
import { inviteUrl } from '../lib/session'

/** Explicit copy always copies only the URL. Sharing includes context and the optional message. */
export function useInviteShare(inviteToken: string, roomName = '', context: RoomShareContext = 'invite', targetUrl?: string) {
  const [copied, setCopied] = useState(false)
  const link = targetUrl ?? inviteUrl(inviteToken)
  const defaultMessage = roomShareCopy(context, roomName).text
  useEffect(() => { void prepareKakaoShare().catch(() => {}) }, [])
  const ready = () => {
    if (inviteToken || targetUrl) return true
    showToast('공유 링크를 준비하고 있어요. 잠시 후 다시 눌러 주세요')
    return false
  }
  const copy = async () => {
    if (!ready()) return
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { showToast('링크를 복사하지 못했어요. 다시 시도해 주세요') }
  }
  const share = async (text = defaultMessage) => {
    if (ready()) await shareRoomContent(context, roomName, link, text)
  }
  return { link, copied, copy, share, defaultMessage }
}
