import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import { BottomSheet, MemoryCard, MemoryFlower, PhotoSlot, StoryCard, TripHeading } from './components'
import type { MemoryContribution } from './types'

const CHAPTERS = [
  {
    id: 'cafe', label: '첫째 날 · 지수가 올린 사진', photoLabel: '황리단길 카페',
    text: '황리단길 카페에서는 다들 한참을 말이 없었다.',
    quotes: [
      { author: '민지', flower: 'orange' as const, text: '여기서 두시간 넘게 앉아있었음' },
      { author: '지수', flower: 'blue' as const, text: '다들 여기서 시험얘기하다가 조용해졌잖아ㅋㅋ' },
    ], count: 1,
  },
  {
    id: 'observatory', label: '둘째 날 · 서연이 올린 사진', photoLabel: '황리단길 카페',
    text: '첨성대 앞에서 단체 사진을 찍던 순간이다. 다들 크게 웃었지만, 왜 웃었는지는 저마다 다르게 기억한다.',
    quotes: [
      { author: '서연', flower: 'pink' as const, text: '민지가 계단에서 미끄러졌는데 다같이 빵터짐' },
      { author: '민지', flower: 'orange' as const, text: '사실 일부러 앉은거임' },
    ], count: 3,
  },
]

export default function ScrollPage({ onBack, onReply, replies }: { onBack: () => void; onReply: (chapter: string, quote: string) => void; replies: Record<string, MemoryContribution[]> }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [rating, setRating] = useState(5)
  const [rated, setRated] = useState(false)
  const [original, setOriginal] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [photo, setPhoto] = useState<string | undefined>()
  const [caption, setCaption] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [extras, setExtras] = useState<{ url?: string; text: string }[]>([])
  const objectUrls = useRef<string[]>([])
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  function selectPhoto(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { setUploadError('10MB 이하의 이미지 파일을 골라 주세요.'); return }
    const url = URL.createObjectURL(file)
    objectUrls.current.push(url)
    setPhoto(url)
    setUploadError('')
  }

  return <main className="memory-page memory-scroll">
    <TripHeading onBack={onBack} />
    {CHAPTERS.map((chapter, index) => <section className="memory-chapter" key={chapter.id}>
      <PhotoSlot label={chapter.photoLabel} />
      <p className="memory-chapter-meta">{chapter.label}</p>
      <p className="memory-narrative">{chapter.text}</p>
      <div className={index === 1 ? 'memory-differences' : 'memory-quotes'}>
        {index === 1 && <p className="memory-difference-title">기억이 엇갈려요</p>}
        {chapter.quotes.map((quote, i) => <blockquote className="memory-quote" key={quote.author}>
          <cite><MemoryFlower color={quote.flower} size={18} />{index === 1 ? (i === 0 ? '서연은 이렇게 기억하고' : '민지의 기억은 다르다') : quote.author}</cite>
          <p>“{quote.text}”</p>
        </blockquote>)}
      </div>
      {index === 1 && <p className="memory-narrative memory-afterword">지수는 셔터를 누르는데 민지가 화면에서 갑자기 사라졌다고 말한다.</p>}
      <div className="memory-chapter-actions">
        <button type="button" className="memory-reaction" aria-pressed={Boolean(liked[chapter.id])} onClick={() => setLiked((value) => ({ ...value, [chapter.id]: !value[chapter.id] }))}>아 맞다 ! <strong>{chapter.count + (liked[chapter.id] ? 1 : 0)}</strong></button>
        <button type="button" className="memory-reply" onClick={() => onReply(chapter.id, index === 1 ? '첨성대 앞에서 한참을 웃었지.\n사진은 없지만 그날 바람도 참 좋았어.' : chapter.text)}>답가 남기기</button>
        <button type="button" className="memory-original-link" onClick={() => setOriginal(chapter.id)}>AI가 엮었어요 · 원문보기</button>
      </div>
      {(replies[chapter.id] ?? []).map((reply, i) => <div className="memory-added-reply" key={i}><StoryCard mine story={{ ...reply, author: '민지', flower: 'orange', kind: '답가' }} /></div>)}
    </section>)}
    <MemoryCard className="memory-rating">
      <h2>AI가 내 이야기를 잘 옮겼나요?</h2><p>내가 말한 문단 2개 기준이에요</p>
      <fieldset><legend className="sr-only">이야기 반영 만족도</legend><div className="memory-rating-options">{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="memory-rating" value={value} checked={rating === value} onChange={() => { setRating(value); setRated(true) }} aria-label={`${value}점${value === 1 ? ' · 다르게 옮겼어요' : value === 5 ? ' · 딱 내 말이에요' : ''}`} /><span /></label>)}</div></fieldset>
      <div className="memory-rating-scale"><span>다르게 옮겼어요</span><span>딱 내 말이에요</span></div>
      {rated && <p className="memory-rating-thanks" role="status">의견을 남겼어요. 고마워요!</p>}
    </MemoryCard>
    {extras.map((item, i) => <MemoryCard className="memory-extra" key={i}>{item.url && <PhotoSlot label="내가 더 보탠 사진" src={item.url} />}<p>{item.text}</p></MemoryCard>)}
    <section className="memory-more"><h2>더 보태고 싶은 이야기가 있나요?</h2><Button onClick={() => setAdding(true)}>사진·이야기 더 올리기</Button></section>
    {original && <BottomSheet title="함께 남긴 원문" onClose={() => setOriginal(null)}><div className="memory-original-stories">{CHAPTERS.find((chapter) => chapter.id === original)?.quotes.map((quote) => <StoryCard key={quote.author} textOnly story={{ ...quote, kind: '원문' }} />)}</div><Button className="memory-save" onClick={() => setOriginal(null)}>확인했어요</Button></BottomSheet>}
    {adding && <BottomSheet title="사진·이야기 더 올리기" onClose={() => setAdding(false)}>
      <div className="memory-upload"><label htmlFor="memory-photo-file">사진 고르기</label><input id="memory-photo-file" type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0])} />{photo && <PhotoSlot label="선택한 사진" src={photo} />}</div>
      <div className="memory-write-field"><label htmlFor="memory-extra-caption">함께 남길 이야기</label><textarea id="memory-extra-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} rows={3} placeholder="더 보태고 싶은 이야기를 적어 주세요" /></div>
      {uploadError && <p role="alert" className="memory-error">{uploadError}</p>}
      <Button className="memory-save" disabled={!photo && !caption.trim()} onClick={() => { setExtras((items) => [...items, { url: photo, text: caption.trim() }]); setPhoto(undefined); setCaption(''); setAdding(false) }}>이야기 보태기</Button>
    </BottomSheet>}
  </main>
}
