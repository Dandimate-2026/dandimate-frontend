import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { uploadPhotos } from '../api/photos'
import Button from '../components/Button'
import { isAcceptedType, prepareImage } from '../lib/image'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import type { FirstEntryState } from './FirstEntryPage'
import NotFoundPage from './NotFoundPage'

const MAX_PHOTOS = 3
const LONG_PRESS_MS = 400
// 길게 누르기 전에 이만큼 움직이면 누르기를 취소한다
const MOVE_TOLERANCE = 8

interface PickedPhoto {
  id: string
  file: File
  previewUrl: string
}

/** 일부 브라우저는 HEIC의 file.type을 비워 두므로 확장자로 보완한다 */
function withType(file: File) {
  if (file.type) return file
  const ext = file.name.split('.').pop()?.toLowerCase()
  const type = ext === 'heic' || ext === 'heif' ? `image/${ext}` : ''
  return type ? new File([file], file.name, { type }) : file
}

function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14.667V8m0 0V1.333M8 8h6.667M8 8H1.333" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** 이야기를 남길 사진을 1~3장 고르고 올리는 화면 */
function PhotoUploadPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // 길게 눌러 끌고 있는 사진과 손가락이 움직인 거리
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const listRef = useRef<HTMLUListElement>(null)
  const pressTimer = useRef<number | undefined>(undefined)
  const pressStart = useRef({ x: 0, y: 0 })

  // 화면을 떠날 때 미리보기용 URL을 정리한다
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), [])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map(withType)
    e.target.value = ''
    setError(null)

    const accepted = picked.filter((f) => isAcceptedType(f.type))
    if (accepted.length < picked.length) setError('JPEG, PNG, HEIC 사진만 올릴 수 있어요')

    const room = MAX_PHOTOS - photos.length
    if (accepted.length > room) setError(`사진은 최대 ${MAX_PHOTOS}장까지 고를 수 있어요`)

    const next = accepted.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPhotos((prev) => [...prev, ...next])
  }

  const handlePointerDown = (e: PointerEvent<HTMLLIElement>, id: string) => {
    if (uploading) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pressStart.current = { x: e.clientX, y: e.clientY }
    pressTimer.current = window.setTimeout(() => {
      setDragId(id)
      navigator.vibrate?.(30)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: PointerEvent<HTMLLIElement>, id: string) => {
    const dx = e.clientX - pressStart.current.x
    const dy = e.clientY - pressStart.current.y
    if (dragId !== id) {
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) window.clearTimeout(pressTimer.current)
      return
    }

    // 사진 칸은 한 줄 3칸이라, 손가락의 가로 위치로 놓일 자리를 정한다
    const list = listRef.current?.getBoundingClientRect()
    if (!list) return
    const colWidth = list.width / MAX_PHOTOS
    const from = photos.findIndex((p) => p.id === id)
    const to = Math.min(Math.max(Math.floor((e.clientX - list.left) / colWidth), 0), photos.length - 1)

    if (to !== from) {
      setPhotos((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
      // 칸이 옮겨진 만큼 기준점을 옮겨 사진이 손가락 아래에 머물게 한다
      pressStart.current.x += (to - from) * colWidth
    }
    setDragOffset({ x: e.clientX - pressStart.current.x, y: dy })
  }

  const handlePointerEnd = () => {
    window.clearTimeout(pressTimer.current)
    setDragId(null)
    setDragOffset({ x: 0, y: 0 })
  }

  const handleRemove = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const handleNext = async () => {
    if (photos.length === 0 || uploading) return
    setUploading(true)
    setError(null)
    try {
      const files = await Promise.all(
        photos.map(async (p, i) => {
          const { blob, contentType } = await prepareImage(p.file)
          return {
            blob,
            request: { clientFileId: p.id, fileName: p.file.name, contentType, sizeBytes: blob.size, displayOrder: i + 1 },
          }
        }),
      )
      const photoIds = await uploadPhotos(roomId, session.memberAccessToken, files)
      const state: FirstEntryState = { photos: photos.map((p, i) => ({ photoId: photoIds[i], file: p.file })) }
      navigate(paths.firstEntry(roomId), { state })
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 올리지 못했어요. 다시 시도해 주세요')
      setUploading(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 pt-16 pb-10 text-ink">
      {/* TODO: 뒤로 가기 목적지 확정 필요 (지금은 브라우저 히스토리 기준) */}
      <button type="button" onClick={() => navigate(-1)} aria-label="뒤로 가기" className="w-fit">
        <ChevronLeftIcon />
      </button>

      <h1 className="mt-[50px] px-[7px] text-[17px] leading-[19px] font-bold">
        이야기를 남길 사진을
        <br />
        골라주세요.
      </h1>
      <p className="mt-3.5 px-[7px] text-[11px] text-sub">1장부터 괜찮아요 · 최대 {MAX_PHOTOS}장</p>

      <ul ref={listRef} className="mt-4 grid grid-cols-3 gap-[9px]">
        {photos.map((p) => (
          <li
            key={p.id}
            onPointerDown={(e) => handlePointerDown(e, p.id)}
            onPointerMove={(e) => handlePointerMove(e, p.id)}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onContextMenu={(e) => e.preventDefault()}
            style={dragId === p.id ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.05)` } : undefined}
            // touch-none: 사진 위에서는 화면 스크롤 대신 끌기로 동작
            // [-webkit-touch-callout:none]: iOS에서 길게 누르면 뜨는 이미지 저장 메뉴를 막는다
            className={`relative aspect-[101/136] touch-none overflow-hidden rounded-xl bg-[#efe9df] select-none [-webkit-touch-callout:none] ${
              dragId === p.id ? 'z-10 shadow-lg' : 'transition-transform'
            }`}
          >
            <img src={p.previewUrl} alt={p.file.name} draggable={false} className="size-full object-cover" />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(p.id)
              }}
              disabled={uploading}
              aria-label="사진 빼기"
              className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-ink/40 text-[11px] leading-none text-surface"
            >
              ×
            </button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-[101/136] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted text-[11px] text-sub"
            >
              <PlusIcon />
              추가
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={handlePick}
      />

      <div className="mt-[19px] flex items-center justify-between px-[3px]">
        {error ? (
          <p className="text-[11px] text-point">{error}</p>
        ) : (
          <p className="text-[11px] text-sub">
            {dragId ? '원하는 자리에 놓아주세요' : '길게 눌러 순서를 바꿀 수 있어요'}
          </p>
        )}
        <p className="text-[15px] font-semibold">
          {photos.length} / {MAX_PHOTOS}
        </p>
      </div>

      {/* 화면이 낮아도 버튼 위에 빈 공간을 남긴다 */}
      <div className="mt-auto pt-24">
        <Button onClick={handleNext} disabled={photos.length === 0 || uploading} className="w-full">
          {uploading ? '사진 올리는 중…' : '다음 : 한마디 남기기'}
        </Button>
      </div>
    </main>
  )
}

export default PhotoUploadPage
