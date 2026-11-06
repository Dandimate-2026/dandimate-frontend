import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { USE_MOCK } from '../api/mock'
import { MAX_PHOTOS, uploadPhotos } from '../api/photos'
import Button from '../components/Button'
import PlanLimitSheet from '../components/PlanLimitSheet'
import { isLimitError, usePlanLimitAction, useRoomHomeForQuota } from '../hooks/useRoomQuota'
import { isAcceptedType, prepareImage } from '../lib/image'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import type { FirstEntryState } from './FirstEntryPage'
import NotFoundPage from './NotFoundPage'

const LONG_PRESS_MS = 400
// 사진 칸은 한 줄에 3칸
const GRID_COLUMNS = 3
// 칸 사이 간격 (grid gap-[9px])
const GRID_GAP = 9
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

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7.5" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  )
}

/** 이야기를 남길 사진을 1~3장 고르고 올리는 화면 */
/** 데모에서 한 번에 고를 수 있는 장수 (사실상 제한 없음) */
const DEMO_MAX_PHOTOS = 99

const PLAN_NAME: Record<string, string> = { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' }
const planName = (plan?: string) => PLAN_NAME[plan ?? 'FREE'] ?? 'Free'

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
  // 플랜 한도 시트. 3장만 올리려던 사람도 있으니 저절로 띄우지 않고, 한도보다 더 고르려 할 때나 안내 링크를 눌렀을 때만 띄운다
  const [limitOpen, setLimitOpen] = useState(false)
  const home = useRoomHomeForQuota(roomId, session?.memberAccessToken)
  const photoPlan = usePlanLimitAction(roomId, home, 'PHOTO')
  const quota = home?.room.quota
  /** 1인당 사진 한도 (플랜별 3/6/10장) */
  const perMember = quota?.photosPerMember ?? MAX_PHOTOS
  /** 이번에 더 고를 수 있는 장수. 데모에서는 화면을 계속 보려고 사실상 제한 없이 고를 수 있게 한다 */
  const maxPhotos = USE_MOCK ? DEMO_MAX_PHOTOS : (quota?.myPhotosRemaining ?? MAX_PHOTOS)

  // 화면을 떠날 때 미리보기용 URL을 정리한다
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), [])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const isHost = photoPlan.isHost
  const closeLimit = () => setLimitOpen(false)
  // 이번에 고를 수 있는 만큼 다 골랐거나, 이미 한도만큼 올린 방
  // 서버 한도를 아직 못 받았어도 기본(Free 3장) 기준으로 잠금 표시를 한다
  const atLimit = photos.length >= maxPhotos

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map(withType)
    e.target.value = ''
    setError(null)

    const accepted = picked.filter((f) => isAcceptedType(f.type))
    if (accepted.length < picked.length) setError('JPEG, PNG, HEIC 사진만 올릴 수 있어요')

    const room = maxPhotos - photos.length
    if (accepted.length > room) setLimitOpen(true)

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

    // 사진 칸은 한 줄에 3칸씩 여러 줄일 수 있어서(Lite·Pro), 손가락의 가로·세로 위치로 놓일 자리를 정한다
    const list = listRef.current?.getBoundingClientRect()
    const cell = listRef.current?.firstElementChild?.getBoundingClientRect()
    if (!list || !cell) return
    const colWidth = list.width / GRID_COLUMNS
    const rowHeight = cell.height + GRID_GAP
    const from = photos.findIndex((p) => p.id === id)
    const col = Math.min(Math.max(Math.floor((e.clientX - list.left) / colWidth), 0), GRID_COLUMNS - 1)
    const row = Math.max(Math.floor((e.clientY - list.top) / rowHeight), 0)
    const to = Math.min(row * GRID_COLUMNS + col, photos.length - 1)

    if (to !== from) {
      setPhotos((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
      // 칸이 옮겨진 만큼 기준점을 옮겨 사진이 손가락 아래에 머물게 한다
      pressStart.current.x += ((to % GRID_COLUMNS) - (from % GRID_COLUMNS)) * colWidth
      pressStart.current.y += (Math.floor(to / GRID_COLUMNS) - Math.floor(from / GRID_COLUMNS)) * rowHeight
    }
    setDragOffset({ x: e.clientX - pressStart.current.x, y: e.clientY - pressStart.current.y })
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
      if (isLimitError(err)) setLimitOpen(true)
      else setError(err instanceof Error ? err.message : '사진을 올리지 못했어요. 다시 시도해 주세요')
      setUploading(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 pt-[clamp(24px,8dvh,64px)] pb-10 text-ink">
      {/* TODO: 뒤로 가기 목적지 확정 필요 (지금은 브라우저 히스토리 기준) */}
      <button type="button" onClick={() => navigate(-1)} aria-label="뒤로 가기" className="w-fit">
        <ChevronLeftIcon />
      </button>

      <h1 className="mt-[50px] px-[7px] text-[17px] leading-[19px] font-bold">
        이야기를 남길 사진을
        <br />
        골라주세요.
      </h1>
      <p className="mt-3.5 px-[7px] text-[11px] text-sub">
        {USE_MOCK ? '1장부터 괜찮아요 · 데모라 장수 제한 없이 골라 볼 수 있어요' : `1장부터 괜찮아요 · 최대 ${maxPhotos}장`}
      </p>

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
        {photos.length < maxPhotos && (
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
        {/* 플랜 한도에 닿으면 남는 칸을 잠금 칸으로 보여주고, 누르면 한도 시트를 띄운다 */}
        {atLimit && (photos.length === 0 || photos.length % GRID_COLUMNS !== 0) && (
          <li>
            <button
              type="button"
              onClick={() => setLimitOpen(true)}
              aria-label="사진 한도 안내 보기"
              className="flex aspect-[101/136] w-full flex-col items-center justify-center gap-2 rounded-xl bg-line/60 text-[11px] text-sub"
            >
              <LockIcon />
              더 올리려면
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
        {error || photoPlan.notice ? (
          <p className="text-[11px] text-point">{error ?? photoPlan.notice}</p>
        ) : (
          <p className="text-[11px] text-sub">
            {dragId ? '원하는 자리에 놓아주세요' : '길게 눌러 순서를 바꿀 수 있어요'}
          </p>
        )}
        <p className="text-[15px] font-semibold">
          {photos.length} / {maxPhotos}
        </p>
      </div>

      {/* 칸이 사진으로 꽉 차서 잠금 칸을 둘 자리가 없으면, 그 아래에 잠금 줄을 보여준다. 누르면 한도 시트를 띄운다 */}
      {atLimit && photos.length > 0 && photos.length % GRID_COLUMNS === 0 && (
        <button
          type="button"
          onClick={() => setLimitOpen(true)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-line/60 text-[12px] text-sub active:opacity-80"
        >
          <LockIcon />
          이 방은 1인당 {perMember}장까지예요 · 더 올리려면
        </button>
      )}

      {/* 화면이 낮아도 버튼 위에 빈 공간을 남긴다 */}
      <div className="mt-auto pt-[clamp(32px,10dvh,96px)]">
        {/* 다음 화면에서 사진마다 장소부터 고른다 */}
        <p className="mb-2 text-center text-[11px] text-sub">📍 사진마다 고른 장소는 기록 지도에 표시돼요</p>
        <Button onClick={handleNext} disabled={photos.length === 0 || uploading} className="w-full">
          {uploading ? '사진 올리는 중…' : '다음 : 장소 고르러 가기'}
        </Button>
      </div>

      {limitOpen && (
        <PlanLimitSheet
          kind="photo"
          title={`사진 ${perMember === 3 ? '세' : perMember}장을 다 올렸어요`}
          description={
            <>
              {planName(home?.room.planType)} 플랜은 한 사람당 {perMember}장까지예요.
              <br />
              {isHost ? '플랜을 바꾸면' : '방장이 플랜을 바꾸면'} 방 친구 모두 더 올릴 수 있어요
            </>
          }
          currentPlan={home?.room.planType}
          primary={{
            ...photoPlan.action,
            onClick: () => {
              closeLimit()
              photoPlan.action.onClick()
            },
          }}
          secondary={{ label: '괜찮아요', onClick: closeLimit }}
          onClose={closeLimit}
        />
      )}
    </main>
  )
}

export default PhotoUploadPage
