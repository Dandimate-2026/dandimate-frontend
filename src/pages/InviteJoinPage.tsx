import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getInvitePreview, joinRoom } from '../api/rooms'
import type { InvitePreview } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import Flower, { EmptySlot } from '../components/Flower'
import { formatDate } from '../lib/date'
import { saveRoomSession } from '../lib/session'
import NotFoundPage from './NotFoundPage'
import { paths } from '../routes/paths'

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

  useEffect(() => {
    getInvitePreview(inviteToken)
      .then(setPreview)
      .catch((e: unknown) =>
        setLoadError(
          e instanceof ApiError && e.status === 404 ? '만료되었거나 없는 초대 링크예요' : '방 정보를 불러오지 못했어요',
        ),
      )
  }, [inviteToken])

  if (loadError) return <NotFoundPage message={loadError} />
  if (!preview) return <main className="flex-1 bg-bg" aria-busy="true" />

  const canJoin = preview.canJoin && name.trim().length > 0 && !submitting
  const emptyCount = Math.max(preview.capacity - preview.flowers.length, 0)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canJoin) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { room, memberAccessToken } = await joinRoom(inviteToken, name.trim())
      saveRoomSession(room.id, { memberAccessToken, roomName: room.name })
      navigate(paths.roomHome(room.id))
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
        {/* TODO: 초대한 사람 이름이 InvitePreview API에 없어 백엔드 추가 요청 필요 */}
        <p className="text-[13px] text-sub">친구가 초대했어요</p>
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
              onChange={(e) => setName(e.target.value)}
              placeholder="친구들이 부르는 이름"
              className="h-[52px] w-full rounded-full border border-line bg-surface pr-14 pl-4 text-[15px] outline-none placeholder:text-muted focus:border-sub"
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[12px] text-sub">
              {name.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
          {!preview.canJoin && <p className="mt-2 text-[12px] text-point">지금은 이 방에 들어갈 수 없어요</p>}
          {submitError && <p className="mt-2 text-[12px] text-point">{submitError}</p>}
          <Button type="submit" disabled={!canJoin} className="mt-[18px] w-full">
            {submitting ? '들어가는 중…' : '들어가기'}
          </Button>
        </Card>
      </form>

      <p className="mt-7 text-center text-[11px] leading-[14px] text-sub">
        설치·가입 없이 이름만 있으면 돼요
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
