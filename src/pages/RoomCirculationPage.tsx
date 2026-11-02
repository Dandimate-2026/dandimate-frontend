import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import CirculationPage from '../features/memories/CirculationPage'
import { CirculationComplete } from '../features/memories/CompletionPages'
import ContributionSheet from '../features/memories/ContributionSheet'
import { MEMORY_PHOTOS } from '../features/memories/data'
import type { MemoryContribution, MemoryResponse } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

// TODO: 돌려보기 API(GET /rooms/{roomId}/circulation)를 연결하기 전까지 시안 사진 2장으로 보여준다
const PHOTOS = MEMORY_PHOTOS.slice(0, 2)

/** 이야기 붙이기: 친구 사진을 한 장씩 보며 덧붙이거나 패스하고(memories s6), 다 보면 결과(s6-5)를 보여준다 */
function RoomCirculationPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [responses, setResponses] = useState<Record<string, MemoryResponse>>({})
  const [textOnly, setTextOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const audioUrls = useRef<Set<string>>(new Set())
  useEffect(() => {
    const urls = audioUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const photo = PHOTOS[index]
  const backToHome = () => navigate(paths.roomHome(roomId))

  const respond = (response: MemoryResponse) => setResponses((current) => ({ ...current, [photo.id]: response }))

  const next = () => {
    setSheetOpen(false)
    if (index === PHOTOS.length - 1) setDone(true)
    else setIndex((i) => i + 1)
    window.scrollTo(0, 0)
  }

  const saveAddition = (contribution: MemoryContribution) => {
    if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
    respond({ status: 'added', contribution })
    setSheetOpen(false)
  }

  return (
    // 앱 레이아웃이 세로 flex라서, 폭을 꽉 채우지 않으면 내용 크기만큼 줄어든다
    <div className="memory-app w-full">
      {done ? (
        <CirculationComplete
          addedCount={Object.values(responses).filter((r) => r.status === 'added').length}
          photoCount={PHOTOS.length}
          onBack={() => setDone(false)}
          onHome={backToHome}
        />
      ) : (
        <CirculationPage
          photo={photo}
          position={index + 1}
          total={PHOTOS.length}
          response={responses[photo.id]}
          textOnly={textOnly}
          onTextMode={setTextOnly}
          onBack={backToHome}
          onAdd={() => setSheetOpen(true)}
          onPass={() => respond({ status: 'passed' })}
          onNext={next}
        />
      )}
      {sheetOpen && (
        <ContributionSheet
          kind="addition"
          quote={photo.firstStory.text}
          initial={responses[photo.id]?.contribution}
          startWithText={textOnly}
          onSave={saveAddition}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

export default RoomCirculationPage
