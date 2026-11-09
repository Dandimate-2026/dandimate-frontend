// 친구에게 보내는 링크(초대·방·두루마리)는 항상 배포 사이트 주소로 만든다.
// 로컬(localhost)에서 공유해도 받은 친구가 열 수 있고, 카카오톡 공유는 카카오 콘솔에 등록한 도메인의 링크만 열어 주기 때문이다
export const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL || (import.meta.env.DEV ? 'https://43-201-73-60.sslip.io' : window.location.origin)).replace(/\/$/, '')

/** 앱 안 경로(/rooms/…)를 친구에게 보낼 전체 주소로 */
export function siteUrl(path: string) {
  return `${SITE_ORIGIN}${path}`
}
