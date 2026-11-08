import { useEffect, useState } from 'react'
import { copyForShare, shareWithDevice, showToast } from '../lib/share'
import { prepareKakaoShare, shareKakaoInvitation } from '../lib/kakaoShare'
import { inviteUrl } from '../lib/session'

export const DEFAULT_SHARE_MESSAGE = '두루두루 열었어! 사진 올리고 한마디 남겨줘'

/** 초대 링크를 문구와 함께 복사하거나 공유한다 */
export function useInviteShare(inviteToken: string) {
  const [copied, setCopied] = useState(false)
  const link = inviteUrl(inviteToken)

  useEffect(() => {
    void prepareKakaoShare().catch(() => {})
  }, [])

  const copy = async (text = DEFAULT_SHARE_MESSAGE) => {
    if (!inviteToken) { showToast('초대 링크를 준비하고 있어요. 잠시 후 다시 눌러 주세요'); return }
    await navigator.clipboard.writeText(`${text}
${link}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async (text = DEFAULT_SHARE_MESSAGE) => {
    if (!inviteToken) { showToast('초대 링크를 준비하고 있어요. 잠시 후 다시 눌러 주세요'); return }
    try {
      const result = shareKakaoInvitation(text, link)
      if (result === 'opened') return
      if (result === 'loading') {
        try {
          await prepareKakaoShare()
          showToast('공유 준비가 됐어요. 공유 버튼을 다시 눌러 주세요')
        } catch {
          await copyForShare(text, link, '카카오톡 공유를 열지 못해 초대 링크를 복사했어요. 단톡방에 붙여넣어 주세요')
        }
        return
      }
    } catch {
      await copyForShare(text, link, '카카오톡 공유를 열지 못해 초대 링크를 복사했어요. 단톡방에 붙여넣어 주세요')
      return
    }
    // 키가 없는 환경에서는 기기 공유창, 미지원 시 명시적인 복사 안내로 대체한다.
    if (await shareWithDevice(text, link)) return
    await copyForShare(text, link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return { link, copied, copy, share }
}
