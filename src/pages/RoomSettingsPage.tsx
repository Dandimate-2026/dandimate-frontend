import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import {
  deleteRoom,
  getRoomHome,
  leaveRoom,
  rotateInviteToken,
  transferHost,
  updateMyNickname,
  updateRoom,
} from '../api/rooms'
import type { Member, RoomHome } from '../api/types'
import Card from '../components/Card'
import Flower from '../components/Flower'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { useInviteShare } from '../hooks/useInviteShare'
import { formatDateSpaced, formatDateTime, toLocalDateTimeInput } from '../lib/date'
import { objectParticle } from '../lib/plans'
import { getRoomPlaceCover, saveRoomPlaceCover, shrinkImage } from '../lib/roomExtras'
import { getRoomSession, removeRoomSession, saveRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'

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

type EditTarget = 'roomName' | 'meetingDate' | 'deadlineAt' | 'nickname'

const EDIT_COPY: Record<EditTarget, { title: string; maxLength?: number }> = {
  roomName: { title: '모임 이름 바꾸기', maxLength: MAX_ROOM_NAME_LENGTH },
  meetingDate: { title: '모임 날짜 바꾸기' },
  deadlineAt: { title: '첫 두루마리 시각 바꾸기' },
  nickname: { title: '내 이름 바꾸기', maxLength: MAX_NICKNAME_LENGTH },
}

/** 모임 이름·날짜나 내 이름을 바꾸는 창 */
function EditDialog({
  target,
  initialValue,
  onCancel,
  onSave,
}: {
  target: EditTarget
  initialValue: string
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
            err instanceof ApiError && target === 'deadlineAt' && err.status < 500 && err.message
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
          {maxLength ? (
            <>
              <input
                aria-label={title}
                value={value}
                maxLength={maxLength}
                autoFocus
                onChange={(e) => setValue(e.target.value)}
                className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-[18px] outline-none focus:border-sub"
              />
              <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
                {value.length}/{maxLength}
              </span>
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
        {target === 'deadlineAt' && (
          <p className="mt-3 text-center text-[12px] leading-5 text-sub">
            방을 만든 뒤 24~72시간 사이로 정할 수 있어요.
            <br />
            시각은 <b className="font-semibold text-ink">한 번만</b> 바꿀 수 있어요.
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

const EDIT_BUTTON_CLASS = 'shrink-0 rounded-full border border-line px-3 py-1 text-[11px] text-sub active:opacity-80'

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

type ConfirmTarget = 'leave' | 'rotateInvite' | 'deleteRoom' | { transferTo: Member }

/** 모임방 설정: 모임 정보, 초대 링크, 함께하는 사람, 약관, 나가기 */
function RoomSettingsPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ConfirmTarget | null>(null)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  // 링크를 새로 만들면 화면의 링크도 바로 바꾼다
  const [inviteToken, setInviteToken] = useState(session?.inviteToken)
  const { link, copied, copy, share } = useInviteShare(inviteToken ?? '')
  // 대표 사진은 서버에 칸이 없어 이 기기에 방마다 저장해 둔 값을 쓴다 (장소는 사진마다 올릴 때 정한다)
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

  const handleCoverPhoto = async (file?: File) => {
    if (!file) return
    try {
      updatePlaceCover({ ...placeCover, coverPhoto: await shrinkImage(file) })
    } catch {
      setPhotoError('사진을 열 수 없어요. 다른 사진을 골라 주세요')
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

  const handleRotateInvite = async () => {
    const next = await rotateInviteToken(room.id, session.memberAccessToken)
    saveRoomSession(room.id, { ...session, inviteToken: next })
    setInviteToken(next)
    setConfirming(null)
  }

  const handleDeleteRoom = async () => {
    await deleteRoom(room.id, session.memberAccessToken)
    removeRoomSession(room.id)
    navigate(paths.roomList(), { replace: true })
  }

  const isHost = me.role === 'HOST'
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
          <InfoRow label="모임 날짜" editable={isHost} onEdit={() => setEditing('meetingDate')}>
            {room.meetingDate ? formatDateSpaced(room.meetingDate) : <Empty>정하지 않았어요</Empty>}
          </InfoRow>
          <InfoRow label="대표 사진" editable={isHost} onEdit={() => photoInputRef.current?.click()}>
            {/* 대표 사진은 줄 안에서 작은 썸네일로 바로 보여준다 */}
            <span className="flex items-center gap-2">
              {placeCover.coverPhoto ? (
                <img src={placeCover.coverPhoto} alt="대표 사진" className="size-9 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span className="size-9 shrink-0 rounded-[10px] border border-dashed border-line bg-bg" aria-hidden="true" />
              )}
              {!placeCover.coverPhoto && <Empty>없어요</Empty>}
            </span>
          </InfoRow>
          {/* 엮기를 시작하기 전까지만 첫 두루마리 시각을 바꿀 수 있다 */}
          {canChangeDeadline && (
            <InfoRow label="첫 두루마리" editable={isHost} onEdit={() => setEditing('deadlineAt')}>
              {formatDateTime(room.deadlineAt)}
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

      {/* 원본 초대 토큰은 방장만 갖고 있어서, 방장에게만 초대 링크를 보여준다.
          서버는 원본 토큰을 방을 만들 때·새로 만들 때만 주므로, 다른 기기에서 들어온 방장은 새로 만들어야 링크가 생긴다 */}
      {isHost && !inviteToken && (
        <Section title="초대 링크">
          <p className="text-[13px] leading-5 text-sub">
            이 기기에는 초대 링크가 저장돼 있지 않아요.
            <br />
            새로 만들면 이전 링크로는 더 들어올 수 없어요.
          </p>
          <button
            type="button"
            onClick={() => setConfirming('rotateInvite')}
            className={`${SHARE_BUTTON_CLASS} mt-3 w-full`}
          >
            초대 링크 새로 만들기
          </button>
        </Section>
      )}
      {isHost && inviteToken && (
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
          <button
            type="button"
            onClick={() => setConfirming('rotateInvite')}
            className="mt-3 w-full text-center text-[11px] text-sub underline underline-offset-2 active:opacity-80"
          >
            링크 새로 만들기
          </button>
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
                    className={EDIT_BUTTON_CLASS}
                  >
                    방장 넘기기
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
                  ? toLocalDateTimeInput(room.deadlineAt)
                  : me.nickname
          }
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {typeof confirming === 'object' && confirming !== null && (
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
      {confirming === 'rotateInvite' && (
        <ConfirmDialog
          title="초대 링크를 새로 만들까요?"
          description={
            <>
              지금 링크로는 더 이상 들어올 수 없어요.
              <br />
              이미 들어온 친구는 그대로 남아 있어요.
            </>
          }
          confirmLabel="새로 만들기"
          onCancel={() => setConfirming(null)}
          onConfirm={handleRotateInvite}
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
