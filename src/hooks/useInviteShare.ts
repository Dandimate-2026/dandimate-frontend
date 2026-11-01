import { useState } from 'react'
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
    // TODO: Kakao JS SDK(Kakao.Share) 연동. 우선 기기 공유 시트로 대체
    if (navigator.share) {
      await navigator.share({ text, url: link }).catch(() => {})
    } else {
      await copy(text)
    }
  }

  return { link, copied, copy, share }
}
