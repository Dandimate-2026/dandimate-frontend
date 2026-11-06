import { useState } from 'react'
import { copyForShare, shareWithDevice } from '../lib/share'
import { inviteUrl } from '../lib/session'

export const DEFAULT_SHARE_MESSAGE = '두루두루 열었어! 사진 올리고 한마디 남겨줘'

/** 초대 링크를 문구와 함께 복사하거나 공유한다 */
export function useInviteShare(inviteToken: string) {
  const [copied, setCopied] = useState(false)
  const link = inviteUrl(inviteToken)

  const copy = async (text = DEFAULT_SHARE_MESSAGE) => {
    await navigator.clipboard.writeText(`${text}
${link}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async (text = DEFAULT_SHARE_MESSAGE) => {
    // 휴대폰: 기기 공유 시트(카톡 선택)로 글+링크를 그대로 보낸다. 복사해서 붙여넣는 것과 같아 링크가 항상 살아 있다
    // 공유 시트가 없으면(PC 등) 글+링크를 복사한다
    if (await shareWithDevice(text, link)) return
    await copyForShare(text, link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return { link, copied, copy, share }
}
