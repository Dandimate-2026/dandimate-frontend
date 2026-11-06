// 카톡 카드에 들어갈 그림. 카카오가 가져갈 수 있게 우리 사이트 주소를 붙인 절대 주소로 보낸다
import shareImage from '../assets/logo-scroll.webp'

// 카카오톡 공유용 Kakao JS SDK. 앱 키가 있을 때만 처음 쓸 때 불러온다
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
const APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY

interface KakaoSdk {
  isInitialized: () => boolean
  init: (appKey: string) => void
  Share: {
    sendDefault: (settings: {
      objectType: 'feed'
      content: {
        title: string
        description: string
        imageUrl: string
        imageWidth?: number
        imageHeight?: number
        link: { mobileWebUrl: string; webUrl: string }
      }
      buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[]
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

/**
 * 카카오톡 공유창을 연다. 글자만 있는 메시지가 아니라 그림·제목·버튼이 있는 카드(피드)로 보낸다.
 * SDK를 쓸 수 없으면 false
 */
export async function shareToKakao(text: string, url: string, title = '두루두루') {
  const kakao = await loadKakao()
  if (!kakao) return false
  const link = { mobileWebUrl: url, webUrl: url }
  try {
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        // 링크 글자도 같이 넣어서, 버튼이 안 보이는 환경(PC 카톡 등)에서도 주소를 눌러 들어올 수 있게 한다
        description: [text, url].join('\n'),
        imageUrl: new URL(shareImage, window.location.origin).href,
        imageWidth: 960,
        imageHeight: 600,
        link,
      },
      buttons: [{ title: '모임방 들어가기', link }],
    })
    return true
  } catch {
    return false
  }
}
