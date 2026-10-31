import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Button from '../components/Button'
import Card from '../components/Card'
import { getRoomSession, inviteUrl } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'

const DEFAULT_SHARE_MESSAGE = '두루두루 열었어! 사진 올리고 한마디 남겨줘'
const MAX_MESSAGE_LENGTH = 50

function CopyIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
      <path d="M11 0H2.625a.125.125 0 0 0-.125.125V1c0 .069.056.125.125.125h7.75v10.75c0 .069.056.125.125.125h.875a.125.125 0 0 0 .125-.125V.5A.5.5 0 0 0 11 0Zm-2 2H1a.5.5 0 0 0-.5.5v8.292c0 .133.053.26.147.353l2.708 2.708a.5.5 0 0 0 .353.147H9a.5.5 0 0 0 .5-.5v-13A.5.5 0 0 0 9 2ZM3.469 12.378 2.123 11.03h1.346v1.347Zm4.906.497H4.469v-2.219a.625.625 0 0 0-.625-.625H1.625V3.125h6.75v9.75Z" />
    </svg>
  )
}

/** 방 생성 직후, 친구들에게 초대 링크를 공유하는 화면 */
function RoomSharePage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  // 원본 초대 토큰은 방 생성 응답에서 한 번만 받으므로 저장해 둔 값을 쓴다
  const session = getRoomSession(roomId)

  if (!session?.inviteToken) return <NotFoundPage message="초대 링크를 찾을 수 없어요" />
  const link = inviteUrl(session.inviteToken)
  // 비워두면 기본 문구로 보낸다
  const shareText = message.trim() || DEFAULT_SHARE_MESSAGE

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${link}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    // TODO: Kakao JS SDK(Kakao.Share) 연동. 우선 기기 공유 시트로 대체
    if (navigator.share) {
      await navigator.share({ text: shareText, url: link }).catch(() => {})
    } else {
      await handleCopy()
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 text-ink pt-[124px] pb-12">
      <h1 className="px-[6px] text-[24px] leading-[32px] font-bold">
        {session.roomName}
        <br />방이 열렸어요
      </h1>
      <p className="mt-[18px] px-2 text-[15px] leading-[19px] text-sub">
        48시간 뒤 첫 두루마리가 나와요.
        <br />
        지금 단톡방에 링크를 보내 주세요.
      </p>

      <Card className="mt-8">
        <p className="text-[11px] text-sub">초대 링크</p>
        <div className="mt-[10px] flex gap-3">
          <p className="flex h-[52px] flex-1 items-center truncate rounded-2xl bg-line px-[14px] text-[15px] text-sub">
            {link}
          </p>
          <Button variant="outline" onClick={handleCopy} className="flex h-[52px] w-[85px] items-center justify-center gap-1.5 text-[13px]">
            <CopyIcon />
            {copied ? '복사됨' : '복사'}
          </Button>
        </div>
        <div className="mt-[10px] rounded-2xl bg-bg px-3 py-[10px]">
          <div className="flex items-center justify-between">
            <label htmlFor="share-message" className="text-[9px] text-sub">
              같이 보낼 문구
            </label>
            <span className="text-[9px] text-sub">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
          <textarea
            id="share-message"
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={DEFAULT_SHARE_MESSAGE}
            className="mt-0.5 w-full resize-none bg-transparent text-[13px] leading-[18px] outline-none placeholder:text-muted"
          />
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-3 pt-12">
        <Button onClick={handleShare}>카카오톡으로 보내기</Button>
        <Button variant="text" onClick={() => navigate(paths.roomHome(roomId))}>
          방으로 들어가기
        </Button>
      </div>
    </main>
  )
}

export default RoomSharePage
