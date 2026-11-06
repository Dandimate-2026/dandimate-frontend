import type { FlowerCode } from '../api/types'
import Flower from '../components/Flower'

// 시안의 꽃 여섯 송이 (진달래·물망초·개나리·라일락·유채·청록)
const INVITE_FLOWERS: FlowerCode[] = ['AZALEA', 'FORGET_ME_NOT', 'FORSYTHIA', 'LILAC', 'CANOLA', 'TEAL']

/** 말풍선 모양 카카오 아이콘 */
function KakaoBubbleIcon() {
  return (
    <svg width="16" height="15" viewBox="0 0 16 15" fill="currentColor" aria-hidden="true">
      <path d="M8 14c4.418 0 8-3.134 8-7S12.418 0 8 0 0 3.134 0 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 14Z" />
    </svg>
  )
}

/** 두루마리 그림: 위아래 막대 사이 종이에 꽃 한 송이 */
function ScrollMark() {
  return (
    <div className="relative h-[116px] w-[97px]" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 h-5 rounded-full bg-ink" />
      <span className="absolute inset-x-[9px] top-2.5 bottom-2.5 bg-surface" />
      <span className="absolute top-[24px] left-1/2 -translate-x-1/2">
        <Flower code="ROYAL_AZALEA" size={58} />
      </span>
      <span className="absolute inset-x-0 bottom-0 h-5 rounded-full bg-ink" />
    </div>
  )
}

/**
 * 초대 링크로 들어와 로그인하기 전에만 보이는 화면.
 * 어느 방에 초대받았는지 보여주고 카카오 로그인으로 보낸다
 */
function InviteLoginView({
  roomName,
  loggingIn,
  onLogin,
}: {
  /** 초대 정보를 불러오기 전이면 undefined */
  roomName?: string
  loggingIn: boolean
  onLogin: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg px-[27px] pt-12 pb-8 text-ink">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <ScrollMark />
        <h1 className="mt-8 text-[24px] leading-[30px] font-bold text-point">두루두루</h1>
        <p className="mt-2 text-[15px] leading-[20px]">
          사진 한 장, 한마디씩
          <br />
          같이 다녀온 여행을 두루마리로 엮어요
        </p>
        <ul className="mt-5 flex gap-1.5">
          {INVITE_FLOWERS.map((code) => (
            <li key={code}>
              <Flower code={code} size={25} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-col items-center">
        <p className="min-h-6 rounded-full bg-[#f6e3ea] px-[18px] py-[3px] text-[12px] text-point">
          {roomName ? `‘${roomName}’에 초대받았어요` : '모임방에 초대받았어요'}
        </p>
        <button
          type="button"
          onClick={onLogin}
          disabled={loggingIn}
          className="mt-[11px] flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#fee500] text-[15px] font-bold text-ink active:opacity-80"
        >
          <KakaoBubbleIcon />
          카카오 로그인
        </button>
        <p className="mt-2.5 text-center text-[11px] leading-[17px] text-sub">
          로그인하면 이용약관과 개인정보 처리방침,
          <br />
          사진 · 음성의 외부 AI 처리에 동의하게 돼요
        </p>
      </footer>
    </main>
  )
}

export default InviteLoginView
