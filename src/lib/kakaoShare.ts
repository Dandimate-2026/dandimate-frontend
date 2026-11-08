interface TextInvitation {
  objectType: 'text'
  text: string
  link: { mobileWebUrl: string; webUrl: string }
  buttonTitle: string
}

interface KakaoSdk {
  init(key: string): void
  isInitialized(): boolean
  Share: { sendDefault(message: TextInvitation): void }
}

declare global {
  interface Window { Kakao?: KakaoSdk }
}

const APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY?.trim()
let loading: Promise<void> | undefined

/** 클릭 전에 준비하여 공유 호출이 사용자 클릭 안에서 바로 실행되도록 한다. */
export function prepareKakaoShare(): Promise<void> {
  if (!APP_KEY) return Promise.resolve()
  if (window.Kakao?.isInitialized()) return Promise.resolve()
  if (loading) return loading

  loading = new Promise<void>((resolve, reject) => {
    const initialize = () => {
      try {
        if (!window.Kakao) throw new Error('Kakao SDK unavailable')
        if (!window.Kakao.isInitialized()) window.Kakao.init(APP_KEY)
        resolve()
      } catch (error) { reject(error) }
    }
    if (window.Kakao) { initialize(); return }

    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js'
    script.integrity = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w'
    script.crossOrigin = 'anonymous'
    script.async = true
    const timer = setTimeout(() => fail(), 10000)
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      reject(new Error('Kakao SDK load failed'))
    }
    script.onload = () => { clearTimeout(timer); initialize() }
    script.onerror = fail
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}

export function shareKakaoInvitation(text: string, url: string): 'opened' | 'loading' | 'unavailable' {
  if (!APP_KEY) return 'unavailable'
  if (!window.Kakao?.isInitialized()) {
    void prepareKakaoShare().catch(() => {})
    return 'loading'
  }
  const target = new URL(url)
  if (target.protocol !== 'https:') throw new Error('Invitation requires HTTPS')
  const invitation = `두루두루에 초대했어요 💌\n\n${text.slice(0, 70)}\n\n함께한 사진과 이야기를 모아요. 아래 버튼으로 함께해 주세요!`
  // 텍스트 템플릿은 최대 200자. 긴 URL도 실제 클릭 목적지에서는 자르지 않는다.
  const message = target.href.length < 150
    ? `${invitation.slice(0, 198 - target.href.length)}\n\n${target.href}`
    : invitation.slice(0, 200)
  // 텍스트 안에도 원본 주소를 남긴다. 링크/버튼에는 토큰을 포함한 같은 전체 주소를 전달한다.
  window.Kakao.Share.sendDefault({
    objectType: 'text',
    text: message,
    link: { mobileWebUrl: target.href, webUrl: target.href },
    buttonTitle: '초대받은 방 들어가기',
  })
  return 'opened'
}
