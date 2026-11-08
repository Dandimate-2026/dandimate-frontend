import { siteUrl } from './siteUrl'

interface FeedInvitation {
  objectType: 'feed'
  content: {
    title: string
    description: string
    imageUrl: string
    imageWidth: number
    imageHeight: number
    link: { mobileWebUrl: string; webUrl: string }
  }
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[]
}

interface KakaoSdk {
  init(key: string): void
  isInitialized(): boolean
  Share: { sendDefault(message: FeedInvitation): void }
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
  // 본문에도 URL 전체를 남긴다. 제한을 넘는 URL은 호출부의 전체 문구 복사로 대체한다.
  if (target.href.length > 198) throw new Error('Invitation URL exceeds description limit')
  const message = `${text.slice(0, 198 - target.href.length)}\n\n${target.href}`
  const link = { mobileWebUrl: target.href, webUrl: target.href }
  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: '💌 두루두루에 초대됐어요!',
      description: message,
      imageUrl: siteUrl('/og-image.png'),
      imageWidth: 512,
      imageHeight: 512,
      link,
    },
    buttons: [{ title: '추억 남기러 가기', link }],
  })
  return 'opened'
}
