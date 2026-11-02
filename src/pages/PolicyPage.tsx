import { useNavigate } from 'react-router'
import { ChevronLeftIcon } from '../components/entry/EntryIcons'
import { paths } from '../routes/paths'

type PolicyKind = 'terms' | 'privacy'

// TODO: 서비스 준비용 초안이다. 정식 문구는 운영 정책이 정해지면 바꾼다
const POLICIES: Record<PolicyKind, { title: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: '이용약관',
    sections: [
      {
        heading: '1. 서비스 소개',
        body: '두루두루는 친구들과 함께 사진을 모으고, 사진마다 남긴 말과 글을 엮어 하나의 두루마리로 만들어 주는 서비스예요.',
      },
      {
        heading: '2. 시작하기',
        body: '카카오 계정으로 로그인한 뒤 모임방을 만들거나, 친구가 보낸 초대 링크로 모임방에 들어갈 수 있어요. 모임방을 만든 사람이 방장이 돼요.',
      },
      {
        heading: '3. 올리는 내용',
        body: '사진과 음성, 글은 올린 사람이 책임져요. 다른 사람의 권리를 침해하거나, 불쾌감을 주는 내용은 올리지 말아 주세요. 이런 내용은 알리지 않고 가려질 수 있어요.',
      },
      {
        heading: '4. 두루마리 만들기',
        body: '모임방에 모인 사진과 이야기는 AI가 각자의 말을 인용해 두루마리로 엮어요. AI가 엮은 문장은 실제와 다를 수 있으니, 답가로 빠진 이야기를 보태 주세요.',
      },
      {
        heading: '5. 모임방 관리',
        body: '방장은 모임방 이름과 날짜, 마감 시간을 바꾸거나, 마감 전에 먼저 엮기를 시작하거나, 모임방을 지울 수 있어요. 모임방을 지우면 그 안의 사진과 이야기도 함께 지워져요.',
      },
      {
        heading: '6. 서비스 변경',
        body: '서비스 내용은 더 나은 경험을 위해 바뀔 수 있어요. 중요한 변경은 서비스 안에서 미리 알려 드릴게요.',
      },
    ],
  },
  privacy: {
    title: '개인정보 처리방침',
    sections: [
      {
        heading: '1. 모으는 정보',
        body: '카카오 로그인으로 받는 계정 식별 정보, 모임방에서 쓰는 이름, 직접 올린 사진·음성·글을 모아요.',
      },
      {
        heading: '2. 쓰는 목적',
        body: '모임방 참여, 사진 돌려보기, 두루마리 만들기처럼 서비스를 제공하는 데에만 써요.',
      },
      {
        heading: '3. 외부 AI 처리',
        body: '음성을 글로 받아 적고, 이야기를 두루마리로 엮기 위해 사진·음성·글을 외부 AI 서비스로 보내 처리할 수 있어요. 처리 결과는 두루두루 안에서만 보여요.',
      },
      {
        heading: '4. 보관과 삭제',
        body: '정보는 모임방이 남아 있는 동안 보관해요. 방장이 모임방을 지우면 그 안의 사진과 이야기도 함께 지워져요.',
      },
      {
        heading: '5. 문의',
        body: '개인정보와 관련해 궁금한 점은 서비스 운영팀으로 알려 주세요.',
      },
    ],
  },
}

/** 이용약관 · 개인정보 처리방침. 로그인 화면에서도 열 수 있어야 해서 로그인 없이 볼 수 있다 */
function PolicyPage({ kind }: { kind: PolicyKind }) {
  const navigate = useNavigate()
  const { title, sections } = POLICIES[kind]

  // 앱 안에서 링크를 눌러 왔으면 그 화면으로, 주소로 바로 열었으면 첫 화면으로 돌아간다
  const goBack = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (historyIndex > 0) navigate(-1)
    else navigate(paths.roomList(), { replace: true })
  }

  return (
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-12 pb-10 text-ink">
      <header className="px-1">
        <button type="button" onClick={goBack} className="flex items-center gap-2.5 text-[16px] font-bold">
          <ChevronLeftIcon />
          {title}
        </button>
      </header>

      <div className="mt-8 flex flex-col gap-6 px-1.5">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[13px] font-bold">{s.heading}</h2>
            <p className="mt-1.5 text-[12px] leading-5 break-keep text-sub">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 px-1.5 text-[11px] text-muted">시행일 2026. 11. 3</p>
    </main>
  )
}

export default PolicyPage
