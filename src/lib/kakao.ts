// 카카오톡 공유용 Kakao JS SDK. 앱 키가 있을 때만 처음 쓸 때 불러온다
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
const APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY

interface KakaoSdk {
  isInitialized: () => boolean
  init: (appKey: string) => void
  Share: {
    sendDefault: (settings: {
      objectType: 'text'
      text: string
      link: { mobileWebUrl: string; webUrl: string }
      buttonTitle?: string
    }) => void
  }
}

declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

let loading: Promise<KakaoSdk | null> | null = null

function loadKakao(): Promise<KakaoSdk | null> {
  if (!APP_KEY) return Promise.resolve(null)
  loading ??= new Promise((resolve) => {
    const init = () => {
      const kakao = window.Kakao
      if (!kakao) return resolve(null)
      if (!kakao.isInitialized()) kakao.init(APP_KEY)
      resolve(kakao)
    }
    if (window.Kakao) return init()
    const script = document.createElement('script')
    script.src = SDK_URL
    script.crossOrigin = 'anonymous'
    script.onload = init
    script.onerror = () => {
      // 다음에 다시 시도할 수 있게 비워 둔다
      loading = null
      resolve(null)
    }
    document.head.appendChild(script)
  })
  return loading
}

/** 카카오톡 공유창을 연다. SDK를 쓸 수 없으면 false */
export async function shareToKakao(text: string, url: string) {
  const kakao = await loadKakao()
  if (!kakao) return false
  try {
    kakao.Share.sendDefault({
      objectType: 'text',
      text,
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: '모임방 들어가기',
    })
    return true
  } catch {
    return false
  }
}
