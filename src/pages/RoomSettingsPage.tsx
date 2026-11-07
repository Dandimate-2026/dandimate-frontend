import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { USE_MOCK } from '../api/mock'
import {
  deleteRoom,
  getRoomHome,
  leaveRoom,
  ROOM_CAPACITY,
  kickMember,
  transferHost,
  updateMyNickname,
  updateRoom,
} from '../api/rooms'
import type { Member, RoomHome } from '../api/types'
import Card from '../components/Card'
import Flower from '../components/Flower'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { coverSrc, uploadRoomCover } from '../api/roomCovers'
import { useInviteShare } from '../hooks/useInviteShare'
import { useRoomInvite } from '../hooks/useRoomInvite'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import { formatDateSpaced, formatDateTime, toLocalDateTimeInput } from '../lib/date'
import { objectParticle } from '../lib/plans'
import { getRoomPlaceCover, saveRoomPlaceCover, shrinkImage } from '../lib/roomExtras'
import { getRoomSession, removeRoomSession, saveRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'
import { ViewablePhoto } from '../components/PhotoViewer'
import { LengthNotice } from '../components/LengthNotice'
import { clampText } from '../lib/textLimit'

function ChevronLeftIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M7 1L1 6.5L7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-3 pt-4 pb-5">
      <h2 className="text-[11px] text-sub">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </Card>
  )
}

/** 모임 정보 한 줄: 왼쪽 항목 이름, 가운데 값, 바꿀 수 있으면 오른쪽에 변경 버튼 */
function InfoRow({
  label,
  editable,
  onEdit,
  children,
}: {
  label: string
  editable: boolean
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <li className="flex min-h-[52px] items-center gap-2 px-1 py-2">
      <span className="w-[76px] shrink-0 text-[12px] text-sub">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[14px]">{children}</span>
      {editable && (
        <button type="button" onClick={onEdit} aria-label={`${label} 변경`} className={EDIT_BUTTON_CLASS}>
          변경
        </button>
      )}
    </li>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-muted">{children}</span>
}

const SHARE_BUTTON_CLASS =
  'flex h-[52px] items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-[13px] text-sub active:opacity-80'

const PILL_BUTTON_CLASS = 'h-[52px] rounded-full text-[15px] font-semibold active:opacity-80'

const MAX_ROOM_NAME_LENGTH = 20
const MAX_NICKNAME_LENGTH = 10

type EditTarget = 'roomName' | 'meetingDate' | 'deadlineAt' | 'nickname' | 'capacity'

const EDIT_COPY: Record<EditTarget, { title: string; maxLength?: number }> = {
  roomName: { title: '모임 이름 바꾸기', maxLength: MAX_ROOM_NAME_LENGTH },
  meetingDate: { title: '모임 날짜 바꾸기' },
  deadlineAt: { title: '첫 두루마리 날 바꾸기' },
  nickname: { title: '내 이름 바꾸기', maxLength: MAX_NICKNAME_LENGTH },
  capacity: { title: '함께할 인원 바꾸기' },
}

/** 모임 이름·날짜나 내 이름을 바꾸는 창 */
function EditDialog({
  target,
  initialValue,
  minCapacity = 1,
  onCancel,
  onSave,
}: {
  target: EditTarget
  initialValue: string
  /** 인원 바꾸기: 지금 들어온 인원보다 적게는 줄일 수 없다 */
  minCapacity?: number
  onCancel: () => void
  onSave: (value: string) => Promise<void>
}) {
  const { title, maxLength } = EDIT_COPY[target]
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = value.trim()
  const canSave = trimmed.length > 0 && trimmed !== initialValue && !saving

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409 && target === 'nickname'
          ? '이 방에 같은 이름이 있어요. 다른 이름을 써 주세요'
          : // 첫 두루마리 시각은 서버가 범위·횟수를 확인하고 이유를 알려 준다 (예: 한 번만 바꿀 수 있어요)
            err instanceof ApiError && (target === 'deadlineAt' || target === 'capacity') && err.status < 500 && err.message
            ? err.message
            : target === 'capacity' && err instanceof Error && !(err instanceof ApiError)
            ? err.message
            : '바꾸지 못했어요. 잠시 후 다시 시도해 주세요',
      )
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-8" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[20px] bg-surface px-6 pt-6 pb-5 text-ink"
      >
        <h2 id="edit-title" className="text-center text-[16px] font-bold">
          {title}
        </h2>
        <div className="relative mt-4">
          {target === 'capacity' ? (
            // 1~8명 중 고른다. 지금 들어온 인원보다 적은 수는 고를 수 없다
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={title}>
              {Array.from({ length: ROOM_CAPACITY }, (_, i) => i + 1).map((n) => {
                const disabled = n < minCapacity
                const selected = value === String(n)
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setValue(String(n))}
                    className={`h-11 rounded-[14px] border text-[14px] ${
                      selected
                        ? 'border-ink bg-ink font-semibold text-surface'
                        : 'border-line bg-surface disabled:border-transparent disabled:bg-bg disabled:text-muted'
                    }`}
                  >
                    {n}명
                  </button>
                )
              })}
            </div>
          ) : maxLength ? (
            <>
              <input
                aria-label={title}
                value={value}
                maxLength={maxLength}
                autoFocus
                onChange={(e) => setValue(clampText(e.target.value, maxLength))}
                className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-[18px] outline-none focus:border-sub"
              />
              <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
                {value.length}/{maxLength}
              </span>
              <LengthNotice length={value.length} max={maxLength} className="text-center" />
            </>
          ) : (
            <input
              aria-label={title}
              type={target === 'deadlineAt' ? 'datetime-local' : 'date'}
              min={target === 'deadlineAt' ? toLocalDateTimeInput(new Date().toISOString()) : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-[52px] w-full rounded-full border border-line bg-surface px-[18px] outline-none focus:border-sub"
            />
          )}
        </div>
        {target === 'capacity' && (
          <p className="mt-3 text-center text-[12px] leading-5 text-sub">
            지금 들어온 {minCapacity}명보다 적게는 줄일 수 없어요.
            <br />
            나를 포함해 최대 {ROOM_CAPACITY}명까지 늘릴 수 있어요.
          </p>
        )}
        {target === 'deadlineAt' && (
          <p className="mt-3 text-center text-[12px] leading-5 text-sub">
            두루마리를 엮기 전까지 언제든 바꿀 수 있어요.
            <br />
            지금보다 뒤의 시각으로 골라 주세요.
          </p>
        )}
        {error && <p className="mt-2 text-center text-[12px] text-point">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={`${PILL_BUTTON_CLASS} border border-line bg-surface`}>
            취소
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className={`${PILL_BUTTON_CLASS} bg-ink text-surface disabled:bg-disabled`}
          >
            {saving ? '바꾸는 중…' : '바꾸기'}
          </button>
        </div>
      </form>
    </div>
  )
}

// 버튼 종류마다 색을 달리해 무엇을 하는 버튼인지 한눈에 보이게 한다
const PILL_BASE = 'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold active:opacity-80'
/** 변경·이름 변경: 차분한 회갈색 */
const EDIT_BUTTON_CLASS = `${PILL_BASE} bg-[#efe9df] text-[#6b5f53]`
/** 방장 넘기기: 파랑 */
const TRANSFER_BUTTON_CLASS = `${PILL_BASE} bg-[#e8eefb] text-[#3d64b8]`
/** 내보내기: 분홍(되돌리기 어려운 동작) */
const KICK_BUTTON_CLASS = `${PILL_BASE} bg-[#fbe9f0] text-point`

/** 나가기·링크 재발급·방 삭제 전에 한 번 더 묻는 창 */
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: ReactNode
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      // 409: 결제가 진행 중이면 서버가 방 삭제·방장 넘기기를 잠시 막는다
      setError(
        err instanceof ApiError && err.status === 409
          ? '결제가 처리 중이에요. 잠시 후 다시 시도해 주세요'
          : err instanceof ApiError && (err.status === 404 || err.status === 405)
            ? '아직 이 기능을 쓸 수 없어요. 서버 준비가 끝나면 다시 시도해 주세요'
            : err instanceof ApiError && err.status < 500 && err.message
              ? err.message
              : '잠시 후 다시 시도해 주세요',
      )
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-8" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[20px] bg-surface px-6 pt-6 pb-5 text-center text-ink"
      >
        <h2 id="confirm-title" className="text-[16px] font-bold">
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-sub">{description}</p>
        {error && <p className="mt-2 text-[12px] text-point">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={`${PILL_BUTTON_CLASS} border border-line bg-surface`}>
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`${PILL_BUTTON_CLASS} bg-point text-surface disabled:opacity-60`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type ConfirmTarget = 'leave' | 'deleteRoom' | { transferTo: Member } | { kick: Member }

/** 모임방 설정: 모임 정보, 초대 링크, 함께하는 사람, 약관, 나가기 */
function RoomSettingsPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ConfirmTarget | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const inviteToken = useRoomInvite(roomId)
  const { link, copied, copy, share } = useInviteShare(inviteToken ?? '')
  // 대표 사진은 서버 값(coverImageUrl)을 먼저 쓰고, 없으면 이 기기에 남겨 둔 미리보기를 쓴다
  const [placeCover, setPlaceCover] = useState(() => getRoomPlaceCover(roomId))
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const updatePlaceCover = (next: typeof placeCover) => {
    if (!saveRoomPlaceCover(roomId, next)) {
      setPhotoError('사진이 너무 커서 저장하지 못했어요. 다른 사진을 골라 주세요')
      return
    }
    setPhotoError('')
    setPlaceCover(next)
  }

  // 대표 사진: 서버에 올리고 방 정보에 저장한다. 이 기기에도 미리보기를 남겨 둔다
  const handleCoverPhoto = async (file?: File) => {
    if (!file || !home || !session) return
    let preview: string
    try {
      preview = await shrinkImage(file, 960)
    } catch {
      setPhotoError('사진을 열 수 없어요. 다른 사진을 골라 주세요')
      return
    }
    try {
      const blob = await (await fetch(preview)).blob()
      const cover = await uploadRoomCover(blob, preview)
      await updateRoom(home.room.id, { coverImageUrl: cover.imageUrl }, session.memberAccessToken)
      setHome({ ...home, room: { ...home.room, coverImageUrl: cover.imageUrl } })
      updatePlaceCover({ ...placeCover, coverPhoto: preview })
    } catch {
      setPhotoError('대표 사진을 바꾸지 못했어요. 다시 시도해 주세요')
    }
  }

  useEffect(() => {
    if (!session) return
    getRoomHome(roomId, session.memberAccessToken)
      .then(setHome)
      .catch(() => setError('방 정보를 불러오지 못했어요'))
    // session은 매 렌더마다 새로 읽으므로 roomId 기준으로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // 다른 사람이 방장을 넘겨주거나 이름·인원을 바꾸면(member.updated·room.updated) 이 화면도 바로 다시 불러온다
  useRoomLiveUpdates(roomId, session?.memberAccessToken, () => {
    if (session) getRoomHome(roomId, session.memberAccessToken).then(setHome).catch(() => {})
  })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (error) return <NotFoundPage message={error} />
  if (!home) return <main className="flex-1 bg-bg" aria-busy="true" />

  const { room, me, members } = home

  const handleSave = async (value: string) => {
    if (editing === 'roomName') {
      await updateRoom(room.id, { name: value }, session.memberAccessToken)
      saveRoomSession(room.id, { ...session, roomName: value })
      setHome({ ...home, room: { ...room, name: value } })
    } else if (editing === 'deadlineAt') {
      // 입력칸은 기기 시간대 기준이라 서버에는 ISO 시각으로 바꿔 보낸다
      const deadlineAt = new Date(value).toISOString()
      await updateRoom(room.id, { deadlineAt }, session.memberAccessToken)
      setHome({ ...home, room: { ...room, deadlineAt } })
    } else if (editing === 'capacity') {
      const capacity = Number(value)
      await updateRoom(room.id, { capacity }, session.memberAccessToken)
      // 서버가 인원 변경을 아직 모르면 요청을 받고도 그대로 둘 수 있어서, 다시 불러와 실제로 바뀌었는지 확인한다
      const fresh = await getRoomHome(room.id, session.memberAccessToken)
      if (!USE_MOCK && fresh.room.capacity !== capacity) {
        throw new Error('아직 인원을 바꿀 수 없어요. 서버 준비가 끝나면 다시 시도해 주세요')
      }
      setHome(USE_MOCK ? { ...home, room: { ...room, capacity } } : fresh)
    } else if (editing === 'meetingDate') {
      await updateRoom(room.id, { meetingDate: value }, session.memberAccessToken)
      setHome({ ...home, room: { ...room, meetingDate: value } })
    } else {
      await updateMyNickname(room.id, value, session.memberAccessToken)
      setHome({
        ...home,
        me: { ...me, nickname: value },
        members: members.map((m) => (m.id === me.id ? { ...m, nickname: value } : m)),
      })
    }
    setEditing(null)
  }

  const handleLeave = async () => {
    await leaveRoom(room.id)
    removeRoomSession(room.id)
    navigate(paths.roomList(), { replace: true })
  }

  const handleTransferHost = async (target: Member) => {
    await transferHost(room.id, target.id)
    setHome({
      ...home,
      me: { ...me, role: 'MEMBER' },
      members: members.map((m) =>
        m.id === target.id ? { ...m, role: 'HOST' } : m.id === me.id ? { ...m, role: 'MEMBER' } : m,
      ),
    })
    setConfirming(null)
  }

  // 강퇴: 서버에서 내보내고 목록에서 뺀다 (내보낸 사람 화면은 member.left 이벤트로 방에서 나가게 된다)
  const handleKick = async (target: Member) => {
    await kickMember(room.id, target.id)
    setHome({ ...home, members: members.filter((m) => m.id !== target.id) })
    setConfirming(null)
  }

  const handleDeleteRoom = async () => {
    await deleteRoom(room.id, session.memberAccessToken)
    removeRoomSession(room.id)
    navigate(paths.roomList(), { replace: true })
  }

  const isHost = me.role === 'HOST'
  const coverImage = coverSrc(room.coverImageUrl) ?? placeCover.coverPhoto
  const canChangeDeadline = room.status === 'COLLECTING' || room.status === 'CIRCULATING'

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-16 pb-8 text-ink">
      <header className="px-1">
        <button
          type="button"
          onClick={() => navigate(paths.roomHome(room.id))}
          className="flex items-center gap-2.5 text-[16px] font-bold"
        >
          <ChevronLeftIcon />
          설정
        </button>
      </header>

      <Section title="모임 정보">
        {/* 항목 이름을 왼쪽에 두고, 방장은 줄 전체를 눌러 바꾼다 */}
        <ul className="-mx-1 divide-y divide-line">
          <InfoRow label="모임 이름" editable={isHost} onEdit={() => setEditing('roomName')}>
            <span className="font-bold">{room.name}</span>
          </InfoRow>
          <InfoRow label="함께할 인원" editable={isHost} onEdit={() => setEditing('capacity')}>
            {room.capacity ?? ROOM_CAPACITY}명 <span className="text-[12px] text-sub">· 지금 {members.length}명</span>
          </InfoRow>
          <InfoRow label="모임 날짜" editable={isHost} onEdit={() => setEditing('meetingDate')}>
            {room.meetingDate ? formatDateSpaced(room.meetingDate) : <Empty>정하지 않았어요</Empty>}
          </InfoRow>
          <InfoRow label="대표 사진" editable={isHost} onEdit={() => photoInputRef.current?.click()}>
            {/* 대표 사진은 줄 안에서 작은 썸네일로 바로 보여준다 */}
            <span className="flex items-center gap-2">
              {coverImage ? (
                <ViewablePhoto src={coverImage} alt="대표 사진" className="size-9 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span className="size-9 shrink-0 rounded-[10px] border border-dashed border-line bg-bg" aria-hidden="true" />
              )}
              {!coverImage && <Empty>없어요</Empty>}
            </span>
          </InfoRow>
          {/* 엮기를 시작하기 전까지만 첫 두루마리 시각을 바꿀 수 있다 */}
          {canChangeDeadline && (
            // 첫 두루마리 시각은 엮기 전까지 횟수 제한 없이 바꿀 수 있다
            <InfoRow label="첫 두루마리" editable={isHost} onEdit={() => setEditing('deadlineAt')}>
              {room.deadlineAt ? formatDateTime(room.deadlineAt) : '아직 안 정했어요'}
            </InfoRow>
          )}
        </ul>
        {isHost && (
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="대표 사진 고르기"
            onChange={(e) => {
              void handleCoverPhoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        )}
        {photoError && (
          <p className="mt-2 text-[11px] text-point" role="alert">
            {photoError}
          </p>
        )}
      </Section>

      {/* 초대 링크는 고정이고 방 참가자 누구나 볼 수 있다 (이 기기에 없으면 서버에서 받아 온다) */}
      {inviteToken && (
        <Section title="초대 링크">
          <p className="flex h-[52px] items-center truncate rounded-2xl bg-line px-3.5 text-[13px] text-sub">{link}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => copy()} className={SHARE_BUTTON_CLASS}>
              <CopyIcon />
              {copied ? '복사됨' : '링크복사'}
            </button>
            <button type="button" onClick={() => share()} className={SHARE_BUTTON_CLASS}>
              <ShareIcon />
              단톡방에 보내기
            </button>
          </div>
          {/* 초대 링크는 고정: 한 번 만든 링크를 계속 쓴다 (새로 만들기 없음) */}
          <p className="mt-3 text-center text-[11px] text-sub">이 링크는 바뀌지 않아요. 언제든 같은 링크로 초대하세요</p>
        </Section>
      )}

      <Section title={`함께하는 사람 ${members.length}명`}>
        <ul className="flex flex-col gap-2.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px]">
              <Flower code={m.flowerCode} size={24} />
              {m.nickname}
              {m.id === me.id && <span className="text-[11px] text-sub">나</span>}
              <span className="ml-auto flex items-center gap-2">
                {m.role === 'HOST' && <span className="text-[11px] text-sub">방장</span>}
                {m.id === me.id && (
                  <button type="button" onClick={() => setEditing('nickname')} className={EDIT_BUTTON_CLASS}>
                    이름 변경
                  </button>
                )}
                {/* 방장만 다른 멤버에게 방장을 넘길 수 있다 */}
                {isHost && m.id !== me.id && (
                  <button
                    type="button"
                    onClick={() => setConfirming({ transferTo: m })}
                    className={TRANSFER_BUTTON_CLASS}
                  >
                    방장 넘기기
                  </button>
                )}
                {/* 방장만 다른 멤버를 내보낼 수 있다 */}
                {isHost && m.id !== me.id && (
                  <button
                    type="button"
                    onClick={() => setConfirming({ kick: m })}
                    className={KICK_BUTTON_CLASS}
                  >
                    내보내기
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="안내">
        <div className="flex flex-col gap-2.5 text-[13px]">
          <Link to={paths.terms()}>이용약관</Link>
          <Link to={paths.privacy()}>개인정보 처리방침</Link>
        </div>
      </Section>

      {/* 방장이 나가면 방을 이어받을 사람이 없어서, 방장에게는 나가기 대신 방 삭제를 보여준다 */}
      <button
        type="button"
        onClick={() => setConfirming(isHost ? 'deleteRoom' : 'leave')}
        className={`${PILL_BUTTON_CLASS} mt-6 w-full border border-line bg-surface text-point`}
      >
        {isHost ? '모임방 삭제하기' : '모임방 나가기'}
      </button>

      {editing && (
        <EditDialog
          target={editing}
          initialValue={
            editing === 'roomName'
              ? room.name
              : editing === 'meetingDate'
                ? (room.meetingDate ?? '')
                : editing === 'deadlineAt'
                  ? (room.deadlineAt ? toLocalDateTimeInput(room.deadlineAt) : '')
                  : editing === 'capacity'
                    ? String(room.capacity ?? ROOM_CAPACITY)
                    : me.nickname
          }
          minCapacity={members.length}

          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {typeof confirming === 'object' && confirming !== null && 'kick' in confirming && (
        <ConfirmDialog
          title={`${confirming.kick.nickname}님을 내보낼까요?`}
          description={
            <>
              내보내면 이 방에 다시 들어올 수 없어요.
              <br />
              지금까지 남긴 사진과 이야기는 방에 그대로 남아요.
            </>
          }
          confirmLabel="내보내기"
          onCancel={() => setConfirming(null)}
          onConfirm={() => handleKick(confirming.kick)}
        />
      )}
      {typeof confirming === 'object' && confirming !== null && 'transferTo' in confirming && (
        <ConfirmDialog
          title={`${confirming.transferTo.nickname}님에게 방장을 넘길까요?`}
          description={
            <>
              넘기면 나는 일반 멤버가 돼요.
              <br />
              방 설정·초대 링크·방 삭제는 새 방장만 할 수 있어요.
            </>
          }
          confirmLabel="넘기기"
          onCancel={() => setConfirming(null)}
          onConfirm={() => handleTransferHost(confirming.transferTo)}
        />
      )}
      {confirming === 'leave' && (
        <ConfirmDialog
          title={`${room.name}에서 나갈까요?`}
          description={
            <>
              내가 남긴 사진과 이야기는 방에 그대로 남아요.
              <br />
              같은 초대 링크로 다시 들어올 수 있어요.
            </>
          }
          confirmLabel="나가기"
          onCancel={() => setConfirming(null)}
          onConfirm={handleLeave}
        />
      )}
      {confirming === 'deleteRoom' && (
        <ConfirmDialog
          title={`${room.name}${objectParticle(room.name)} 삭제할까요?`}
          description={
            <>
              모두의 사진과 이야기, 두루마리가 지워져요.
              <br />
              삭제하면 되돌릴 수 없어요.
            </>
          }
          confirmLabel="삭제하기"
          onCancel={() => setConfirming(null)}
          onConfirm={handleDeleteRoom}
        />
      )}
    </main>
  )
}

export default RoomSettingsPage
