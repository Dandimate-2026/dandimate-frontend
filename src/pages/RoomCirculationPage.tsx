import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { createEntry, deleteEntry, editEntry, transcribe } from '../api/entries'
import { deletePhoto } from '../api/photos'
import { getCirculation, passPhoto, recordMockAddon, undoPass } from '../api/memories'
import type { CirculationCard, Entry, FlowerCode } from '../api/types'
import Button from '../components/Button'
import CirculationPage from '../features/memories/CirculationPage'
import { CirculationComplete } from '../features/memories/CompletionPages'
import ContributionSheet from '../features/memories/ContributionSheet'
import { useRoomHomeForQuota, voiceMaxMs } from '../hooks/useRoomQuota'
import { MemoryFlower, MemoryHeader } from '../features/memories/components'
import type { FlowerColor, MemoryContribution, MemoryPhoto, MemoryResponse, MemoryStory } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'
import { LengthNotice } from '../components/LengthNotice'
import { canEditRoomRecords } from '../lib/roomState'
import { clampText } from '../lib/textLimit'

/** 꽃 색은 앱 공통 8색: 꽃 코드를 그대로 쓴다 */
function flower(code: FlowerCode): FlowerColor {
  return code
}

function story(entry: Entry, myMemberId?: string) {
  return {
    id: entry.id,
    mine: Boolean(myMemberId && entry.member.id === myMemberId),
    author: entry.member.nickname,
    flower: flower(entry.member.flowerCode),
    kind: entry.inputMode === 'VOICE' ? '말로 남김' : '글로 남김',
    text: entry.transcript,
    audioUrl: entry.audioUrl ?? undefined,
  }
}

function memoryPhoto(card: CirculationCard, myMemberId?: string): MemoryPhoto {
  return {
    id: card.photo.id,
    mine: card.myResponse.status === 'OWN_PHOTO',
    owner: card.photo.uploader.nickname,
    flower: flower(card.photo.uploader.flowerCode),
    location: '올린 사진',
    dateLabel: card.firstEntry?.confirmedAt.slice(0, 10).replaceAll('-', '.') ?? '',
    photoUrl: card.photo.imageUrl,
    firstStory: card.firstEntry ? story(card.firstEntry, myMemberId) : { author: card.photo.uploader.nickname, kind: '첫 한마디', text: '아직 첫 이야기가 없어요.' },
    friends: card.otherEntries.map((entry) => story(entry, myMemberId)),
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
  const editable = canEditRoomRecords(quotaHome?.room.status)
  const [cards, setCards] = useState<CirculationCard[]>([])
  const [index, setIndex] = useState(0)
  // 홈·핀 꽃에서 사진 하나를 콕 집어 들어오면 그 사진 하나만 보여 준다
  const [single, setSingle] = useState(false)
  const [done, setDone] = useState(false)
  const [responses, setResponses] = useState<Record<string, MemoryContribution>>({})
  const audioUrls = useRef<Set<string>>(new Set())
  const [textOnly, setTextOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 내 사진·이야기 지우기 확인창과 이야기 고치기 창
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'photo' } | { kind: 'story'; story: MemoryStory } | null>(null)
  const [editing, setEditing] = useState<{ story: MemoryStory; text: string } | null>(null)

  useEffect(() => {
    const urls = audioUrls.current
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [])

  useEffect(() => {
    let active = true
    getCirculation(roomId, token).then((result) => {
      if (!active) return
      // 내 사진에도 덧붙일 수 있어서 내 사진까지 함께 돌려본다
      const list = result
      setCards(list)
      const start = startPhotoId ? list.findIndex((card) => card.photo.id === startPhotoId) : -1
      if (start >= 0) { setIndex(start); setSingle(true) }
      // 아직 돌려보기에 없는 사진(지워졌거나 첫 한마디 전)이면 첫 사진부터 보여주고 알린다
      else if (startPhotoId) setError('그 사진은 지금 볼 수 없어요. 처음 사진부터 보여 드릴게요')
    })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '사진을 불러오지 못했어요.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [roomId, token, startPhotoId])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const card = cards[index]
  const photo = card ? memoryPhoto(card, quotaHome?.me.id) : null
  const response: MemoryResponse | undefined = card?.myResponse.status === 'ADDON'
    ? { status: 'added', contribution: responses[card.photo.id] }
    : card?.myResponse.status === 'PASSED' ? { status: 'passed' } : undefined
  const backToHome = () => navigate(paths.roomHome(roomId))

  async function refresh() {
    const result = await getCirculation(roomId, token)
    setCards(result)
  }

  async function pass() {
    if (!editable || !card || busy) return
    setBusy(true); setError('')
    try { await passPhoto(card.photo.id, token); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '패스하지 못했어요.') }
    finally { setBusy(false) }
  }

  async function saveAddition(contribution: MemoryContribution) {
    if (!editable || !card) return
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
    // 한 장만 보러 왔으면 다음 사진 대신 왔던 곳으로
    if (single) { navigate(-1); return }
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

  async function confirmDeletion() {
    if (!editable || !confirmDelete || !card || busy) return
    setBusy(true); setError('')
    try {
      if (confirmDelete.kind === 'photo') {
        await deletePhoto(card.photo.id)
        // 한 장만 보러 왔으면 그 사진이 없어졌으니 왔던 곳으로
        if (single) { setConfirmDelete(null); navigate(-1); return }
        const result = await getCirculation(roomId, token)
        setCards(result)
        setIndex((i) => Math.max(0, Math.min(i, result.length - 1)))
      } else if (confirmDelete.story.id) {
        await deleteEntry(confirmDelete.story.id)
        await refresh()
      }
      setConfirmDelete(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '지우지 못했어요.')
      setConfirmDelete(null)
    } finally { setBusy(false) }
  }

  async function saveEdit() {
    if (!editable || !editing?.story.id || !editing.text.trim() || busy) return
    setBusy(true); setError('')
    try {
      await editEntry(editing.story.id, editing.text.trim())
      await refresh()
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고치지 못했어요.')
    } finally { setBusy(false) }
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
          : <CirculationPage readOnly={!editable} photo={photo} position={index + 1} total={cards.length} single={single} response={response} locked={card.locked} busy={busy} error={error} textOnly={textOnly} onTextMode={setTextOnly} onBack={backToHome} onAdd={() => setSheetOpen(true)} onPass={() => void pass()} onNext={next}
            onDeletePhoto={editable ? () => setConfirmDelete({ kind: 'photo' }) : undefined}
            onEditStory={editable ? (s) => setEditing({ story: s, text: s.text }) : undefined}
            onDeleteStory={editable ? (s) => setConfirmDelete({ kind: 'story', story: s }) : undefined} />}
    {editable && confirmDelete && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-8" onClick={() => setConfirmDelete(null)}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[360px] rounded-[24px] bg-[#fffdf9] px-5 pt-6 pb-5 text-center text-[#2a2623]">
          <h2 id="delete-title" className="text-[16px] font-bold">{confirmDelete.kind === 'photo' ? '이 사진을 지울까요?' : '이 이야기를 지울까요?'}</h2>
          <p className="mt-2 text-[13px] leading-5 text-[#8a8178]">
            {confirmDelete.kind === 'photo'
              ? <>사진에 친구들이 남긴 이야기도 함께 지워져요.<br />지운 사진은 되돌릴 수 없어요.</>
              : <>지운 이야기는 되돌릴 수 없어요.<br />두루마리가 완성된 방이면 문단이 다시 만들어져요.</>}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className="h-12 rounded-full border border-[#e6ded2] text-[15px] font-semibold">취소</button>
            <button type="button" disabled={busy} onClick={() => void confirmDeletion()} className="h-12 rounded-full bg-[#2a2623] text-[15px] font-semibold text-white disabled:opacity-50">{busy ? '지우는 중…' : '지우기'}</button>
          </div>
        </div>
      </div>
    )}
    {editable && editing && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6" onClick={() => setEditing(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="edit-story-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-[24px] bg-[#fffdf9] px-5 pt-6 pb-5 text-[#2a2623]">
          <h2 id="edit-story-title" className="text-center text-[16px] font-bold">이야기 고치기</h2>
          <textarea value={editing.text} maxLength={300} onChange={(e) => setEditing({ ...editing, text: clampText(e.target.value, 300) })} rows={4} className="mt-4 w-full resize-none rounded-[16px] border border-[#e6ded2] bg-white px-4 py-3 text-[14px] leading-6 outline-none" />
          <p className="mt-1 text-right text-[11px] text-[#8a8178]">{editing.text.length}/300 · 말로 남긴 이야기는 글만 바뀌어요</p>
          <LengthNotice length={editing.text.length} max={300} className="text-right" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-12 rounded-full border border-[#e6ded2] text-[15px] font-semibold">취소</button>
            <button type="button" disabled={busy || !editing.text.trim()} onClick={() => void saveEdit()} className="h-12 rounded-full bg-[#2a2623] text-[15px] font-semibold text-white disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      </div>
    )}
    {editable && sheetOpen && photo && <ContributionSheet kind="addition" quote={photo.firstStory.text} startWithText={textOnly} draftKey={`addon:${roomId}:${photo.id}`} maxLength={200} maxVoiceMs={voiceMaxMs(quotaHome?.room.quota, 'other')}
      onTranscribe={(audio) => transcribe(photo.id, token, audio, 'ADDON')}
      onSave={saveAddition} onClose={() => setSheetOpen(false)} />}
  </div>
}

export default RoomCirculationPage
