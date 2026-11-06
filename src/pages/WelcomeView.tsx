import type { ReactNode } from 'react'
import type { FlowerCode } from '../api/types'
import logo from '../assets/logo-scroll.webp'
import Flower from '../components/Flower'

// 시안의 꽃 여섯 송이 (진달래·물망초·개나리·라일락·유채·청록)
const WELCOME_FLOWERS: FlowerCode[] = ['AZALEA', 'FORGET_ME_NOT', 'FORSYTHIA', 'LILAC', 'CANOLA', 'TEAL']

/** 말풍선 모양 카카오 아이콘 */
export function KakaoBubbleIcon() {
  return (
    <svg width="16" height="15" viewBox="0 0 16 15" fill="currentColor" aria-hidden="true">
      <path d="M8 14c4.418 0 8-3.134 8-7S12.418 0 8 0 0 3.134 0 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 14Z" />
    </svg>
  )
}

/**
 * 첫 화면 (로그인 · 초대받아 들어온 사람 입장).
 * - 그냥 들어온 사람: 초대 문구 없이 카카오 로그인
 * - 초대 링크로 들어온 사람: "'방 이름'에 초대받았어요" + 카카오 로그인 (이미 로그인했으면 입장하기)
 */
function WelcomeView({
  invite,
  inviteRoomName,
  inviterNickname,
  actions,
  note = (
    <>
      로그인하면 이용약관과 개인정보 처리방침,
      <br />
      사진 · 음성의 외부 AI 처리에 동의하게 돼요
    </>
  ),
}: {
  /** 초대 링크로 들어왔는지 */
  invite: boolean
  /** 초대받은 방 이름 (불러오기 전이면 없음) */
  inviteRoomName?: string
  /** 초대한 사람 이름 */
  inviterNickname?: string | null
  /** 아래 버튼 영역 (카카오 로그인 / 입장하기 / 데모 역할 고르기) */
  actions: ReactNode
  note?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg px-[27px] pt-12 pb-8 text-ink">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <img src={logo} alt="" className="w-[min(240px,64vw)] select-none" draggable={false} />
        <h1 className="mt-5 text-[24px] leading-[30px] font-bold text-point">두루두루</h1>
        <p className="mt-2 text-[15px] leading-[20px]">
          사진 한 장, 한마디씩
          <br />
          같이 다녀온 여행을 두루마리로 엮어요
        </p>
        <ul className="mt-5 flex gap-1.5">
          {WELCOME_FLOWERS.map((code) => (
            <li key={code}>
              <Flower code={code} size={25} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-col items-center">
        {invite && (
          <p className="mb-[11px] min-h-6 rounded-full bg-[#f6e3ea] px-[18px] py-[3px] text-[12px] text-point">
            {inviterNickname && inviteRoomName
              ? `${inviterNickname}님이 ‘${inviteRoomName}’에 초대했어요`
              : inviteRoomName
                ? `‘${inviteRoomName}’에 초대받았어요`
                : '모임방에 초대받았어요'}
          </p>
        )}
        <div className="w-full">{actions}</div>
        <p className="mt-2.5 text-center text-[11px] leading-[17px] text-sub">{note}</p>
      </footer>
    </main>
  )
}

/** 카카오 노란 버튼 (로그인) */
export function KakaoButton({ label = '카카오 로그인', disabled, onClick }: { label?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#fee500] text-[15px] font-bold text-ink active:opacity-80"
    >
      <KakaoBubbleIcon />
      {label}
    </button>
  )
}

export default WelcomeView
