import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import ContributionSheet from '../features/memories/ContributionSheet'
import { WeavingPage } from '../features/memories/CompletionPages'
import ScrollPage from '../features/memories/ScrollPage'
import type { MemoryContribution } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

/**
 * 엮으러 가기 다음 화면: 엮는 중(memories s8) → 두루마리(memories s9)
 * TODO: memories 화면은 아직 시안 데이터로 그려진다. 엮기 작업 상태(GET /jobs/{jobId})와 두루마리 API를 연결해야 한다
 */
function RoomWeavingPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [woven, setWoven] = useState(false)
  const [replyTarget, setReplyTarget] = useState<{ chapter: string; quote: string } | null>(null)
  const [replies, setReplies] = useState<Record<string, MemoryContribution[]>>({})
  const audioUrls = useRef<Set<string>>(new Set())
  useEffect(() => {
    const urls = audioUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const backToHome = () => navigate(paths.roomHome(roomId))
  const showScroll = useCallback(() => {
    setWoven(true)
    window.scrollTo(0, 0)
  }, [])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  return (
    // 앱 레이아웃이 세로 flex라서, 폭을 꽉 채우지 않으면 내용 크기만큼 줄어든다
    <div className="memory-app w-full">
      {woven ? (
        <ScrollPage
          onBack={backToHome}
          replies={replies}
          onReply={(chapter, quote) => setReplyTarget({ chapter, quote })}
        />
      ) : (
        <WeavingPage onBack={backToHome} onReady={showScroll} />
      )}
      {replyTarget && (
        <ContributionSheet
          kind="reply"
          quote={replyTarget.quote}
          onClose={() => setReplyTarget(null)}
          onSave={(contribution) => {
            if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
            setReplies((current) => ({
              ...current,
              [replyTarget.chapter]: [...(current[replyTarget.chapter] ?? []), contribution],
            }))
            setReplyTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default RoomWeavingPage
