import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { createEntry, transcribe } from '../api/entries'
import { getCirculation, passPhoto, recordMockAddon, undoPass } from '../api/memories'
import type { CirculationCard, Entry, FlowerCode } from '../api/types'
import Button from '../components/Button'
import CirculationPage from '../features/memories/CirculationPage'
import { CirculationComplete } from '../features/memories/CompletionPages'
import ContributionSheet from '../features/memories/ContributionSheet'
import { useRoomHomeForQuota, voiceMaxMs } from '../hooks/useRoomQuota'
import { MemoryFlower, MemoryHeader } from '../features/memories/components'
import type { FlowerColor, MemoryContribution, MemoryPhoto, MemoryResponse } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

function flower(code: FlowerCode): FlowerColor {
  if (code === 'FORGET_ME_NOT' || code === 'TEAL') return 'blue'
  if (code === 'FORSYTHIA' || code === 'CANOLA') return 'orange'
  return 'pink'
}

function story(entry: Entry) {
  return {
    author: entry.member.nickname,
    flower: flower(entry.member.flowerCode),
    kind: entry.inputMode === 'VOICE' ? '말로 남김' : '글로 남김',
    text: entry.transcript,
    audioUrl: entry.audioUrl ?? undefined,
  }
}

function memoryPhoto(card: CirculationCard): MemoryPhoto {
  return {
    id: card.photo.id,
    owner: card.photo.uploader.nickname,
    flower: flower(card.photo.uploader.flowerCode),
    location: '올린 사진',
    dateLabel: card.firstEntry?.confirmedAt.slice(0, 10).replaceAll('-', '.') ?? '',
    photoUrl: card.photo.imageUrl,
    firstStory: card.firstEntry ? story(card.firstEntry) : { author: card.photo.uploader.nickname, kind: '첫 한마디', text: '아직 첫 이야기가 없어요.' },
    friends: card.otherEntries.map(story),
  }
}

function RoomCirculationPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  // 챗봇에서 특정 사진에 덧붙이러 왔으면 그 사진부터 연다
  const [searchParams] = useSearchParams()
  const startPhotoId = searchParams.get('photo')
  const session = getRoomSession(roomId)
  const token = session?.memberAccessToken ?? ''
  // 덧붙임 녹음 최대 길이는 플랜별(20/30/60초)이라 방 한도를 불러온다
  const quotaHome = useRoomHomeForQuota(roomId, session?.memberAccessToken)
  const [cards, setCards] = useState<CirculationCard[]>([])
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [responses, setResponses] = useState<Record<string, MemoryContribution>>({})
  const audioUrls = useRef<Set<string>>(new Set())
  const [textOnly, setTextOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const urls = audioUrls.current
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [])

  useEffect(() => {
    let active = true
    getCirculation(roomId, token).then((result) => {
      if (!active) return
      const list = result.filter((card) => card.myResponse.status !== 'OWN_PHOTO')
      setCards(list)
      const start = startPhotoId ? list.findIndex((card) => card.photo.id === startPhotoId) : -1
      if (start >= 0) setIndex(start)
      // 내 사진이거나 아직 돌려보기에 없는 사진이면 덧붙일 수 없어서 첫 사진부터 보여주고 알린다
      else if (startPhotoId) setError('그 사진에는 덧붙일 수 없어요. 내가 올린 사진에는 덧붙일 수 없어요')
    })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '사진을 불러오지 못했어요.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [roomId, token, startPhotoId])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const card = cards[index]
  const photo = card ? memoryPhoto(card) : null
  const response: MemoryResponse | undefined = card?.myResponse.status === 'ADDON'
    ? { status: 'added', contribution: responses[card.photo.id] }
    : card?.myResponse.status === 'PASSED' ? { status: 'passed' } : undefined
  const backToHome = () => navigate(paths.roomHome(roomId))

  async function refresh() {
    const result = await getCirculation(roomId, token)
    setCards(result.filter((item) => item.myResponse.status !== 'OWN_PHOTO'))
  }

  async function pass() {
    if (!card || busy) return
    setBusy(true); setError('')
    try { await passPhoto(card.photo.id, token); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '패스하지 못했어요.') }
    finally { setBusy(false) }
  }

  async function undo() {
    if (!card || busy) return
    setBusy(true); setError('')
    try { await undoPass(card.photo.id, token); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '패스를 취소하지 못했어요.') }
    finally { setBusy(false) }
  }

  async function saveAddition(contribution: MemoryContribution) {
    if (!card) return
    if (card.myResponse.status === 'PASSED') await undoPass(card.photo.id, token)
    if (contribution.audioBlob && contribution.transcriptionId) {
      await createEntry(card.photo.id, token, { kind: 'ADDON', inputMode: 'VOICE', transcriptionId: contribution.transcriptionId, transcript: contribution.text })
    } else {
      await createEntry(card.photo.id, token, { kind: 'ADDON', inputMode: 'TEXT', transcript: contribution.text })
    }
    recordMockAddon(card.photo.id)
    await refresh()
    if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
    setResponses((current) => ({ ...current, [card.photo.id]: contribution }))
    setSheetOpen(false)
  }

  function next() {
    setSheetOpen(false)
    if (index >= cards.length - 1) setDone(true)
    else setIndex((value) => value + 1)
    window.scrollTo(0, 0)
  }

  async function retryLoad() {
    setBusy(true)
    setError('')
    try { await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '사진을 불러오지 못했어요.') }
    finally { setBusy(false) }
  }

  return <div className="memory-app w-full">
    {loading ? <main className="memory-page" role="status">사진을 불러오고 있어요…</main>
      : !photo ? <main className="memory-page memory-empty">
          <MemoryHeader onBack={backToHome} />
          <section className="memory-empty-main" role={error ? 'alert' : 'status'}>
            <div className="memory-empty-flower" aria-hidden="true"><MemoryFlower color="pink" size={40} /></div>
            <h1>{error ? '사진을 불러오지 못했어요' : '아직 돌려볼 친구 사진이 없어요'}</h1>
            <p>{error || '친구가 사진과 첫 한마디를 남기면 여기서 이야기를 보탤 수 있어요.'}</p>
          </section>
          <footer className="memory-empty-actions">
            <Button variant="outline" onClick={() => void retryLoad()} disabled={busy}>{busy ? '확인 중…' : '다시 확인하기'}</Button>
            <Button onClick={backToHome}>방으로 돌아가기</Button>
          </footer>
        </main>
        : done ? <CirculationComplete addedCount={cards.filter((item) => item.myResponse.status === 'ADDON').length} photoCount={cards.length} roomName={session.roomName} onBack={() => setDone(false)} onHome={backToHome} />
          : <CirculationPage photo={photo} position={index + 1} total={cards.length} response={response} locked={card.locked} busy={busy} error={error} textOnly={textOnly} onTextMode={setTextOnly} onBack={backToHome} onAdd={() => setSheetOpen(true)} onPass={() => void pass()} onUndoPass={() => void undo()} onNext={next} />}
    {sheetOpen && photo && <ContributionSheet kind="addition" quote={photo.firstStory.text} startWithText={textOnly} maxLength={200} maxVoiceMs={voiceMaxMs(quotaHome?.room.quota, 'other')}
      onTranscribe={(audio) => transcribe(photo.id, token, audio, 'ADDON')}
      onSave={saveAddition} onClose={() => setSheetOpen(false)} />}
  </div>
}

export default RoomCirculationPage
