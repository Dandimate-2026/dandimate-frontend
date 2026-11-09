import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getInvitePreview, joinRoom } from '../api/rooms'
import type { InvitePreview } from '../api/types'
import { InviteLinkHelp } from '../components/InviteLinkHelp'
import Button from '../components/Button'
import Card from '../components/Card'
import Flower, { EmptySlot } from '../components/Flower'
import { formatDate } from '../lib/date'
import { getRoomSession, saveRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import WelcomeView from './WelcomeView'
import { paths } from '../routes/paths'
import { LengthNotice } from '../components/LengthNotice'
import { clampText } from '../lib/textLimit'

const MAX_NAME_LENGTH = 10

/** 초대 링크로 들어온 친구가 이름을 정하고 방에 입장하는 화면 */
function InviteJoinPage() {
  const { inviteToken = '' } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // 이미 로그인한 사람도 처음엔 첫 화면(어느 방에 초대받았는지 + 입장하기)을 보고, 누르면 이름을 정한다.
  // 이미 이 방에 들어와 있으면 첫 화면 없이 바로 방으로 간다
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    getInvitePreview(inviteToken)
      .then((value) => {
        // 이미 이 방에 있는 계정(방장 포함)이면 이름을 다시 묻지 않고 방으로 보낸다. 정원이 다 찼어도 들어갈 수 있다
        if (value.alreadyJoined) {
          saveRoomSession(value.roomId, {
            ...getRoomSession(value.roomId),
            memberAccessToken: '',
            roomName: value.roomName,
          })
          navigate(paths.roomHome(value.roomId), { replace: true })
          return
        }
        setPreview(value)
      })
      .catch((e: unknown) =>
        setLoadError(
          e instanceof ApiError && e.status === 404 ? '만료되었거나 없는 초대 링크예요' : '방 정보를 불러오지 못했어요',
        ),
      )
  }, [inviteToken, navigate])

  if (loadError) return <NotFoundPage message={loadError} />
  if (!preview) return <main className="flex-1 bg-bg" aria-busy="true" />

  if (!entered) {
    return (
      <WelcomeView
        invite
        inviteRoomName={preview.roomName}
        inviterNickname={preview.inviterNickname}
        actions={
          <>
            <Button onClick={() => setEntered(true)} disabled={!preview.canJoin} className="w-full">
              {preview.canJoin ? '입장하기' : '지금은 들어갈 수 없어요'}
            </Button>
            <InviteLinkHelp />
          </>
        }
        note={
          <>
            입장하면{' '}
            <Link to={paths.terms()} className="text-point">
              이용 안내
            </Link>
            에 동의하게 돼요
          </>
        }
      />
    )
  }

  const canJoin = preview.canJoin && name.trim().length > 0 && !submitting
  const emptyCount = Math.max(preview.capacity - preview.flowers.length, 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canJoin) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { room } = await joinRoom(inviteToken, name.trim())
      // 이미 이 방 방장이었으면(같은 계정으로 자기 초대 링크를 연 경우) 저장된 초대 코드를 지우지 않도록 합친다
      saveRoomSession(room.id, { ...getRoomSession(room.id), memberAccessToken: '', roomName: room.name })
      // 입장한 뒤 뒤로 가도 이름 입력 화면이 다시 나오지 않게 기록을 바꿔치기한다
      navigate(paths.roomHome(room.id), { replace: true })
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && err.status === 409
          ? '이미 가득 찼거나 들어갈 수 없는 방이에요'
          : '입장하지 못했어요. 다시 시도해 주세요',
      )
      setSubmitting(false)
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-bg px-5 text-ink pt-[clamp(32px,12dvh,124px)] pb-12">
      <section className="mb-12 px-2">
        <p className="text-[13px] text-sub">
          {preview.inviterNickname ? `${preview.inviterNickname}님이 초대했어요` : '친구가 초대했어요'}
        </p>
        {/* 대표 사진이 있으면 어떤 모임인지 바로 알 수 있게 보여준다 */}
        {preview.coverImageUrl && (
          <img src={preview.coverImageUrl} alt="" className="mt-4 aspect-[4/3] w-full rounded-[18px] object-cover" />
        )}
        <h1 className="mt-3 text-[20px] font-bold">{preview.roomName}</h1>
        {preview.meetingDate && <p className="mt-3 text-[12px] text-sub">{formatDate(preview.meetingDate)}</p>}

        <p className="mt-9 text-[12px] text-sub">먼저 들어온 친구 {preview.memberCount}명</p>
        <ul className="mt-3 flex gap-[5px]">
          {preview.flowers.map((code, i) => (
            <li key={`${code}-${i}`}>
              <Flower code={code} />
            </li>
          ))}
          {Array.from({ length: emptyCount }, (_, i) => (
            <li key={`empty-${i}`}>
              <EmptySlot />
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={handleSubmit} className="mt-auto">
        <Card className="pb-[14px]">
          <label htmlFor="nickname" className="text-[11px] font-semibold">
            이 방에서 쓸 이름
          </label>
          <div className="relative mt-2">
            <input
              id="nickname"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(clampText(e.target.value, MAX_NAME_LENGTH))}
              placeholder="친구들이 부르는 이름"
              className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-4 text-[15px] outline-none placeholder:text-muted focus:border-sub"
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
              {name.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
          <LengthNotice length={name.length} max={MAX_NAME_LENGTH} className="pl-1" />
          {!preview.canJoin && <p className="mt-2 text-[12px] text-point">지금은 이 방에 들어갈 수 없어요</p>}
          {submitError && <p className="mt-2 text-[12px] text-point">{submitError}</p>}
          <Button type="submit" disabled={!canJoin} className="mt-[18px] w-full">
            {submitting ? '들어가는 중…' : '들어가기'}
          </Button>
        </Card>
      </form>

      <p className="mt-7 text-center text-[11px] leading-[14px] text-sub">
        이름만 정하면 바로 들어갈 수 있어요
        <br />
        들어가면{' '}
        <Link to={paths.terms()} className="text-point">
          이용 안내
        </Link>
        에 동의하면 돼요
      </p>
    </main>
  )
}

export default InviteJoinPage
