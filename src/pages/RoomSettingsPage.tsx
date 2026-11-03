import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getRoomHome, updateMyNickname, updateRoom } from '../api/rooms'
import type { RoomHome } from '../api/types'
import Card from '../components/Card'
import Flower from '../components/Flower'
import { CopyIcon, ShareIcon } from '../components/ShareIcons'
import { useInviteShare } from '../hooks/useInviteShare'
import { formatDateSpaced } from '../lib/date'
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

const SHARE_BUTTON_CLASS =
  'flex h-[52px] items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-[13px] text-sub active:opacity-80'

const PILL_BUTTON_CLASS = 'h-[52px] rounded-full text-[15px] font-semibold active:opacity-80'

const MAX_ROOM_NAME_LENGTH = 10
const MAX_NICKNAME_LENGTH = 10

type EditTarget = 'roomName' | 'meetingDate' | 'nickname'

const EDIT_COPY: Record<EditTarget, { title: string; maxLength?: number }> = {
  roomName: { title: '모임 이름 바꾸기', maxLength: MAX_ROOM_NAME_LENGTH },
  meetingDate: { title: '모임 날짜 바꾸기' },
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
    } catch {
      // 백엔드에 API가 생기기 전까지는 여기로 온다
      setError('아직 바꿀 수 없어요. 조금만 기다려 주세요')
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
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-[52px] w-full rounded-full border border-line bg-surface px-[18px] outline-none focus:border-sub"
            />
          )}
        </div>
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

/** 나가기 전에 한 번 더 묻는 창 */
function LeaveDialog({ roomName, onCancel, onConfirm }: { roomName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-8" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[20px] bg-surface px-6 pt-6 pb-5 text-center text-ink"
      >
        <h2 id="leave-title" className="text-[16px] font-bold">
          {roomName}에서 나갈까요?
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-sub">
          나가면 이 기기의 모임방 목록에서 사라져요.
          <br />
          다시 들어오려면 초대 링크가 필요해요.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={`${PILL_BUTTON_CLASS} border border-line bg-surface`}>
            취소
          </button>
          <button type="button" onClick={onConfirm} className={`${PILL_BUTTON_CLASS} bg-point text-surface`}>
            나가기
          </button>
        </div>
      </div>
    </div>
  )
}

/** 모임방 설정: 모임 정보, 초대 링크, 함께하는 사람, 약관, 나가기 */
function RoomSettingsPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const [home, setHome] = useState<RoomHome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const { link, copied, copy, share } = useInviteShare(session?.inviteToken ?? '')

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

  const handleLeave = () => {
    // TODO: 백엔드에 방 나가기 API가 없어서, 지금은 이 기기에 저장된 방 정보만 지운다
    removeRoomSession(room.id)
    navigate(paths.roomList(), { replace: true })
  }

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
        {/* 모임 이름과 날짜는 방장만 바꿀 수 있다 */}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-bold">{room.name}</p>
          {me.role === 'HOST' && (
            <button type="button" onClick={() => setEditing('roomName')} className={EDIT_BUTTON_CLASS}>
              변경
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[13px] text-sub">
            {room.meetingDate ? formatDateSpaced(room.meetingDate) : '날짜를 정하지 않았어요'}
          </p>
          {me.role === 'HOST' && (
            <button type="button" onClick={() => setEditing('meetingDate')} className={EDIT_BUTTON_CLASS}>
              변경
            </button>
          )}
        </div>
      </Section>

      {/* 원본 초대 토큰은 방장만 갖고 있어서, 방장에게만 초대 링크를 보여준다 */}
      {me.role === 'HOST' && session.inviteToken && (
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

      <button
        type="button"
        onClick={() => setLeaving(true)}
        className={`${PILL_BUTTON_CLASS} mt-6 w-full border border-line bg-surface text-point`}
      >
        모임방 나가기
      </button>

      {editing && (
        <EditDialog
          target={editing}
          initialValue={
            editing === 'roomName' ? room.name : editing === 'meetingDate' ? (room.meetingDate ?? '') : me.nickname
          }
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {leaving && <LeaveDialog roomName={room.name} onCancel={() => setLeaving(false)} onConfirm={handleLeave} />}
    </main>
  )
}

export default RoomSettingsPage
