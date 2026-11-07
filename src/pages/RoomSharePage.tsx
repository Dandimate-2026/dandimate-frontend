import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Button from '../components/Button'
import Card from '../components/Card'
import { CopyIcon } from '../components/ShareIcons'
import { DEFAULT_SHARE_MESSAGE, useInviteShare } from '../hooks/useInviteShare'
import { useRoomInvite } from '../hooks/useRoomInvite'
import { getRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'
import { LengthNotice } from '../components/LengthNotice'
import { clampText } from '../lib/textLimit'

const MAX_MESSAGE_LENGTH = 50

/** 방 생성 직후, 친구들에게 초대 링크를 공유하는 화면 */
function RoomSharePage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  // 원본 초대 토큰은 방 생성 응답에서 한 번만 받으므로 저장해 둔 값을 쓴다
  const session = getRoomSession(roomId)
  // 고정 초대 링크: 이 기기에 없으면 서버에서 받아 온다
  const inviteToken = useRoomInvite(roomId)
  const { link, copied, copy, share } = useInviteShare(inviteToken ?? '')

  if (!session) return <NotFoundPage message="초대 링크를 찾을 수 없어요" />
  if (!inviteToken) return <main className="flex-1 bg-bg" aria-busy="true" />
  // 비워두면 기본 문구로 보낸다
  const shareText = message.trim() || DEFAULT_SHARE_MESSAGE

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 text-ink pt-[clamp(32px,12dvh,124px)] pb-12">
      <h1 className="px-[6px] text-[24px] leading-[32px] font-bold">
        {session.roomName}
        <br />방이 열렸어요
      </h1>
      <p className="mt-[18px] px-2 text-[15px] leading-[19px] text-sub">
        친구들이 사진과 한마디를 남기면 두루마리로 엮어요.
        <br />
        지금 단톡방에 링크를 보내 주세요.
      </p>

      <Card className="mt-8">
        <p className="text-[11px] text-sub">초대 링크</p>
        <div className="mt-[10px] flex gap-3">
          <p className="flex h-[52px] flex-1 items-center truncate rounded-2xl bg-line px-[14px] text-[15px] text-sub">
            {link}
          </p>
          <Button variant="outline" onClick={() => copy(shareText)} className="flex h-[52px] w-[85px] items-center justify-center gap-1.5 text-[13px]">
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
            onChange={(e) => setMessage(clampText(e.target.value, MAX_MESSAGE_LENGTH))}
            placeholder={DEFAULT_SHARE_MESSAGE}
            className="mt-0.5 w-full resize-none bg-transparent text-[13px] leading-[18px] outline-none placeholder:text-muted"
          />
          <LengthNotice length={message.length} max={MAX_MESSAGE_LENGTH} />
        </div>
      </Card>

      <div className="mt-auto flex flex-col gap-3 pt-12">
        <Button onClick={() => share(shareText)}>카카오톡으로 보내기</Button>
        <Button variant="text" onClick={() => navigate(paths.roomHome(roomId))}>
          방으로 들어가기
        </Button>
      </div>
    </main>
  )
}

export default RoomSharePage
